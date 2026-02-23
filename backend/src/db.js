const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const { createDB: createEmbeddedMySQL } = require('mysql-memory-server');
const { buildPredictionSet } = require('./generator');

const BACKEND_ROOT = path.resolve(__dirname, '..');

const DEFAULT_NODES = [
  {
    id: 'node-001',
    name: 'Station Alpha',
    location: 'Site Nord',
    latitude: 5.354,
    longitude: -4.004,
    status: 'online',
    firmware_version: 'v1.2.0',
  },
  {
    id: 'node-002',
    name: 'Station Beta',
    location: 'Site Sud',
    latitude: 5.28,
    longitude: -3.98,
    status: 'online',
    firmware_version: 'v1.1.5',
  },
  {
    id: 'node-003',
    name: 'Station Gamma',
    location: 'Site Est',
    latitude: 5.39,
    longitude: -3.95,
    status: 'offline',
    firmware_version: 'v1.0.8',
  },
];

function parseIntervalToSeconds(interval) {
  if (!interval || typeof interval !== 'string') return null;
  const match = interval.trim().match(/^(\d+)(m|h|d)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return amount * 86400;
}

function parsePeriodToSeconds(period) {
  const map = {
    '1h': 3600,
    '6h': 6 * 3600,
    '24h': 24 * 3600,
    '7d': 7 * 86400,
    '30d': 30 * 86400,
  };
  return map[period] || map['24h'];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeNode(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    status: row.status,
    firmware_version: row.firmware_version,
    last_seen: Number(row.last_seen),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at || 0),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnectTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(900);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

async function waitForMysqlPort({ host, port, timeoutMs = 45_000, childProcess = null }) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const reachable = await canConnectTcp(host, port);
    if (reachable) return;

    if (childProcess && childProcess.exitCode !== null) {
      throw new Error(`mysqld exited with code ${childProcess.exitCode}`);
    }
    await delay(400);
  }
  throw new Error(`timeout while waiting for mysql on ${host}:${port}`);
}

function resolveLocalMysqlPackage() {
  const packageNames = ['mysql-server-5.7-osx-x64', 'mysql-server-8-osx-x64'];
  for (const packageName of packageNames) {
    try {
      const pkgJsonPath = require.resolve(`${packageName}/package.json`);
      const packageDir = path.dirname(pkgJsonPath);
      const serverDir = path.join(packageDir, 'server');
      const mysqldPath = path.join(serverDir, 'mysqld');
      if (fs.existsSync(mysqldPath)) {
        return { packageName, packageDir, serverDir, mysqldPath };
      }
    } catch (_error) {
      // continue
    }
  }
  return null;
}

function initializeLocalMysqlIfNeeded({ mysqldPath, serverDir, dataDir }) {
  if (fs.existsSync(path.join(dataDir, 'mysql'))) return;

  fs.mkdirSync(dataDir, { recursive: true });
  const initArgs = ['--initialize-insecure', '--explicit_defaults_for_timestamp', `--basedir=${serverDir}`, `--datadir=${dataDir}`];

  const initResult = spawnSync(mysqldPath, initArgs, { encoding: 'utf8' });
  if (initResult.status !== 0) {
    throw new Error(`local mysqld initialization failed: ${initResult.stderr || initResult.stdout || 'unknown error'}`);
  }
}

