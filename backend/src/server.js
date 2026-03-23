const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { z } = require('zod');
const { config } = require('./config');
const mqttService = require('./services/mqttService');
const {
  acknowledgeAlert,
  createDatabase,
  deleteAlert,
  deleteNode,
  getAIMetrics,
  getDashboardSummary,
  getLastSensorReadingForNode,
  getLatestPredictions,
  getLatestSensorDataByNode,
  getNodeById,
  getSensorDataById,
  getSensorStats,
  insertAlert,
  clearAllData,
  insertSensorData,
  listAlerts,
  listAnomalies,
  listNodes,
  listSensorData,
  refreshPredictions,
  updateNode,
  updateNodeStatuses,
  updateSensorData,
} = require('./db');
const { buildAlertsFromReading, calculateAnomalyScore, generateSensorReading } = require('./generator');
const aiEngine = require('./ai-engine');
const { enrichReading, weatherCondition, computeFloodRisk, computeStormRisk, computeOverallRisk, computeAQI, aqiCategory, riskLabel } = require('./weather');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
let db;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── Servir le frontend buildé en production ────────────────────────────────
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
}

function toUnix(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.floor(n);
}

function parseAckQuery(value) {
  if (value === undefined) return undefined;
  if (value === '1' || value === 'true') return 1;
  if (value === '0' || value === 'false') return 0;
  return undefined;
}

function sendJson(res, status, payload) {
  res.status(status).json({
    success: status < 400,
    ...payload,
  });
}

// ─── WebSocket Manager ─────────────────────────────────────────────────────
const wsClients = new Map(); // clientId => { ws, subscriptions: Set }

const wsManager = {
  init(wss) {
    wss.on('connection', (ws) => {
      const clientId = Math.random().toString(36).slice(2);
      wsClients.set(clientId, { ws, subscriptions: new Set(['*']) });

      ws.send(
        JSON.stringify({
          event: 'connected',
          data: { clientId, message: 'MeteoIoT WebSocket — connecté', ts: new Date().toISOString() },
        }),
      );

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw);
          const client = wsClients.get(clientId);
          if (msg.action === 'subscribe' && client) {
            msg.topics?.forEach((t) => client.subscriptions.add(t));
            ws.send(JSON.stringify({ event: 'subscribed', data: { topics: msg.topics } }));
          }
          if (msg.action === 'unsubscribe' && client) {
            msg.topics?.forEach((t) => client.subscriptions.delete(t));
          }
          if (msg.action === 'ping') {
            ws.send(JSON.stringify({ event: 'pong', data: { ts: Date.now() } }));
          }
        } catch {}
      });

      ws.on('close', () => wsClients.delete(clientId));
      ws.on('error', () => wsClients.delete(clientId));
    });

    // Heartbeat toutes les 30 s
    setInterval(() => {
      for (const [id, { ws }] of wsClients) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ event: 'heartbeat', data: { ts: Date.now(), clients: wsClients.size } }));
        } else {
          wsClients.delete(id);
        }
      }
    }, 30000);
  },

  broadcast(payload, topic = null) {
    const msg = JSON.stringify(payload);
    for (const { ws, subscriptions } of wsClients.values()) {
      if (ws.readyState === 1) {
        if (!topic || subscriptions.has('*') || subscriptions.has(topic)) {
          ws.send(msg);
        }
      }
    }
  },

  sendTo(clientId, payload) {
    const client = wsClients.get(clientId);
    if (client?.ws?.readyState === 1) {
      client.ws.send(JSON.stringify(payload));
    }
  },

  getClientCount: () => wsClients.size,
};

// Wrapper de compatibilité avec les appels broadcast(event, data) existants
function broadcast(event, data) {
  wsManager.broadcast({ event, data }, event);
}

