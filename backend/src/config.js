const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

const config = {
  port: Number(process.env.PORT || 3600),
  host: process.env.HOST || '0.0.0.0',
  mysql: {
    embedded: String(process.env.MYSQL_EMBEDDED || 'true').toLowerCase() !== 'false',
    embeddedVersion: process.env.MYSQL_EMBEDDED_VERSION || '8.4.x',
    embeddedDbName: process.env.MYSQL_EMBEDDED_DBNAME || 'meteo_iot',
    embeddedPort: Number(process.env.MYSQL_EMBEDDED_PORT || 3307),
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'meteo_iot',
  },
  appVersion: '1.0.0',
};

module.exports = { config };