async function startLocalEmbeddedMysql(mysqlConfig) {
  const resolved = resolveLocalMysqlPackage();
  if (!resolved) {
    throw new Error('no local mysql binary package found');
  }

  const runtimeRoot = path.join(BACKEND_ROOT, 'data', 'mysql-local-runtime');
  const dataDir = path.join(runtimeRoot, 'data');
  const tmpDir = path.join(runtimeRoot, 'tmp');
  const pidFile = path.join(runtimeRoot, 'mysql.pid');
  const errorLogFile = path.join(runtimeRoot, 'mysql.err');

  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  initializeLocalMysqlIfNeeded({
    mysqldPath: resolved.mysqldPath,
    serverDir: resolved.serverDir,
    dataDir,
  });

  const runtimePort = Number(mysqlConfig.embeddedPort || mysqlConfig.port || 3307);
  const dbName = mysqlConfig.embeddedDbName || mysqlConfig.database || 'meteo_iot';

  const args = [
    '--explicit_defaults_for_timestamp',
    `--basedir=${resolved.serverDir}`,
    `--datadir=${dataDir}`,
    `--port=${runtimePort}`,
    '--socket=',
    `--pid-file=${pidFile}`,
    '--bind-address=127.0.0.1',
    `--tmpdir=${tmpDir}`,
    '--skip-networking=0',
    `--log-error=${errorLogFile}`,
  ];

  if (resolved.packageName.includes('8-osx-x64')) {
    args.push('--mysqlx=OFF');
  }

  const mysqldProcess = spawn(resolved.mysqldPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrTail = '';
  mysqldProcess.stderr.on('data', (chunk) => {
    stderrTail = `${stderrTail}${chunk.toString()}`.slice(-4000);
  });

  await waitForMysqlPort({
    host: '127.0.0.1',
    port: runtimePort,
    timeoutMs: 45_000,
    childProcess: mysqldProcess,
  });

  const bootstrapConnection = await mysql.createConnection({
    host: '127.0.0.1',
    port: runtimePort,
    user: 'root',
    password: '',
  });
  await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await bootstrapConnection.end();

  return {
    mode: 'embedded-local',
    host: '127.0.0.1',
    port: runtimePort,
    user: 'root',
    password: '',
    database: dbName,
    stop: async () => {
      try {
        const shutdownConnection = await mysql.createConnection({
          host: '127.0.0.1',
          port: runtimePort,
          user: 'root',
          password: '',
        });
        await shutdownConnection.query('SHUTDOWN');
        await shutdownConnection.end();
      } catch (_error) {
        if (mysqldProcess.exitCode === null) {
          mysqldProcess.kill('SIGTERM');
        }
      }
      await Promise.race([new Promise((resolve) => mysqldProcess.once('exit', resolve)), delay(3000)]);
    },
    diagnostic: stderrTail,
  };
}

async function startMemoryEmbeddedMysql(mysqlConfig) {
  const embeddedServer = await createEmbeddedMySQL({
    version: mysqlConfig.embeddedVersion,
    dbName: mysqlConfig.embeddedDbName || mysqlConfig.database || 'meteo_iot',
    username: mysqlConfig.user || 'root',
    logLevel: 'ERROR',
    xEnabled: 'OFF',
  });

  return {
    mode: 'embedded-memory',
    host: '127.0.0.1',
    port: embeddedServer.port,
    user: embeddedServer.username,
    password: '',
    database: embeddedServer.dbName,
    stop: () => embeddedServer.stop(),
    diagnostic: '',
  };
}

async function createDatabase(mysqlConfig) {
  let runtime;

  if (mysqlConfig.embedded) {
    try {
      runtime = await startLocalEmbeddedMysql(mysqlConfig);
    } catch (localError) {
      try {
        runtime = await startMemoryEmbeddedMysql(mysqlConfig);
      } catch (memoryError) {
        throw new Error(`unable to start embedded mysql (local: ${localError.message}; memory: ${memoryError.message})`);
      }
    }
  } else {
    const bootstrapConnection = await mysql.createConnection({
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
    });

    await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await bootstrapConnection.end();

    runtime = {
      mode: 'external',
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      database: mysqlConfig.database,
      stop: async () => {},
      diagnostic: '',
    };
  }

  const db = mysql.createPool({
    host: runtime.host,
    port: runtime.port,
    user: runtime.user,
    password: runtime.password,
    database: runtime.database,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
  });

  db.runtime = {
    mode: runtime.mode,
    host: runtime.host,
    port: runtime.port,
    user: runtime.user,
    database: runtime.database,
  };
  db.closeDatabase = async () => {
    await db.end();
    await runtime.stop();
  };

  await initSchema(db);
  await seedDatabase(db);
  return db;
}

async function ensureColumn(db, table, column, definition) {
  const [cols] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (cols.length === 0) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function initSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nodes (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      location VARCHAR(255),
      latitude DECIMAL(10,6),
      longitude DECIMAL(10,6),
      status ENUM('online','offline') NOT NULL DEFAULT 'offline',
      firmware_version VARCHAR(64),
      last_seen BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sensor_data (
      id VARCHAR(64) PRIMARY KEY,
      node_id VARCHAR(64) NOT NULL,
      timestamp BIGINT NOT NULL,
      temperature DECIMAL(6,2) NOT NULL,
      humidity DECIMAL(6,2) NOT NULL,
      pressure DECIMAL(7,2) NOT NULL,
      luminosity DECIMAL(10,2) NOT NULL,
      rain_level DECIMAL(8,2) NOT NULL,
      wind_speed DECIMAL(6,2) NOT NULL,
      anomaly_score DECIMAL(6,3) NOT NULL DEFAULT 0,
      is_anomaly TINYINT(1) NOT NULL DEFAULT 0,
      source VARCHAR(32) NOT NULL DEFAULT 'api',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      CONSTRAINT fk_sensor_node FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id VARCHAR(64) PRIMARY KEY,
      node_id VARCHAR(64) NOT NULL,
      timestamp BIGINT NOT NULL,
      type VARCHAR(32) NOT NULL,
      severity ENUM('info','warning','critical') NOT NULL,
      message TEXT NOT NULL,
      acknowledged TINYINT(1) NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      CONSTRAINT fk_alert_node FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id VARCHAR(64) PRIMARY KEY,
      node_id VARCHAR(64),
      timestamp BIGINT NOT NULL,
      horizon_hours INT NOT NULL,
      predicted_temp DECIMAL(6,2) NOT NULL,
      predicted_humidity DECIMAL(6,2) NOT NULL,
      predicted_pressure DECIMAL(7,2) NOT NULL,
      extreme_event_probability DECIMAL(6,3) NOT NULL,
      event_type VARCHAR(64),
      source VARCHAR(32) NOT NULL DEFAULT 'lstm-sim',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB;
  `);

  // Auto-migrate: add updated_at to existing tables (distant DB compatibility)
  const tables = ['nodes', 'sensor_data', 'alerts', 'predictions'];
  for (const table of tables) {
    await ensureColumn(db, table, 'updated_at', 'BIGINT NOT NULL DEFAULT 0');
  }

  await ensureIndex(db, 'sensor_data', 'idx_sensor_node_time', 'CREATE INDEX idx_sensor_node_time ON sensor_data(node_id, timestamp DESC)');
  await ensureIndex(db, 'sensor_data', 'idx_sensor_time', 'CREATE INDEX idx_sensor_time ON sensor_data(timestamp DESC)');
  await ensureIndex(db, 'alerts', 'idx_alerts_time', 'CREATE INDEX idx_alerts_time ON alerts(timestamp DESC)');
  await ensureIndex(db, 'alerts', 'idx_alerts_ack', 'CREATE INDEX idx_alerts_ack ON alerts(acknowledged, timestamp DESC)');
  await ensureIndex(db, 'predictions', 'idx_predictions_horizon_time', 'CREATE INDEX idx_predictions_horizon_time ON predictions(horizon_hours, timestamp DESC)');
}

async function ensureIndex(db, tableName, indexName, createIndexSql) {
  const [rows] = await db.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (rows.length === 0) {
    await db.query(createIndexSql);
  }
}

async function seedDatabase(db) {
  await seedNodesIfNeeded(db);
}

async function seedNodesIfNeeded(db) {
  const [rows] = await db.query('SELECT COUNT(*) AS count FROM nodes');
  if (rows[0].count > 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const node of DEFAULT_NODES) {
    await db.query(
      `
      INSERT INTO nodes (id, name, location, latitude, longitude, status, firmware_version, last_seen, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [node.id, node.name, node.location, node.latitude, node.longitude, node.status, node.firmware_version, node.status === 'online' ? now : now - 3700, now, now],
    );
  }
}

async function listNodes(db) {
  const [rows] = await db.query('SELECT * FROM nodes ORDER BY name ASC');
  return rows.map(normalizeNode);
}

async function getNodeById(db, nodeId) {
  const [rows] = await db.query('SELECT * FROM nodes WHERE id = ? LIMIT 1', [nodeId]);
  return rows[0] ? normalizeNode(rows[0]) : null;
}

async function touchNode(db, nodeId, timestampSec = Math.floor(Date.now() / 1000)) {
  await db.query("UPDATE nodes SET last_seen = ?, status = 'online', updated_at = ? WHERE id = ?", [timestampSec, Math.floor(Date.now() / 1000), nodeId]);
}

async function updateNode(db, nodeId, fields) {
  const allowedFields = ['name', 'location', 'latitude', 'longitude', 'firmware_version', 'status'];
  const setClauses = [];
  const values = [];

  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      setClauses.push(`\`${key}\` = ?`);
      values.push(fields[key]);
    }
  }

  if (setClauses.length === 0) return null;

  const now = Math.floor(Date.now() / 1000);
  setClauses.push('updated_at = ?');
  values.push(now);
  values.push(nodeId);

  const [result] = await db.query(`UPDATE nodes SET ${setClauses.join(', ')} WHERE id = ?`, values);

  if (!result.affectedRows) return null;
  return getNodeById(db, nodeId);
}