const ingestPayloadSchema = z.object({
  node_id: z.string().min(1),
  timestamp: z.number().int().optional(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  pressure: z.number().optional(),
  luminosity: z.number().optional(),
  rain_level: z.number().optional(),
  wind_speed: z.number().optional(),
  anomaly_score: z.number().min(0).max(1).optional(),
  is_anomaly: z.union([z.number().int(), z.boolean()]).optional(),
});

async function materializeReading(payload) {
  const timestamp = payload.timestamp || Math.floor(Date.now() / 1000);
  const previous = await getLastSensorReadingForNode(db, payload.node_id);

  const merged = {
    id: require('crypto').randomUUID(),
    node_id: payload.node_id,
    timestamp,
    temperature: payload.temperature || 0,
    humidity: payload.humidity || 0,
    pressure: payload.pressure || 0,
    luminosity: payload.luminosity || 0,
    rain_level: payload.rain_level || 0,
    wind_speed: payload.wind_speed || 0,
  };

  merged.anomaly_score = payload.anomaly_score !== undefined ? payload.anomaly_score : calculateAnomalyScore(merged, previous);

  merged.is_anomaly = payload.is_anomaly !== undefined ? Number(Boolean(payload.is_anomaly)) : merged.anomaly_score >= 0.7 ? 1 : 0;

  return { reading: merged, previous };
}

async function ingestReading(readingPayload, source = 'api', shouldBroadcast = true) {
  const { reading, previous } = await materializeReading(readingPayload);

  // ── AI Engine: analyse approfondie ──────────────────────────────────────
  const aiAnalysis = aiEngine.analyzeReading(reading.node_id, reading, previous);
  reading.anomaly_score = aiAnalysis.anomaly_score;
  reading.is_anomaly = aiAnalysis.is_anomaly ? 1 : 0;
  aiEngine.pushToWindow(reading.node_id, reading);

  const insertedReading = await insertSensorData(db, reading, source);

  // Enrichir la réponse avec les détails IA
  insertedReading.ai_analysis = {
    risk_level: aiAnalysis.risk_level,
    factors: aiAnalysis.factors,
    recommendations: aiAnalysis.recommendations,
  };

  const possibleAlerts = buildAlertsFromReading(insertedReading, previous);
  const createdAlerts = [];

  for (const alert of possibleAlerts) {
    const created = await insertAlert(db, {
      ...alert,
      node_id: insertedReading.node_id,
      timestamp: insertedReading.timestamp,
    });
    if (created) createdAlerts.push(created);
  }

  // Enrichir avec les champs calculés côté backend avant broadcast
  const enriched = enrichReading(insertedReading, previous);
  enriched.ai_analysis = insertedReading.ai_analysis;

  if (shouldBroadcast) {
    broadcast('sensor_data', enriched);
    createdAlerts.forEach((alert) => broadcast('alert', alert));
  }

  return { insertedReading: enriched, createdAlerts };
}

// ─── Clear all sensor_data, alerts, predictions ────────────────────────────
app.delete('/api/data/clear', async (_req, res) => {
  await clearAllData(db);
  sendJson(res, 200, { message: 'All sensor_data, alerts, and predictions cleared' });
});

app.get('/api/health', async (_req, res) => {
  sendJson(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: config.appVersion,
    database: {
      engine: 'mysql',
      mode: db?.runtime?.mode || 'unknown',
      host: db?.runtime?.host || config.mysql.host,
      port: db?.runtime?.port || config.mysql.port,
      name: db?.runtime?.database || config.mysql.database,
    },
  });
});

app.get('/api/nodes', async (_req, res) => {
  await updateNodeStatuses(db);
  sendJson(res, 200, { data: await listNodes(db) });
});

// ─── Liste complète des 10 districts/régions de Côte d'Ivoire ──────────────
const CI_REGIONS = [
  { name: 'Lagunes',            zone: 'Sud',          order: 1 },
  { name: 'Bas-Sassandra',      zone: 'Sud-Ouest',    order: 2 },
  { name: 'Comoé',              zone: 'Est',           order: 3 },
  { name: 'Sassandra-Marahoué', zone: 'Centre-Ouest', order: 4 },
  { name: 'Lacs',               zone: 'Centre',        order: 5 },
  { name: 'Vallée du Bandama',  zone: 'Centre-Nord',  order: 6 },
  { name: 'Montagnes',          zone: 'Ouest',         order: 7 },
  { name: 'Zanzan',             zone: 'Nord-Est',      order: 8 },
  { name: 'Savanes',            zone: 'Nord',          order: 9 },
  { name: 'Denguélé',           zone: 'Nord-Ouest',    order: 10 },
];
const CI_REGION_ORDER = Object.fromEntries(CI_REGIONS.map((r) => [r.name, r.order]));

