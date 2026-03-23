import { useState } from 'react';
import Badge  from '../components/ui/Badge';

const T = {
  str: 'string', num: 'number', int: 'integer', bool: 'boolean',
  obj: 'object', arr: 'array', unix: 'unix timestamp', dec: 'decimal', enum: 'enum',
};

const METHOD_COLOR = {
  GET:    '#22c55e',
  POST:   '#3b82f6',
  PATCH:  '#f97316',
  DELETE: '#ef4444',
  WS:     '#a855f7',
};

const TYPE_COLOR = (type) => {
  if (type === T.str || type === T.enum) return '#f59e0b';
  if ([T.num, T.int, T.dec, T.unix].includes(type)) return '#22c55e';
  if (type === T.bool) return '#a855f7';
  if (type === T.arr || type === T.obj) return '#3b82f6';
  return '#64748b';
};

const ENDPOINTS = [
  {
    method: 'GET', path: '/api/health',
    desc: "Vérification de l'état du serveur et de la connexion base de données.",
    params: [],
    body: null,
    response: [
      { field: 'success',         type: T.bool, desc: 'Statut de la requête' },
      { field: 'status',          type: T.str,  desc: '"ok" si le serveur fonctionne' },
      { field: 'timestamp',       type: T.str,  desc: 'Date ISO 8601 du serveur' },
      { field: 'version',         type: T.str,  desc: "Version de l'application" },
      { field: 'database.engine', type: T.str,  desc: 'Moteur de base de données' },
      { field: 'database.mode',   type: T.str,  desc: 'Mode : embedded-local | external' },
    ],
    example: `{ "success": true, "status": "ok", "timestamp": "2026-02-23T10:00:00.000Z", "version": "1.0.0", "database": { "engine": "mysql", "mode": "external", "host": "srv1579.hstgr.io", "port": 3306 } }`,
  },
  {
    method: 'GET', path: '/api/nodes',
    desc: 'Retourne la liste de toutes les stations IoT enregistrées avec leur statut actuel.',
    params: [],
    body: null,
    response: [
      { field: 'success', type: T.bool, desc: 'Statut de la requête' },
      { field: 'data[]',  type: T.arr,  desc: 'Liste des stations', children: [
        { field: 'id',               type: T.str,  desc: 'Identifiant unique (ex: node-001)' },
        { field: 'name',             type: T.str,  desc: 'Nom de la station' },
        { field: 'location',         type: T.str,  desc: 'Emplacement physique' },
        { field: 'latitude',         type: T.dec,  desc: 'Latitude GPS (DECIMAL 10,6)' },
        { field: 'longitude',        type: T.dec,  desc: 'Longitude GPS (DECIMAL 10,6)' },
        { field: 'status',           type: T.enum, desc: '"online" | "offline"' },
        { field: 'firmware_version', type: T.str,  desc: 'Version du firmware embarqué' },
        { field: 'last_seen',        type: T.unix, desc: 'Dernier contact (secondes Unix)' },
      ]},
    ],
    example: `{ "success": true, "data": [{ "id": "node-001", "name": "Station Alpha", "location": "Site Nord", "latitude": 5.354, "longitude": -4.004, "status": "online", "firmware_version": "v1.2.0", "last_seen": 1740300000 }] }`,
  },
  {
    method: 'GET', path: '/api/nodes/:id',
    desc: "Détails d'une station spécifique avec ses dernières données capteur.",
    params: [{ name: ':id', in: 'path', type: T.str, required: true, desc: 'Identifiant de la station (ex: node-001)' }],
    body: null,
    response: [
      { field: 'success',         type: T.bool, desc: 'Statut' },
      { field: 'data.id',         type: T.str,  desc: 'Identifiant' },
      { field: 'data.status',     type: T.enum, desc: '"online" | "offline"' },
      { field: 'data.latest_data',type: T.obj,  desc: 'Dernière mesure capteur (ou null)' },
    ],
    example: `{ "success": true, "data": { "id": "node-001", "name": "Station Alpha", "status": "online", "latest_data": { "temperature": 29.3, "humidity": 68.1 } } }`,
  },
  {
    method: 'PATCH', path: '/api/nodes/:id',
    desc: "Mettre à jour les informations d'une station IoT.",
    params: [{ name: ':id', in: 'path', type: T.str, required: true, desc: 'Identifiant de la station' }],
    body: [
      { field: 'name',             type: T.str,  required: false, desc: 'Nouveau nom' },
      { field: 'location',         type: T.str,  required: false, desc: 'Nouvel emplacement' },
      { field: 'latitude',         type: T.num,  required: false, desc: 'Latitude GPS (-90 à 90)' },
      { field: 'longitude',        type: T.num,  required: false, desc: 'Longitude GPS (-180 à 180)' },
      { field: 'firmware_version', type: T.str,  required: false, desc: 'Version firmware' },
      { field: 'status',           type: T.enum, required: false, desc: '"online" | "offline"' },
    ],
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'message', type: T.str,  desc: '"Node updated"' },
      { field: 'data',    type: T.obj,  desc: 'Station mise à jour (schéma Node complet)' },
    ],
    example: `{ "success": true, "message": "Node updated", "data": { "id": "node-001", "name": "Station Alpha V2", "status": "online", "updated_at": 1740310000 } }`,
  },
  {
    method: 'GET', path: '/api/sensor-data',
    desc: 'Données des capteurs avec filtrage par station, période et agrégation temporelle.',
    params: [
      { name: 'node_id',  in: 'query', type: T.str,  required: false, desc: 'Filtrer par station' },
      { name: 'from',     in: 'query', type: T.unix, required: false, desc: 'Timestamp Unix début' },
      { name: 'to',       in: 'query', type: T.unix, required: false, desc: 'Timestamp Unix fin' },
      { name: 'limit',    in: 'query', type: T.int,  required: false, desc: 'Nombre max (défaut: 200, max: 1000)' },
      { name: 'interval', in: 'query', type: T.str,  required: false, desc: 'Agrégation : "5m", "1h", "1d"' },
    ],
    body: null,
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'count',   type: T.int,  desc: 'Nombre de résultats' },
      { field: 'data[]',  type: T.arr,  desc: 'Liste des mesures', children: [
        { field: 'id',            type: T.str,  desc: 'Identifiant unique' },
        { field: 'node_id',       type: T.str,  desc: 'Station source' },
        { field: 'timestamp',     type: T.unix, desc: 'Horodatage de la mesure' },
        { field: 'temperature',   type: T.dec,  desc: 'Température en °C' },
        { field: 'humidity',      type: T.dec,  desc: 'Humidité relative en %' },
        { field: 'pressure',      type: T.dec,  desc: 'Pression atmosphérique en hPa' },
        { field: 'wind_speed',    type: T.dec,  desc: 'Vitesse du vent en m/s' },
        { field: 'rain_level',    type: T.dec,  desc: 'Pluie en mm/h' },
        { field: 'luminosity',    type: T.dec,  desc: 'Luminosité en lux' },
        { field: 'anomaly_score', type: T.dec,  desc: "Score d'anomalie IA (0.0–1.0)" },
        { field: 'is_anomaly',    type: T.bool, desc: '1 si anomalie, 0 sinon' },
      ]},
    ],
    example: `{ "success": true, "count": 2, "data": [{ "id": "abc-123", "node_id": "node-001", "timestamp": 1740300000, "temperature": 29.3, "humidity": 68.1, "pressure": 1012.5, "anomaly_score": 0.12, "is_anomaly": 0 }] }`,
  },
  {
    method: 'GET', path: '/api/sensor-data/latest',
    desc: 'Dernière mesure enregistrée pour chaque station active.',
    params: [], body: null,
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'data[]',  type: T.arr,  desc: 'Dernière mesure par station (schéma complet)' },
    ],
    example: `{ "success": true, "data": [{ "node_id": "node-001", "temperature": 30.1, "humidity": 65.3 }] }`,
  },
  {
    method: 'GET', path: '/api/sensor-data/stats',
    desc: 'Statistiques agrégées (moyennes, min, max) sur une période donnée.',
    params: [
      { name: 'period',  in: 'query', type: T.str, required: false, desc: '"1h" | "6h" | "24h" | "7d" | "30d"' },
      { name: 'node_id', in: 'query', type: T.str, required: false, desc: 'Filtrer par station' },
    ],
    body: null,
    response: [
      { field: 'success',               type: T.bool, desc: 'Statut' },
      { field: 'period',                type: T.str,  desc: 'Période demandée' },
      { field: 'data.avg_temp',         type: T.dec,  desc: 'Température moyenne' },
      { field: 'data.min_temp',         type: T.dec,  desc: 'Température minimale' },
      { field: 'data.max_temp',         type: T.dec,  desc: 'Température maximale' },
      { field: 'data.peak_anomaly_score', type: T.dec, desc: 'Score anomalie max' },
    ],
    example: `{ "success": true, "period": "24h", "data": { "avg_temp": 28.4, "min_temp": 22.1, "max_temp": 36.1, "avg_humidity": 72.3, "sample_count": 144 } }`,
  },
  {
    method: 'POST', path: '/api/sensor-data',
    desc: "Ingestion manuelle d'une mesure. Déclenche l'analyse IA et la génération d'alertes.",
    params: [],
    body: [
      { field: 'node_id',     type: T.str, required: true,  desc: 'Identifiant de la station source' },
      { field: 'temperature', type: T.num, required: false, desc: 'Température en °C' },
      { field: 'humidity',    type: T.num, required: false, desc: 'Humidité en %' },
      { field: 'pressure',    type: T.num, required: false, desc: 'Pression en hPa' },
      { field: 'luminosity',  type: T.num, required: false, desc: 'Luminosité en lux' },
      { field: 'rain_level',  type: T.num, required: false, desc: 'Pluie en mm/h' },
      { field: 'wind_speed',  type: T.num, required: false, desc: 'Vent en m/s' },
    ],
    response: [
      { field: 'success',        type: T.bool, desc: 'Statut' },
      { field: 'data',           type: T.obj,  desc: 'Mesure insérée avec analyse IA' },
      { field: 'alerts_created', type: T.int,  desc: "Nombre d'alertes générées" },
    ],
    example: `{ "success": true, "data": { "id": "uuid", "node_id": "node-001", "temperature": 38.5, "anomaly_score": 0.82, "is_anomaly": 1, "ai_analysis": { "risk_level": "high" } }, "alerts_created": 1 }`,
  },
  {
    method: 'PATCH', path: '/api/sensor-data/:id',
    desc: 'Mettre à jour une mesure capteur existante par son ID.',
    params: [{ name: ':id', in: 'path', type: T.str, required: true, desc: 'Identifiant unique de la mesure (UUID)' }],
    body: [
      { field: 'temperature',   type: T.num,  required: false, desc: 'Température en °C (-50 à 80)' },
      { field: 'humidity',      type: T.num,  required: false, desc: 'Humidité en % (0 à 100)' },
      { field: 'pressure',      type: T.num,  required: false, desc: 'Pression en hPa (800 à 1200)' },
      { field: 'anomaly_score', type: T.num,  required: false, desc: "Score d'anomalie (0.0–1.0)" },
      { field: 'is_anomaly',    type: T.bool, required: false, desc: 'Flag anomalie (0 ou 1)' },
    ],
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'message', type: T.str,  desc: '"Sensor data updated"' },
      { field: 'data',    type: T.obj,  desc: 'Mesure mise à jour' },
    ],
    example: `{ "success": true, "message": "Sensor data updated", "data": { "id": "abc-123", "temperature": 31.5, "updated_at": 1740310000 } }`,
  },
  {
    method: 'POST', path: '/api/sensors/register',
    desc: 'Enregistrer une nouvelle station/capteur physique.',
    params: [],
    body: [
      { field: 'node_id',          type: T.str, required: true,  desc: 'Identifiant unique de la station' },
      { field: 'name',             type: T.str, required: true,  desc: 'Nom de la station' },
      { field: 'location',         type: T.str, required: false, desc: 'Emplacement physique' },
      { field: 'latitude',         type: T.num, required: false, desc: 'Latitude GPS' },
      { field: 'longitude',        type: T.num, required: false, desc: 'Longitude GPS' },
      { field: 'firmware_version', type: T.str, required: false, desc: 'Version firmware' },
    ],
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'message', type: T.str,  desc: 'Message de confirmation' },
      { field: 'data',    type: T.obj,  desc: 'Station créée (schéma Node complet)' },
    ],
    example: `{ "success": true, "message": "Sensor registered", "data": { "id": "esp32-01", "name": "Capteur Labo", "status": "online", "created_at": 1740300000 } }`,
  },
  {
    method: 'POST', path: '/api/sensors/data',
    desc: 'Endpoint simplifié pour capteurs physiques (ESP32).',
    params: [],
    body: [
      { field: 'node_id',     type: T.str, required: true,  desc: 'Identifiant de la station' },
      { field: 'temperature', type: T.num, required: true,  desc: 'Température en °C' },
      { field: 'humidity',    type: T.num, required: true,  desc: 'Humidité en %' },
      { field: 'pressure',    type: T.num, required: true,  desc: 'Pression en hPa' },
      { field: 'timestamp',   type: T.int, required: false, desc: 'Horodatage Unix (défaut: maintenant)' },
    ],
    response: [
      { field: 'success',        type: T.bool, desc: 'Statut' },
      { field: 'data',           type: T.obj,  desc: 'Mesure insérée' },
      { field: 'alerts_created', type: T.int,  desc: "Nombre d'alertes générées" },
    ],
    example: `{ "success": true, "data": { "id": "uuid", "node_id": "esp32-01", "temperature": 31.2, "humidity": 74.5, "pressure": 1010.3, "anomaly_score": 0.15 }, "alerts_created": 0 }`,
  },
  {
    method: 'POST', path: '/api/sensors/batch',
    desc: "Envoi par lot — plusieurs lectures d'un coup (max 100).",
    params: [],
    body: [
      { field: 'node_id',     type: T.str, required: true, desc: 'Identifiant de la station' },
      { field: 'readings[]',  type: T.arr, required: true, desc: 'Tableau de mesures (1–100)', children: [
        { field: 'temperature', type: T.num, required: true, desc: 'Température en °C' },
        { field: 'humidity',    type: T.num, required: true, desc: 'Humidité en %' },
        { field: 'pressure',    type: T.num, required: true, desc: 'Pression en hPa' },
      ]},
    ],
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'count',   type: T.int,  desc: 'Nombre de mesures insérées' },
      { field: 'data[]',  type: T.arr,  desc: 'Mesures insérées' },
    ],
    example: `{ "success": true, "message": "3 readings ingested", "count": 3, "data": [{ "id": "uuid", "temperature": 30.1 }] }`,
  },
  {
    method: 'GET', path: '/api/alerts',
    desc: 'Liste des alertes avec filtrage par sévérité, statut et station.',
    params: [
      { name: 'severity',     in: 'query', type: T.str, required: false, desc: '"info" | "warning" | "critical"' },
      { name: 'acknowledged', in: 'query', type: T.str, required: false, desc: '"0" (actives) | "1" (acquittées)' },
      { name: 'node_id',      in: 'query', type: T.str, required: false, desc: 'Filtrer par station' },
      { name: 'limit',        in: 'query', type: T.int, required: false, desc: 'Nombre max (défaut: 200)' },
    ],
    body: null,
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'count',   type: T.int,  desc: 'Nombre de résultats' },
      { field: 'data[]',  type: T.arr,  desc: 'Liste des alertes', children: [
        { field: 'id',           type: T.str,  desc: "Identifiant unique" },
        { field: 'node_id',      type: T.str,  desc: 'Station source' },
        { field: 'type',         type: T.str,  desc: 'Type (TEMP_HIGH, RAIN, ANOMALY…)' },
        { field: 'severity',     type: T.enum, desc: '"info" | "warning" | "critical"' },
        { field: 'message',      type: T.str,  desc: 'Message descriptif' },
        { field: 'acknowledged', type: T.bool, desc: '1 si acquittée, 0 sinon' },
      ]},
    ],
    example: `{ "success": true, "count": 3, "data": [{ "id": "uuid", "type": "TEMP_HIGH", "severity": "critical", "message": "Température élevée: 42.3°C", "acknowledged": 0 }] }`,
  },
  {
    method: 'PATCH', path: '/api/alerts/:id/acknowledge',
    desc: 'Acquitter une alerte active.',
    params: [{ name: ':id', in: 'path', type: T.str, required: true, desc: "Identifiant de l'alerte" }],
    body: null,
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'message', type: T.str,  desc: '"Alert acknowledged"' },
      { field: 'data',    type: T.obj,  desc: 'Alerte mise à jour' },
    ],
    example: `{ "success": true, "message": "Alert acknowledged", "data": { "id": "uuid", "acknowledged": 1, "updated_at": 1740310000 } }`,
  },
  {
    method: 'GET', path: '/api/predictions',
    desc: 'Dernières prévisions LSTM pour chaque horizon temporel (3h, 6h, 12h, 24h).',
    params: [], body: null,
    response: [
      { field: 'success', type: T.bool, desc: 'Statut' },
      { field: 'data[]',  type: T.arr,  desc: 'Prévisions par horizon', children: [
        { field: 'horizon_hours',             type: T.int, desc: 'Horizon (3, 6, 12, 24)' },
        { field: 'predicted_temp',            type: T.dec, desc: 'Température prédite en °C' },
        { field: 'predicted_humidity',        type: T.dec, desc: 'Humidité prédite en %' },
        { field: 'predicted_pressure',        type: T.dec, desc: 'Pression prédite en hPa' },
        { field: 'extreme_event_probability', type: T.dec, desc: 'Probabilité événement extrême (0–1)' },
      ]},
    ],
    example: `{ "success": true, "data": [{ "horizon_hours": 6, "predicted_temp": 33.8, "predicted_humidity": 71.2, "extreme_event_probability": 0.18 }] }`,
  },
  {
    method: 'GET', path: '/api/ai/metrics',
    desc: 'Métriques de performance des modèles IA embarqué (TinyML) et cloud (LSTM).',
    params: [], body: null,
    response: [
      { field: 'success',                   type: T.bool, desc: 'Statut' },
      { field: 'data.embedded_model',       type: T.obj,  desc: 'TinyML — précision, rappel, F1, latence' },
      { field: 'data.cloud_model',          type: T.obj,  desc: 'LSTM — MAE temp/pression/humidité' },
      { field: 'data.realtime',             type: T.obj,  desc: 'Stats 24h — seuil, échantillons, anomalies' },
    ],
    example: `{ "success": true, "data": { "embedded_model": { "precision": 89.1, "recall": 91.3, "f1_score": 90.2 }, "cloud_model": { "mae_temp": 1.4 }, "realtime": { "anomaly_threshold": 70 } } }`,
  },
  {
    method: 'GET', path: '/api/dashboard/summary',
    desc: 'Résumé agrégé pour le tableau de bord principal.',
    params: [], body: null,
    response: [
      { field: 'success',                type: T.bool, desc: 'Statut' },
      { field: 'data.nodes.total',       type: T.int,  desc: 'Nombre total de stations' },
      { field: 'data.nodes.online',      type: T.int,  desc: 'Stations en ligne' },
      { field: 'data.alerts.active',     type: T.int,  desc: 'Alertes non acquittées' },
      { field: 'data.readings.total',    type: T.int,  desc: 'Lectures en base' },
    ],
    example: `{ "success": true, "data": { "nodes": { "total": 3, "online": 2 }, "alerts": { "active": 3 }, "readings": { "total": 5420 } } }`,
  },
  {
    method: 'WS', path: 'ws://host:port',
    desc: 'WebSocket temps réel. Événements : sensor_data, alert, alert_acknowledged, predictions, heartbeat.',
    params: [],
    body: [
      { field: 'action',   type: T.str, required: true,  desc: '"subscribe" | "unsubscribe" | "ping"' },
      { field: 'topics[]', type: T.arr, required: false, desc: '"sensor_data", "alert", "*"' },
    ],
    response: [
      { field: 'event', type: T.str, desc: "Type d'événement" },
      { field: 'data',  type: T.obj, desc: "Données", children: [
        { field: '(sensor_data)', type: T.obj, desc: 'Mesure complète avec champs capteur' },
        { field: '(alert)',       type: T.obj, desc: 'Alerte avec severity, message' },
        { field: '(predictions)', type: T.arr, desc: 'Nouvelles prévisions LSTM' },
        { field: '(heartbeat)',   type: T.obj, desc: '{ ts, clients } — toutes les 30s' },
      ]},
    ],
    example: `{ "event": "sensor_data", "data": { "node_id": "node-001", "temperature": 29.1, "anomaly_score": 0.12, "is_anomaly": 0 } }`,
  },
];