async function updateNodeStatuses(db, offlineAfterSec = 120) {
  const now = Math.floor(Date.now() / 1000);
  await db.query("UPDATE nodes SET status = CASE WHEN (? - last_seen) > ? THEN 'offline' ELSE 'online' END, updated_at = ?", [now, offlineAfterSec, now]);
}

async function insertSensorData(db, reading, source = 'api') {
  const now = Math.floor(Date.now() / 1000);
  const timestamp = reading.timestamp || now;
  const temperature = reading.temperature;
  const humidity = reading.humidity;
  const pressure = reading.pressure;
  const luminosity = reading.luminosity;
  const rain_level = reading.rain_level;
  const wind_speed = reading.wind_speed;
  const anomaly_score = reading.anomaly_score ?? 0;
  const is_anomaly = reading.is_anomaly ? 1 : 0;

  // Upsert: one row per node — update if exists, insert if not
  const existing = await getLastSensorReadingForNode(db, reading.node_id);

  if (existing) {
    await db.query(
      `UPDATE sensor_data
       SET timestamp = ?, temperature = ?, humidity = ?, pressure = ?,
           luminosity = ?, rain_level = ?, wind_speed = ?,
           anomaly_score = ?, is_anomaly = ?, source = ?, updated_at = ?
       WHERE id = ?`,
      [timestamp, temperature, humidity, pressure, luminosity, rain_level, wind_speed, anomaly_score, is_anomaly, source, now, existing.id],
    );
    await touchNode(db, reading.node_id, timestamp);
    return {
      id: existing.id,
      node_id: reading.node_id,
      timestamp,
      temperature,
      humidity,
      pressure,
      luminosity,
      rain_level,
      wind_speed,
      anomaly_score,
      is_anomaly,
      source,
      created_at: existing.created_at,
      updated_at: now,
    };
  }

  const id = reading.id || crypto.randomUUID();
  await db.query(
    `INSERT INTO sensor_data (
      id, node_id, timestamp, temperature, humidity, pressure, luminosity,
      rain_level, wind_speed, anomaly_score, is_anomaly, source, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, reading.node_id, timestamp, temperature, humidity, pressure, luminosity, rain_level, wind_speed, anomaly_score, is_anomaly, source, now, now],
  );

  await touchNode(db, reading.node_id, timestamp);
  return {
    id,
    node_id: reading.node_id,
    timestamp,
    temperature,
    humidity,
    pressure,
    luminosity,
    rain_level,
    wind_speed,
    anomaly_score,
    is_anomaly,
    source,
    created_at: now,
    updated_at: now,
  };
}

async function clearAllData(db) {
  await db.query('DELETE FROM alerts');
  await db.query('DELETE FROM predictions');
  await db.query('DELETE FROM sensor_data');
}

async function getSensorDataById(db, id) {
  const [rows] = await db.query(
    `SELECT id, node_id, timestamp, temperature, humidity, pressure, luminosity,
            rain_level, wind_speed, anomaly_score, is_anomaly, source, created_at, updated_at
     FROM sensor_data WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function updateSensorData(db, id, fields) {
  const allowedFields = ['temperature', 'humidity', 'pressure', 'luminosity', 'rain_level', 'wind_speed', 'anomaly_score', 'is_anomaly'];
  const setClauses = [];
  const values = [];

  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      setClauses.push(`\`${key}\` = ?`);
      values.push(key === 'is_anomaly' ? (fields[key] ? 1 : 0) : fields[key]);
    }
  }

  if (setClauses.length === 0) return null;

  const now = Math.floor(Date.now() / 1000);
  setClauses.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const [result] = await db.query(`UPDATE sensor_data SET ${setClauses.join(', ')} WHERE id = ?`, values);

  if (!result.affectedRows) return null;
  return getSensorDataById(db, id);
}