// ─── Résumé météo par région ────────────────────────────────────────────────
app.get('/api/regions', async (_req, res) => {
  await updateNodeStatuses(db);
  const nodes = await listNodes(db);
  const latestRows = await getLatestSensorDataByNode(db);

  // Index latest data by node_id, enrichie avec les calculs backend
  const latestMap = {};
  latestRows.forEach((r) => { latestMap[r.node_id] = enrichReading(r); });

  // Group nodes by region
  const regionMap = {};
  for (const node of nodes) {
    const key = node.region || node.location || 'Inconnue';
    if (!regionMap[key]) regionMap[key] = { region: key, nodes: [] };
    regionMap[key].nodes.push({ ...node, latest: latestMap[node.id] || null });
  }

  // S'assurer que chaque région CI connue apparaît même sans station
  for (const r of CI_REGIONS) {
    if (!regionMap[r.name]) regionMap[r.name] = { region: r.name, nodes: [] };
  }

  // Compute per-region aggregates
  const regions = Object.values(regionMap).map((r) => {
    const withData = r.nodes.filter((n) => n.latest);
    const temps    = withData.map((n) => n.latest.temperature).filter((v) => v != null);
    const hums     = withData.map((n) => n.latest.humidity).filter((v) => v != null);
    const pressures = withData.map((n) => n.latest.pressure).filter((v) => v != null);
    const winds    = withData.map((n) => n.latest.wind_speed).filter((v) => v != null);
    const rains    = withData.map((n) => n.latest.rain_level).filter((v) => v != null);

    const avg = (arr) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
    const max = (arr) => arr.length ? Math.max(...arr) : null;

    // Calculs de risque côté backend à partir des données agrégées
    let condition_label = null;
    let flood_risk = null;
    let storm_risk = null;
    let overall_risk = null;
    let risk_label_str = null;
    let aqi = null;

    if (withData.length > 0) {
      // On calcule les risques sur un "reading représentatif" de la région (valeurs moyennes)
      const refReading = {
        temperature: avg(temps),
        humidity: avg(hums),
        pressure: avg(pressures),
        wind_speed: avg(winds),
        rain_level: max(rains) ?? 0,
        anomaly_score: avg(withData.map((n) => n.latest.anomaly_score).filter((v) => v != null)) ?? 0,
      };
      const enriched = enrichReading(refReading);
      condition_label = enriched.condition_label;
      flood_risk = enriched.flood_risk;
      storm_risk = enriched.storm_risk;
      overall_risk = enriched.overall_risk;
      risk_label_str = enriched.risk_label;
      aqi = enriched.aqi;
    }

    return {
      region: r.region,
      node_count: r.nodes.length,
      online_count: r.nodes.filter((n) => n.status === 'online').length,
      avg_temperature: avg(temps),
      avg_humidity: avg(hums),
      avg_pressure: avg(pressures),
      max_wind_speed: max(winds),
      max_rain_level: max(rains),
      condition_label,
      flood_risk,
      storm_risk,
      overall_risk,
      risk_label: risk_label_str,
      aqi,
      nodes: r.nodes,
    };
  });

  regions.sort((a, b) => (CI_REGION_ORDER[a.region] || 99) - (CI_REGION_ORDER[b.region] || 99));
  sendJson(res, 200, { data: regions });
});

app.get('/api/nodes/:id', async (req, res) => {
  await updateNodeStatuses(db);
  const node = await getNodeById(db, req.params.id);
  if (!node) {
    return sendJson(res, 404, { error: 'Node not found' });
  }
  const latest = await getLastSensorReadingForNode(db, node.id);
  return sendJson(res, 200, { data: { ...node, latest_data: latest ? enrichReading(latest) : null } });
});

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  firmware_version: z.string().optional(),
  status: z.enum(['online', 'offline']).optional(),
});

app.patch('/api/nodes/:id', async (req, res) => {
  const parsed = updateNodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendJson(res, 400, { error: 'Invalid payload', details: parsed.error.issues });
  }
  const existing = await getNodeById(db, req.params.id);
  if (!existing) {
    return sendJson(res, 404, { error: 'Node not found' });
  }
  const updated = await updateNode(db, req.params.id, parsed.data);
  if (!updated) {
    return sendJson(res, 400, { error: 'No fields to update' });
  }
  broadcast('node_updated', updated);
  return sendJson(res, 200, { message: 'Node updated', data: updated });
});

app.delete('/api/nodes/:id', async (req, res) => {
  const node = await getNodeById(db, req.params.id);
  if (!node) return sendJson(res, 404, { error: 'Node not found' });
  const deleted = await deleteNode(db, req.params.id);
  if (!deleted) return sendJson(res, 500, { error: 'Delete failed' });
  broadcast('node_deleted', { id: req.params.id });
  return sendJson(res, 200, { message: 'Node deleted', id: req.params.id });
});

app.get('/api/sensor-data', async (req, res) => {
  const data = await listSensorData(db, {
    node_id: req.query.node_id,
    from: toUnix(req.query.from),
    to: toUnix(req.query.to),
    limit: req.query.limit,
    interval: req.query.interval,
  });
  sendJson(res, 200, { count: data.length, data });
});

app.get('/api/sensor-data/latest', async (_req, res) => {
  const data = await getLatestSensorDataByNode(db);
  sendJson(res, 200, { data: data.map((r) => enrichReading(r)) });
});

app.get('/api/sensor-data/stats', async (req, res) => {
  const period = req.query.period || '24h';
  const data = await getSensorStats(db, {
    node_id: req.query.node_id,
    period,
  });
  sendJson(res, 200, { period, data });
});

app.post('/api/sensor-data', async (req, res) => {
  const parsed = ingestPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendJson(res, 400, { error: 'Invalid payload', details: parsed.error.issues });
  }

  const node = await getNodeById(db, parsed.data.node_id);
  if (!node) {
    return sendJson(res, 404, { error: `Unknown node '${parsed.data.node_id}'. Register it first via POST /api/sensors/register` });
  }

  const source = req.body.source || 'api';
  const { insertedReading, createdAlerts } = await ingestReading(parsed.data, source, true);
  return sendJson(res, 201, {
    data: insertedReading,
    alerts_created: createdAlerts.length,
  });
});