function FieldRow({ field, type, desc, required, indent = 0 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(160px, 1.2fr) 100px 2fr',
        gap: 8,
        padding: `5px 10px 5px ${10 + indent * 18}px`,
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 12,
        alignItems: 'center',
      }}
    >
      <code style={{ color: 'var(--text)', fontWeight: 500, fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
        {field}
        {required && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
      </code>
      <span style={{ color: TYPE_COLOR(type), fontSize: 10, fontWeight: 600 }}>{type}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{desc}</span>
    </div>
  );
}

function SchemaSection({ title, color, fields }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color, textTransform: 'uppercase', marginBottom: 5, padding: '0 2px' }}>
        {title}
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1.2fr) 100px 2fr', gap: 8, padding: '5px 10px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>Champ</span><span>Type</span><span>Description</span>
        </div>
        {fields.map((f, j) => (
          <div key={j}>
            <FieldRow field={f.field || f.name} type={f.type} desc={f.desc} required={f.required} indent={0} />
            {f.children?.map((child, k) => (
              <FieldRow key={k} field={child.field || child.name} type={child.type} desc={child.desc} required={child.required} indent={1} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function APIPage() {
  const [copied,   setCopied]   = useState(null);
  const [expanded, setExpanded] = useState({});

  const toggle = (i) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));
  const copy   = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Documentation API</div>
          <div className="page-subtitle">Référence complète des endpoints REST &amp; WebSocket</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Badge color="var(--green)"      bg="var(--green-dim)">REST</Badge>
          <Badge color="var(--purple)"     bg="var(--purple-dim)">WebSocket</Badge>
          <Badge color="var(--text-muted)" bg="var(--border)">{ENDPOINTS.length} endpoints</Badge>
        </div>
      </div>

      {/* Base URL */}
      <div className="card" style={{ padding: 20, marginBottom: 14 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Base URL</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
          <code style={{ color: 'var(--green)', fontSize: 13, flex: 1, fontFamily: 'DM Mono, monospace' }}>
            http://localhost:3600/api
          </code>
          <button
            onClick={() => copy('http://localhost:3600/api', 'base')}
            style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent)44', borderRadius: 6, cursor: 'pointer' }}
          >
            {copied === 'base' ? '✓ Copié' : 'Copier'}
          </button>
        </div>
      </div>

      {/* Endpoints */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ENDPOINTS.map((ep, i) => {
          const isOpen   = !!expanded[i];
          const mc       = METHOD_COLOR[ep.method] || '#64748b';
          return (
            <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              {/* Row Header */}
              <button
                onClick={() => toggle(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px', cursor: 'pointer', background: isOpen ? `${mc}08` : 'transparent',
                  borderBottom: isOpen ? '1px solid var(--border)' : 'none', textAlign: 'left',
                  transition: 'background 0.12s', borderRadius: 0,
                }}
              >
                <span style={{ minWidth: 52, textAlign: 'center', fontSize: 10, fontWeight: 700, color: mc, background: `${mc}15`, border: `1px solid ${mc}44`, borderRadius: 5, padding: '2px 4px', fontFamily: 'DM Mono, monospace' }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 13, color: 'var(--text)', flex: 1, fontFamily: 'DM Mono, monospace', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ep.path}
                </code>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ep.desc.split('.')[0]}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: 12, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▾</span>
              </button>

              {isOpen && (
                <div style={{ padding: '14px 16px' }} className="fade-in">
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                    {ep.desc}
                  </p>

                  {ep.params.length > 0 && (
                    <SchemaSection title="Paramètres"                    color="var(--yellow)" fields={ep.params}   />
                  )}
                  {ep.body && (
                    <SchemaSection title={ep.method === 'WS' ? 'Message (envoi)' : 'Corps de la requête'} color="var(--orange)" fields={ep.body} />
                  )}
                  <SchemaSection title="Réponse"                         color="var(--green)"  fields={ep.response} />

                  {/* Example */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Exemple de réponse
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copy(ep.example, `ex-${i}`); }}
                        style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer' }}
                      >
                        {copied === `ex-${i}` ? '✓ Copié' : 'Copier'}
                      </button>
                    </div>
                    <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', overflow: 'auto', maxHeight: 180 }}>
                      <pre style={{ fontSize: 11, color: 'var(--green)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5, fontFamily: 'DM Mono, monospace' }}>
                        {ep.example}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