async function getLastSensorReadingForNode(db, nodeId) {
  const [rows] = await db.query(
    `
      SELECT
        id, node_id, timestamp, temperature, humidity, pressure, luminosity,
        rain_level, wind_speed, anomaly_score, is_anomaly, created_at, updated_at
      FROM sensor_data
      WHERE node_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `,
    [nodeId],
  );
  return rows[0] || null;
}

async function listSensorData(db, filters = {}) {
  const { node_id: nodeId, from, to, limit = 200, interval } = filters;
  const whereParts = [];
  const params = [];

  if (nodeId) {
    whereParts.push('node_id = ?');
    params.push(nodeId);
  }
  if (from) {
    whereParts.push('timestamp >= ?');
    params.push(Number(from));
  }
  if (to) {
    whereParts.push('timestamp <= ?');
    params.push(Number(to));
  }

  const maxLimit = Math.min(Number(limit) || 200, 1000);
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const bucketSec = parseIntervalToSeconds(interval);

  if (bucketSec) {
    const bucket = Number(bucketSec);
    const bucketExpr = `FLOOR(timestamp / ${bucket}) * ${bucket}`;
    const [rows] = await db.query(
      `
      SELECT
        CONCAT(node_id, '-', ${bucketExpr}) AS id,
        node_id,
        ${bucketExpr} AS timestamp,
        ROUND(AVG(temperature), 1) AS temperature,
        ROUND(AVG(humidity), 1) AS humidity,
        ROUND(AVG(pressure), 1) AS pressure,
        ROUND(AVG(luminosity), 0) AS luminosity,
        ROUND(AVG(rain_level), 2) AS rain_level,
        ROUND(AVG(wind_speed), 1) AS wind_speed,
        ROUND(MAX(anomaly_score), 3) AS anomaly_score,
        MAX(is_anomaly) AS is_anomaly
      FROM sensor_data
      ${whereSql}
      GROUP BY node_id, ${bucketExpr}
      ORDER BY timestamp DESC
      LIMIT ?
      `,
      [...params, maxLimit],
    );
    return rows;
  }

  const [rows] = await db.query(
    `
      SELECT
        id, node_id, timestamp, temperature, humidity, pressure, luminosity,
        rain_level, wind_speed, anomaly_score, is_anomaly, created_at, updated_at
      FROM sensor_data
      ${whereSql}
      ORDER BY timestamp DESC
      LIMIT ?
    `,
    [...params, maxLimit],
  );
  return rows;
}