// POST /api/sensor-data/:node_id — ingest data with node_id from URL path
app.post('/api/sensor-data/:node_id', async (req, res) => {
  const payload = { ...req.body, node_id: req.params.node_id };
  const parsed = ingestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return sendJson(res, 400, { error: 'Invalid payload', details: parsed.error.issues });
  }

  const node = await getNodeById(db, req.params.node_id);
  if (!node) {
    return sendJson(res, 404, { error: `Unknown node '${req.params.node_id}'. Register it first via POST /api/sensors/register` });
  }

  const source = req.body.source || 'api';
  const { insertedReading, createdAlerts } = await ingestReading(parsed.data, source, true);
  return sendJson(res, 201, {
    data: insertedReading,
    alerts_created: createdAlerts.length,
  });
});

const updateSensorDataSchema = z.object({
  temperature: z.number().min(-50).max(80).optional(),
  humidity: z.number().min(0).max(100).optional(),
  pressure: z.number().min(800).max(1200).optional(),
  luminosity: z.number().min(0).optional(),
  rain_level: z.number().min(0).optional(),
  wind_speed: z.number().min(0).optional(),
  anomaly_score: z.number().min(0).max(1).optional(),
  is_anomaly: z.union([z.number().int(), z.boolean()]).optional(),
});

app.patch('/api/sensor-data/:id', async (req, res) => {
  const parsed = updateSensorDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendJson(res, 400, { error: 'Invalid payload', details: parsed.error.issues });
  }

  // Support both sensor_data row ID and node ID (e.g. "node-001")
  let existing = await getSensorDataById(db, req.params.id);
  if (!existing) {
    // Try as a node_id — update the latest reading for that node
    existing = await getLastSensorReadingForNode(db, req.params.id);
  }
  if (!existing) {
    return sendJson(res, 404, { error: 'Sensor data not found' });
  }

  const updated = await updateSensorData(db, existing.id, parsed.data);
  if (!updated) {
    return sendJson(res, 400, { error: 'No fields to update' });
  }
  broadcast('sensor_data_updated', updated);
  return sendJson(res, 200, { message: 'Sensor data updated', data: updated });
});

// ─── Physical Sensor Endpoints ──────────────────────────────────────────────

// Enregistrer un nouveau capteur physique
app.post('/api/sensors/register', async (req, res) => {
  const schema = z.object({
    node_id: z.string().min(1),
    name: z.string().min(1),
    location: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    firmware_version: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendJson(res, 400, { error: 'Invalid payload', details: parsed.error.issues });
  }
  const { node_id, name, location, latitude, longitude, firmware_version } = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  try {
    const existing = await getNodeById(db, node_id);
    if (existing) {
      return sendJson(res, 409, { error: 'Node already exists', data: existing });
    }
    await db.query(
      `INSERT INTO nodes (id, name, location, latitude, longitude, status, firmware_version, last_seen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'online', ?, ?, ?, ?)`,
      [node_id, name, location || null, latitude || null, longitude || null, firmware_version || 'physical-1.0', now, now, now],
    );
    const node = await getNodeById(db, node_id);
    broadcast('node_registered', node);
    return sendJson(res, 201, { message: 'Sensor registered', data: node });
  } catch (err) {
    return sendJson(res, 500, { error: 'Registration failed', details: err.message });
  }
});

// Envoyer température + humidité + pression (endpoint simplifié pour capteurs physiques)
const physicalSensorSchema = z.object({
  node_id: z.string().min(1),
  timestamp: z.number().int().optional(),
  temperature: z.number().min(-50).max(80),
  humidity: z.number().min(0).max(100),
  pressure: z.number().min(800).max(1200),
});

app.post('/api/sensors/data', async (req, res) => {
  const parsed = physicalSensorSchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn(`[CAPTEUR] ⚠️  Payload invalide depuis ${req.ip} :`, parsed.error.issues);
    return sendJson(res, 400, { error: 'Invalid payload', details: parsed.error.issues });
  }
  const { node_id, timestamp, temperature, humidity, pressure } = parsed.data;
  const node = await getNodeById(db, node_id);
  if (!node) {
    console.warn(`[CAPTEUR] ⚠️  Node inconnu '${node_id}' — enregistrement requis`);
    return sendJson(res, 404, { error: `Unknown node '${node_id}'. Register it first via POST /api/sensors/register` });
  }
  const { insertedReading, createdAlerts } = await ingestReading({ node_id, timestamp, temperature, humidity, pressure }, 'physical', true);
  const now = new Date().toLocaleString('fr-FR');
  const anomaly = insertedReading.is_anomaly ? ' 🚨 ANOMALIE DÉTECTÉE' : '';
  console.log(
    `[CAPTEUR] ✅ ${now} | ${node_id} (${node.location || node.name})` +
      `\n         🌡  Temp     : ${temperature} °C` +
      `\n         💧 Humidité : ${humidity} %` +
      `\n         🔵 Pression : ${pressure} hPa` +
      `\n         📊 Anomaly  : ${insertedReading.anomaly_score} (score)${anomaly}` +
      (createdAlerts.length ? `\n         🔔 Alertes  : ${createdAlerts.map((a) => `${a.type} [${a.severity}]`).join(', ')}` : ''),
  );
  return sendJson(res, 201, { data: insertedReading, alerts_created: createdAlerts.length });
});