async function getLatestSensorDataByNode(db) {
  const [rows] = await db.query(`
    SELECT sd.*
    FROM sensor_data sd
    INNER JOIN (
      SELECT node_id, MAX(timestamp) AS max_ts
      FROM sensor_data
      GROUP BY node_id
    ) latest ON latest.node_id = sd.node_id AND latest.max_ts = sd.timestamp
    ORDER BY sd.node_id ASC
  `);
  return rows;
}

async function getSensorStats(db, { node_id: nodeId, period = '24h' } = {}) {
  const seconds = parsePeriodToSeconds(period);
  const fromTs = Math.floor(Date.now() / 1000) - seconds;

  const whereParts = ['timestamp >= ?'];
  const params = [fromTs];
  if (nodeId) {
    whereParts.push('node_id = ?');
    params.push(nodeId);
  }
  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [rows] = await db.query(
    `
    SELECT
      ROUND(AVG(temperature), 1) AS avg_temp,
      ROUND(MIN(temperature), 1) AS min_temp,
      ROUND(MAX(temperature), 1) AS max_temp,
      ROUND(AVG(humidity), 1) AS avg_humidity,
      ROUND(MIN(humidity), 1) AS min_humidity,
      ROUND(MAX(humidity), 1) AS max_humidity,
      ROUND(AVG(pressure), 1) AS avg_pressure,
      ROUND(MIN(pressure), 1) AS min_pressure,
      ROUND(MAX(pressure), 1) AS max_pressure,
      ROUND(AVG(wind_speed), 1) AS avg_wind_speed,
      ROUND(MAX(wind_speed), 1) AS max_wind_speed,
      ROUND(SUM(rain_level), 2) AS total_rain,
      ROUND(MAX(anomaly_score), 3) AS peak_anomaly_score,
      SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) AS anomaly_count,
      COUNT(*) AS sample_count
    FROM sensor_data
    ${whereSql}
  `,
    params,
  );

  return rows[0];
}

async function insertAlert(db, alertPayload) {
  const now = Math.floor(Date.now() / 1000);
  const timestamp = alertPayload.timestamp || now;

  const [dupes] = await db.query(
    `
    SELECT id
    FROM alerts
    WHERE node_id = ? AND type = ? AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT 1
    `,
    [alertPayload.node_id, alertPayload.type, timestamp - 20 * 60],
  );

  if (dupes[0]) return null;

  const row = {
    id: crypto.randomUUID(),
    node_id: alertPayload.node_id,
    timestamp,
    type: alertPayload.type,
    severity: alertPayload.severity,
    message: alertPayload.message,
    acknowledged: 0,
    created_at: now,
    updated_at: now,
  };

  await db.query(
    `
    INSERT INTO alerts (id, node_id, timestamp, type, severity, message, acknowledged, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [row.id, row.node_id, row.timestamp, row.type, row.severity, row.message, row.acknowledged, row.created_at, row.updated_at],
  );

  return row;
}

async function listAlerts(db, filters = {}) {
  const { severity, acknowledged, node_id: nodeId, limit = 200 } = filters;
  const where = [];
  const params = [];

  if (severity) {
    where.push('severity = ?');
    params.push(severity);
  }
  if (acknowledged !== undefined) {
    where.push('acknowledged = ?');
    params.push(Number(acknowledged) ? 1 : 0);
  }
  if (nodeId) {
    where.push('node_id = ?');
    params.push(nodeId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const maxLimit = Math.min(Number(limit) || 200, 1000);
  const [rows] = await db.query(
    `
      SELECT id, node_id, timestamp, type, severity, message, acknowledged, created_at, updated_at
      FROM alerts
      ${whereSql}
      ORDER BY timestamp DESC
      LIMIT ?
    `,
    [...params, maxLimit],
  );
  return rows;
}

async function acknowledgeAlert(db, alertId) {
  const now = Math.floor(Date.now() / 1000);
  const [result] = await db.query('UPDATE alerts SET acknowledged = 1, updated_at = ? WHERE id = ?', [now, alertId]);
  if (!result.affectedRows) return null;

  const [rows] = await db.query('SELECT id, node_id, timestamp, type, severity, message, acknowledged, created_at, updated_at FROM alerts WHERE id = ?', [alertId]);
  return rows[0] || null;
}

async function listAnomalies(db, filters = {}) {
  const { node_id: nodeId, limit = 100 } = filters;
  const where = ['(is_anomaly = 1 OR anomaly_score >= 0.7)'];
  const params = [];

  if (nodeId) {
    where.push('node_id = ?');
    params.push(nodeId);
  }

  const maxLimit = Math.min(Number(limit) || 100, 500);
  const [rows] = await db.query(
    `
      SELECT
        id, node_id, timestamp, temperature, humidity, pressure, rain_level, wind_speed,
        anomaly_score, is_anomaly
      FROM sensor_data
      WHERE ${where.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ?
    `,
    [...params, maxLimit],
  );
  return rows;
}

async function refreshPredictions(db) {
  const now = Math.floor(Date.now() / 1000);
  const latestNodeReading = await getLastSensorReadingForNode(db, 'node-001');
  const preds = buildPredictionSet(latestNodeReading);

  const cleanupBefore = now - 14 * 86400;
  await db.query('DELETE FROM predictions WHERE timestamp < ?', [cleanupBefore]);

  for (const pred of preds) {
    await db.query(
      `
      INSERT INTO predictions (
        id, node_id, timestamp, horizon_hours, predicted_temp, predicted_humidity,
        predicted_pressure, extreme_event_probability, event_type, source, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [crypto.randomUUID(), 'node-001', now, pred.horizon_hours, pred.predicted_temp, pred.predicted_humidity, pred.predicted_pressure, pred.extreme_event_probability, pred.event_type, 'lstm-sim', now, now],
    );
  }

  return preds;
}

async function getLatestPredictions(db) {
  const [rows] = await db.query(`
      SELECT p.horizon_hours, p.predicted_temp, p.predicted_humidity,
             p.predicted_pressure, p.extreme_event_probability, p.event_type
      FROM predictions p
      INNER JOIN (
        SELECT horizon_hours, MAX(timestamp) AS latest_ts
        FROM predictions
        GROUP BY horizon_hours
      ) latest
      ON latest.horizon_hours = p.horizon_hours AND latest.latest_ts = p.timestamp
      ORDER BY p.horizon_hours ASC
    `);
  return rows;
}

async function getDashboardSummary(db) {
  const [nodesRows] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online
    FROM nodes
  `);

  const [alertsRows] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN severity = 'critical' AND acknowledged = 0 THEN 1 ELSE 0 END) AS critical_active
    FROM alerts
  `);

  const [latestRows] = await db.query(`
    SELECT
      ROUND(AVG(temperature), 1) AS avg_temperature,
      ROUND(AVG(humidity), 1) AS avg_humidity,
      ROUND(AVG(pressure), 1) AS avg_pressure,
      ROUND(AVG(wind_speed), 1) AS avg_wind_speed,
      ROUND(AVG(rain_level), 2) AS avg_rain_level,
      ROUND(AVG(luminosity), 0) AS avg_luminosity
    FROM (
      SELECT sd.*
      FROM sensor_data sd
      INNER JOIN (
        SELECT node_id, MAX(timestamp) AS max_ts
        FROM sensor_data
        GROUP BY node_id
      ) latest ON latest.node_id = sd.node_id AND latest.max_ts = sd.timestamp
    ) x
  `);

  const [readingsRows] = await db.query('SELECT COUNT(*) AS total FROM sensor_data');

  const nodes = nodesRows[0] || {};
  const alerts = alertsRows[0] || {};
  const latest = latestRows[0] || {};
  const readings = readingsRows[0] || {};

  return {
    nodes: {
      total: Number(nodes.total || 0),
      online: Number(nodes.online || 0),
      offline: Number((nodes.total || 0) - (nodes.online || 0)),
    },
    alerts: {
      total: Number(alerts.total || 0),
      active: Number(alerts.active || 0),
      critical_active: Number(alerts.critical_active || 0),
    },
    latest: latest || {},
    readings: {
      total: Number(readings.total || 0),
    },
  };
}