// Envoi par lot (batch) — plusieurs lectures d'un coup
app.post('/api/sensors/batch', async (req, res) => {
  const batchSchema = z.object({
    node_id: z.string().min(1),
    readings: z
      .array(
        z.object({
          timestamp: z.number().int().optional(),
          temperature: z.number().min(-50).max(80),
          humidity: z.number().min(0).max(100),
          pressure: z.number().min(800).max(1200),
        }),
      )
      .min(1)
      .max(100),
  });
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendJson(res, 400, { error: 'Invalid payload', details: parsed.error.issues });
  }
  const { node_id, readings } = parsed.data;
  const node = await getNodeById(db, node_id);
  if (!node) {
    return sendJson(res, 404, { error: `Unknown node '${node_id}'. Register it first via POST /api/sensors/register` });
  }
  const results = [];
  for (const r of readings) {
    const { insertedReading } = await ingestReading({ node_id, timestamp: r.timestamp, temperature: r.temperature, humidity: r.humidity, pressure: r.pressure }, 'physical', true);
    results.push(insertedReading);
  }
  return sendJson(res, 201, { message: `${results.length} readings ingested`, count: results.length, data: results });
});

// Récupérer les dernières données d'un capteur
app.get('/api/sensors/:nodeId/latest', async (req, res) => {
  const reading = await getLastSensorReadingForNode(db, req.params.nodeId);
  if (!reading) {
    return sendJson(res, 404, { error: 'No data for this node' });
  }
  sendJson(res, 200, { data: reading });
});

// Historique température/humidité/pression d'un capteur
app.get('/api/sensors/:nodeId/history', async (req, res) => {
  const data = await listSensorData(db, {
    node_id: req.params.nodeId,
    from: toUnix(req.query.from),
    to: toUnix(req.query.to),
    limit: req.query.limit || '500',
  });
  const slim = data.map((r) => ({
    timestamp: r.timestamp,
    temperature: r.temperature,
    humidity: r.humidity,
    pressure: r.pressure,
    anomaly_score: r.anomaly_score,
    is_anomaly: r.is_anomaly,
  }));
  sendJson(res, 200, { node_id: req.params.nodeId, count: slim.length, data: slim });
});

// ─── Alerts ────────────────────────────────────────────────────────────────

app.get('/api/alerts', async (req, res) => {
  const data = await listAlerts(db, {
    severity: req.query.severity,
    acknowledged: parseAckQuery(req.query.acknowledged),
    node_id: req.query.node_id,
    limit: req.query.limit,
  });
  sendJson(res, 200, { count: data.length, data });
});

app.patch('/api/alerts/:id/acknowledge', async (req, res) => {
  const alert = await acknowledgeAlert(db, req.params.id);
  if (!alert) {
    return sendJson(res, 404, { error: 'Alert not found' });
  }
  broadcast('alert_acknowledged', alert);
  return sendJson(res, 200, { message: 'Alert acknowledged', data: alert });
});

app.delete('/api/alerts/:id', async (req, res) => {
  const deleted = await deleteAlert(db, req.params.id);
  if (!deleted) {
    return sendJson(res, 404, { error: 'Alert not found' });
  }
  broadcast('alert_deleted', { id: Number(req.params.id) });
  return sendJson(res, 200, { message: 'Alert deleted' });
});

app.get('/api/anomalies', async (req, res) => {
  const data = await listAnomalies(db, {
    node_id: req.query.node_id,
    limit: req.query.limit,
  });
  sendJson(res, 200, { count: data.length, data });
});

app.get('/api/predictions', async (_req, res) => {
  const data = await getLatestPredictions(db);
  sendJson(res, 200, { data });
});

app.get('/api/dashboard/summary', async (_req, res) => {
  await updateNodeStatuses(db);
  const summary = await getDashboardSummary(db);

  // Enrichir le résumé avec les risques calculés côté backend
  const latestAvg = summary.latest || {};
  if (latestAvg.avg_temperature != null) {
    const refReading = {
      temperature: latestAvg.avg_temperature,
      humidity: latestAvg.avg_humidity,
      pressure: latestAvg.avg_pressure,
      wind_speed: latestAvg.avg_wind_speed,
      rain_level: latestAvg.avg_rain_level ?? 0,
      anomaly_score: 0,
    };
    const enriched = enrichReading(refReading);
    summary.condition_label = enriched.condition_label;
    summary.condition_severity = enriched.condition_severity;
    summary.flood_risk = enriched.flood_risk;
    summary.storm_risk = enriched.storm_risk;
    summary.overall_risk = enriched.overall_risk;
    summary.risk_label = enriched.risk_label;
    summary.aqi = enriched.aqi;
    summary.aqi_label = enriched.aqi_label;
  }

  sendJson(res, 200, { data: summary });
});

app.get('/api/ai/metrics', async (_req, res) => {
  const data = await getAIMetrics(db);
  sendJson(res, 200, { data });
});

// ─── AI Engine API ──────────────────────────────────────────────────────────