async function getAIMetrics(db) {
  const now = Math.floor(Date.now() / 1000);
  const from24h = now - 24 * 3600;

  const [anomalyRows] = await db.query(
    `
      SELECT
        COUNT(*) AS sample_count,
        SUM(CASE WHEN is_anomaly = 1 OR anomaly_score >= 0.7 THEN 1 ELSE 0 END) AS anomaly_count,
        AVG(anomaly_score) AS avg_anomaly_score,
        MAX(anomaly_score) AS peak_anomaly_score
      FROM sensor_data
      WHERE timestamp >= ?
    `,
    [from24h],
  );

  const [predictionRows] = await db.query(
    `
      SELECT
        AVG(extreme_event_probability) AS avg_risk,
        MAX(extreme_event_probability) AS peak_risk
      FROM (
        SELECT p.*
        FROM predictions p
        INNER JOIN (
          SELECT horizon_hours, MAX(timestamp) AS latest_ts
          FROM predictions
          GROUP BY horizon_hours
        ) latest ON latest.horizon_hours = p.horizon_hours AND latest.latest_ts = p.timestamp
      ) x
    `,
  );

  const stats = anomalyRows[0] || {};
  const pred = predictionRows[0] || {};
  const sampleCount = Number(stats.sample_count || 0);
  const anomalyCount = Number(stats.anomaly_count || 0);
  const avgAnomalyScore = Number(stats.avg_anomaly_score || 0);
  const peakAnomalyScore = Number(stats.peak_anomaly_score || 0);
  const avgRisk = Number(pred.avg_risk || 0);
  const peakRisk = Number(pred.peak_risk || 0);
  const anomalyRate = sampleCount > 0 ? anomalyCount / sampleCount : 0;

  const precision = Number(clamp(93 - anomalyRate * 25 - avgRisk * 8, 78, 98).toFixed(1));
  const recall = Number(clamp(86 + anomalyRate * 18 + peakAnomalyScore * 4, 75, 97).toFixed(1));
  const f1 = Number(((2 * precision * recall) / (precision + recall)).toFixed(1));
  const latencyMs = Number(clamp(110 + avgAnomalyScore * 180 + anomalyRate * 120, 95, 260).toFixed(0));
  const memoryKb = Number(clamp(180 + peakAnomalyScore * 60, 170, 256).toFixed(0));

  const maeTemp = Number(clamp(0.9 + avgRisk * 1.8 + anomalyRate * 1.1, 0.7, 4.0).toFixed(1));
  const maePressure = Number(clamp(2.8 + avgRisk * 8 + anomalyRate * 6, 2, 12).toFixed(1));
  const maeHumidity = Number(clamp(3 + avgRisk * 9 + anomalyRate * 7, 2, 14).toFixed(1));
  const extremeAccuracy = Number(clamp(95 - avgRisk * 12 - anomalyRate * 10, 72, 98).toFixed(1));

  return {
    embedded_model: {
      name: 'Autoencoder TinyML',
      status: 'active',
      precision,
      recall,
      f1_score: f1,
      inference_latency_ms: latencyMs,
      memory_footprint_kb: memoryKb,
    },
    cloud_model: {
      name: 'LSTM Forecast',
      status: 'active',
      mae_temp: maeTemp,
      mae_pressure: maePressure,
      mae_humidity: maeHumidity,
      extreme_event_accuracy: extremeAccuracy,
      retrain_policy: 'weekly-auto',
    },
    realtime: {
      anomaly_threshold: 70,
      sample_count_24h: sampleCount,
      anomaly_count_24h: anomalyCount,
      avg_anomaly_score_24h: Number(avgAnomalyScore.toFixed(3)),
      peak_anomaly_score_24h: Number(peakAnomalyScore.toFixed(3)),
      avg_risk_probability: Number(avgRisk.toFixed(3)),
      peak_risk_probability: Number(peakRisk.toFixed(3)),
    },
  };
}

module.exports = {
  acknowledgeAlert,
  createDatabase,
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
  touchNode,
  updateNode,
  updateNodeStatuses,
  updateSensorData,
};