app.get('/api/ai/analyze/:nodeId', async (req, res) => {
  const reading = await getLastSensorReadingForNode(db, req.params.nodeId);
  if (!reading) return sendJson(res, 404, { error: 'No data for this node' });
  const win = aiEngine.getWindow(req.params.nodeId);
  const prev = win.length >= 2 ? win[win.length - 2] : null;
  const analysis = aiEngine.analyzeReading(req.params.nodeId, reading, prev);
  sendJson(res, 200, { data: { reading, analysis } });
});

app.get('/api/ai/predict/:nodeId', async (req, res) => {
  const predictions = aiEngine.predictForNode(req.params.nodeId);
  if (!predictions) return sendJson(res, 404, { error: 'Not enough data for predictions (need at least 3 readings)' });
  sendJson(res, 200, { data: predictions });
});

app.get('/api/ai/diagnose/:nodeId', async (req, res) => {
  const diag = aiEngine.diagnoseNode(req.params.nodeId);
  sendJson(res, 200, { data: diag });
});

// ─── DB Admin Viewer ────────────────────────────────────────────────────────

app.get('/db-admin/api/tables', async (_req, res) => {
  const [rows] = await db.query('SHOW TABLES');
  const tables = rows.map((r) => Object.values(r)[0]);
  res.json(tables);
});

app.get('/db-admin/api/tables/:table', async (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const [columns] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  const [rows] = await db.query(`SELECT * FROM \`${table}\` ORDER BY 1 DESC LIMIT ? OFFSET ?`, [limit, offset]);
  res.json({ columns: columns.map((c) => c.Field), rows, total, page, limit, pages: Math.ceil(total / limit) });
});

app.get('/db-admin', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>DB Admin — meteo_iot</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column}
  a{color:#60a5fa;text-decoration:none}
  header{background:#1e2230;border-bottom:1px solid #2d3148;padding:14px 24px;display:flex;align-items:center;gap:16px}
  header h1{font-size:1.1rem;font-weight:700;color:#fff}
  header span{font-size:.8rem;background:#2d3148;padding:3px 10px;border-radius:99px;color:#94a3b8}
  .layout{display:flex;flex:1;overflow:hidden}
  nav{width:200px;background:#161928;border-right:1px solid #2d3148;padding:16px 0;overflow-y:auto;flex-shrink:0}
  nav h2{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;padding:0 16px 8px}
  nav ul{list-style:none}
  nav ul li button{width:100%;background:none;border:none;color:#94a3b8;padding:8px 16px;text-align:left;cursor:pointer;font-size:.85rem;display:flex;align-items:center;gap:8px;transition:all .15s}
  nav ul li button:hover{background:#1e2230;color:#e2e8f0}
  nav ul li button.active{background:#1d3461;color:#60a5fa;font-weight:600}
  nav ul li button .badge{margin-left:auto;background:#2d3148;color:#64748b;font-size:.7rem;padding:1px 6px;border-radius:99px}
  main{flex:1;overflow-y:auto;overflow-x:hidden;padding:24px}
  .empty{color:#64748b;text-align:center;padding:60px 0;font-size:.95rem}
  .table-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap}
  .table-header h2{font-size:1rem;font-weight:600;display:flex;align-items:center;gap:8px}
  .table-header .info{font-size:.8rem;color:#64748b}
  .pagination{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .pagination button{background:#1e2230;border:1px solid #2d3148;color:#94a3b8;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:.8rem;transition:all .15s}
  .pagination button:hover:not(:disabled){background:#2d3148;color:#e2e8f0}
  .pagination button:disabled{opacity:.4;cursor:default}
  .pagination button.active{background:#1d3461;border-color:#3b5998;color:#60a5fa}
  .search-bar{background:#1e2230;border:1px solid #2d3148;border-radius:8px;padding:6px 12px;color:#e2e8f0;font-size:.85rem;width:220px}
  .search-bar::placeholder{color:#475569}
  .search-bar:focus{outline:none;border-color:#3b82f6}
  table{width:max-content;min-width:100%;border-collapse:collapse;font-size:.82rem}
  thead tr{background:#161928;position:sticky;top:0;z-index:1}
  thead th{padding:10px 12px;text-align:left;font-weight:600;color:#94a3b8;border-bottom:1px solid #2d3148;white-space:nowrap;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}
  tbody tr{border-bottom:1px solid #1e2230;transition:background .1s}
  tbody tr:hover{background:#1e2230}
  tbody td{padding:9px 12px;vertical-align:top;white-space:nowrap}
  .null{color:#475569;font-style:italic}
  .num{color:#86efac;font-variant-numeric:tabular-nums}
  .bool-1{color:#34d399}
  .bool-0{color:#f87171}
  .tag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:.72rem;font-weight:600}
  .tag-online,.tag-active{background:#14532d;color:#4ade80}
  .tag-offline{background:#450a0a;color:#f87171}
  .tag-warning{background:#451a03;color:#fb923c}
  .tag-critical{background:#3b0764;color:#e879f9}
  .tag-info{background:#172554;color:#60a5fa}
  .tag-simulator,.tag-seed,.tag-api,.tag-lstm-sim{background:#1e2230;color:#64748b}
  .loader{text-align:center;padding:40px;color:#64748b}
  .spinner{display:inline-block;width:20px;height:20px;border:2px solid #2d3148;border-top-color:#3b82f6;border-radius:50%;animation:spin .7s linear infinite;margin-right:8px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px}
  .stat-card{background:#1e2230;border:1px solid #2d3148;border-radius:10px;padding:16px}
  .stat-card .label{font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
  .stat-card .value{font-size:1.6rem;font-weight:700;color:#e2e8f0}
  .stat-card .sub{font-size:.75rem;color:#64748b;margin-top:4px}
</style>
</head>
<body>
<header>
  <h1>⚡ DB Admin</h1>
  <span id="dbInfo">meteo_iot</span>
  <span id="dbMode" style="color:#34d399"></span>
</header>
<div class="layout">
  <nav>
    <h2>Tables</h2>
    <ul id="tableList"><li><div class="loader"><span class="spinner"></span></div></li></ul>
  </nav>
  <main id="mainContent">
    <div class="empty">← Sélectionne une table</div>
  </main>
</div>
<script>
const BASE = '/db-admin/api';
let currentTable = null;
let currentPage = 1;
let filterText = '';
let allRows = [];

async function loadTables() {
  const res = await fetch(BASE + '/tables');
  const tables = await res.json();
  const ul = document.getElementById('tableList');
  ul.innerHTML = '';
  for (const t of tables) {
    const li = document.createElement('li');
    li.innerHTML = \`<button onclick="openTable('\${t}')" id="btn-\${t}"><span>📋</span>\${t}<span class="badge" id="count-\${t}">…</span></button>\`;
    ul.appendChild(li);
    fetchCount(t);
  }
}

async function fetchCount(table) {
  try {
    const res = await fetch(\`\${BASE}/tables/\${table}?limit=1&page=1\`);
    const d = await res.json();
    const el = document.getElementById('count-' + table);
    if (el) el.textContent = d.total.toLocaleString('fr');
  } catch(e) {}
}

async function openTable(table, page = 1) {
  currentTable = table;
  currentPage = page;
  filterText = '';
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-' + table);
  if (btn) btn.classList.add('active');
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="loader"><span class="spinner"></span>Chargement…</div>';
  const res = await fetch(\`\${BASE}/tables/\${table}?page=\${page}&limit=50\`);
  const d = await res.json();
  allRows = d.rows;
  renderTable(d);
}

function renderTable(d) {
  const main = document.getElementById('mainContent');
  const rows = filterText ? allRows.filter(r => JSON.stringify(r).toLowerCase().includes(filterText.toLowerCase())) : allRows;
  let pagesHtml = '';
  for (let i = 1; i <= Math.min(d.pages, 20); i++) {
    pagesHtml += \`<button onclick="openTable('\${currentTable}',\${i})" class="\${i===d.page?'active':''}">\${i}</button>\`;
  }
  if (d.pages > 20) pagesHtml += \`<span style="color:#64748b;font-size:.8rem">… \${d.pages} pages</span>\`;

  const rowsHtml = rows.map(r =>
    '<tr>' + d.columns.map(c => '<td title="' + esc(String(r[c]??'')) + '">' + fmt(c, r[c]) + '</td>').join('') + '</tr>'
  ).join('');

  main.innerHTML = \`
    <div class="table-header">
      <h2>📋 \${currentTable} <span style="font-weight:400;color:#64748b">\${d.total.toLocaleString('fr')} lignes</span></h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input class="search-bar" placeholder="Filtrer…" value="\${filterText}" oninput="onFilter(this.value)" />
        <div class="info">\${d.columns.length} colonnes · page \${d.page}/\${d.pages}</div>
      </div>
    </div>
    <div class="pagination" style="margin-bottom:16px">
      <button onclick="openTable('\${currentTable}',\${d.page-1})" \${d.page<=1?'disabled':''}>‹ Préc</button>
      \${pagesHtml}
      <button onclick="openTable('\${currentTable}',\${d.page+1})" \${d.page>=d.pages?'disabled':''}>Suiv ›</button>
    </div>
    <div style="overflow-x:auto;border-radius:10px;border:1px solid #2d3148">
      <table>
        <thead><tr>\${d.columns.map(c=>'<th>'+c+'</th>').join('')}</tr></thead>
        <tbody>\${rowsHtml || '<tr><td colspan="'+d.columns.length+'" class="empty">Aucun résultat</td></tr>'}</tbody>
      </table>
    </div>
  \`;
}

function onFilter(v) {
  filterText = v;
  const rows = filterText ? allRows.filter(r => JSON.stringify(r).toLowerCase().includes(filterText.toLowerCase())) : allRows;
  document.querySelector('tbody').innerHTML = rows.map(r =>
    '<tr>' + Object.keys(allRows[0]||{}).map(c => '<td title="' + esc(String(r[c]??'')) + '">' + fmt(c, r[c]) + '</td>').join('') + '</tr>'
  ).join('') || '<tr><td colspan="20" class="empty">Aucun résultat</td></tr>';
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

function fmt(col, val) {
  if (val === null || val === undefined) return '<span class="null">NULL</span>';
  const s = String(val);
  if (col === 'status') return \`<span class="tag tag-\${s}">\${s}</span>\`;
  if (col === 'severity') return \`<span class="tag tag-\${s}">\${s}</span>\`;
  if (col === 'source') return \`<span class="tag tag-\${s}">\${s}</span>\`;
  if (col === 'acknowledged' || col === 'is_anomaly') return val == 1 ? '<span class="bool-1">✓ oui</span>' : '<span class="bool-0">✗ non</span>';
  if (col === 'timestamp' || col === 'created_at' || col === 'updated_at' || col === 'last_seen') {
    const d = new Date(Number(s) * 1000);
    return isNaN(d) ? s : '<span class="num" title="' + s + '">' + d.toLocaleString('fr-FR') + '</span>';
  }
  if (!isNaN(s) && s.trim() !== '') return '<span class="num">' + esc(s) + '</span>';
  return esc(s.length > 80 ? s.slice(0,80)+'…' : s);
}

loadTables();
</script>
</body>
</html>`);
});

// ─── SPA Fallback (en production, toute route non-API sert index.html) ────
if (fs.existsSync(FRONTEND_DIST)) {
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/db-admin')) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// ─── 404 & Error handlers ────────────────────────────────────────────────────

app.use((req, res) => {
  sendJson(res, 404, { error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  sendJson(res, 500, { error: 'Internal server error' });
});

wsManager.init(wss);

async function seedHistoricalDataIfNeeded() {
  const [[{ cnt }]] = await db.query('SELECT COUNT(*) AS cnt FROM sensor_data');
  if (Number(cnt) > 0) return; // Des données existent déjà

  const STEP_SEC = 15 * 60;   // lecture toutes les 15 minutes
  const HIST_SEC = 24 * 3600; // 24 heures d'historique
  const now      = Math.floor(Date.now() / 1000);
  const nodes    = await listNodes(db);
  const prevByNode = {};
  let total = 0;

  for (let t = now - HIST_SEC; t < now; t += STEP_SEC) {
    for (const node of nodes) {
      const r = generateSensorReading(node.id, t, prevByNode[node.id] || null);
      prevByNode[node.id] = r;
      await insertSensorData(db, r, 'seed');
      total++;
    }
  }
  console.log(`[SEED] ${total} lectures historiques générées (${nodes.length} stations × 24h/15min)`);
  await refreshPredictions(db);
}

async function bootstrap() {
  db = await createDatabase(config.mysql);

  // ── MQTT : connexion au broker pour recevoir les données ESP32 ──────────
  if (process.env.MQTT_ENABLED !== 'false') {
    mqttService.init({ db, ingestReading, broadcast, updateNode, insertAlert });
  }

  server.listen(config.port, config.host, () => {
    console.log(`Meteo backend running on http://${config.host}:${config.port}`);
    console.log(`MySQL mode: ${db.runtime.mode}`);
    console.log(`MySQL: ${db.runtime.user}@${db.runtime.host}:${db.runtime.port}/${db.runtime.database}`);
    if (fs.existsSync(FRONTEND_DIST)) {
      console.log(`Frontend: serving from ${FRONTEND_DIST}`);
    } else {
      console.log(`Frontend: dist not found — use Vite dev server or run "npm run build" in frontend/`);
    }
  });

  // ── Données historiques (premier démarrage sans données) ────
  await seedHistoricalDataIfNeeded();

  // ── Simulation des capteurs ─────────────────────────────────
  // Actif par défaut (30s). Désactiver avec SIMULATION_INTERVAL_MS=0
  const SIM_MS = parseInt(process.env.SIMULATION_INTERVAL_MS ?? '30000');
  if (SIM_MS > 0) {
    const prevReadings = {};
    const runSim = async () => {
      try {
        const nodes = await listNodes(db);
        for (const node of nodes) {
          const reading = generateSensorReading(
            node.id,
            Math.floor(Date.now() / 1000),
            prevReadings[node.id] || null
          );
          prevReadings[node.id] = reading;
          await ingestReading(reading, 'simulator');
        }
        // Rafraîchir les prédictions de temps en temps (~1 cycle sur 10)
        if (Math.random() < 0.1) await refreshPredictions(db).catch(() => {});
      } catch (e) {
        console.error('[SIM] Erreur:', e.message);
      }
    };
    // Première lecture immédiate au démarrage
    await runSim();
    setInterval(runSim, SIM_MS);
    console.log(`[SIM] Simulation activée — intervalle ${SIM_MS / 1000}s`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error.message);
  process.exit(1);
});

async function shutdown() {
  try {
    await db?.closeDatabase?.();
  } catch (error) {
    console.error('Database shutdown error:', error.message);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
