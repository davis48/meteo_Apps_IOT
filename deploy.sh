#!/bin/bash
# ════════════════════════════════════════════════════════════
# MeteoIoT — Script de déploiement VPS (Ubuntu/Debian)
# Exécuter en tant que root ou avec sudo
# ════════════════════════════════════════════════════════════
set -e

echo "══════════════════════════════════════════════"
echo "  MeteoIoT — Installation VPS"
echo "══════════════════════════════════════════════"

# ─── 1. Mise à jour système ──────────────────────────────────────────────────
echo "[1/7] Mise à jour système..."
apt update && apt upgrade -y

# ─── 2. Installation Node.js 20 LTS ─────────────────────────────────────────
echo "[2/7] Installation Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node: $(node -v) | npm: $(npm -v)"

# ─── 3. Installation MySQL 8 ────────────────────────────────────────────────
echo "[3/7] Installation MySQL 8..."
if ! command -v mysql &> /dev/null; then
  apt install -y mysql-server
  systemctl enable mysql
  systemctl start mysql
fi

# ─── 4. Configuration MySQL ─────────────────────────────────────────────────
echo "[4/7] Configuration base de données..."
MYSQL_PASSWORD=${MYSQL_PASSWORD:-"MeteoIoT_2026!"}

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS meteo_iot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'meteo_user'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON meteo_iot.* TO 'meteo_user'@'localhost';
FLUSH PRIVILEGES;
EOF
echo "   Base meteo_iot créée, utilisateur meteo_user configuré"

# ─── 5. Installation du projet ───────────────────────────────────────────────
echo "[5/7] Installation des dépendances..."
APP_DIR=${APP_DIR:-"/opt/meteo-iot"}

if [ ! -d "$APP_DIR" ]; then
  echo "   Clonage du dépôt..."
  git clone https://github.com/davis48/meteo_Apps_IOT.git "$APP_DIR"
fi

cd "$APP_DIR"
npm install --workspaces --include-dev

# ─── 6. Build frontend ──────────────────────────────────────────────────────
echo "[6/7] Build du frontend..."
cd frontend
npm run build
cd ..

# ─── 7. Configuration .env ──────────────────────────────────────────────────
echo "[7/7] Configuration .env production..."
cat > backend/.env <<ENVFILE
PORT=3002
HOST=0.0.0.0
MYSQL_EMBEDDED=false
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=meteo_user
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=meteo_iot
SIMULATION_INTERVAL_MS=10000
ENVFILE

# ─── 8. Service systemd ─────────────────────────────────────────────────────
echo "Configuration du service systemd..."
cat > /etc/systemd/system/meteo-iot.service <<SERVICE
[Unit]
Description=MeteoIoT Platform
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable meteo-iot
systemctl restart meteo-iot

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ MeteoIoT INSTALLÉ ET DÉMARRÉ !"
echo "══════════════════════════════════════════════"
echo ""
echo "  Dashboard : http://$(hostname -I | awk '{print $1}'):3002"
echo "  API       : http://$(hostname -I | awk '{print $1}'):3002/api/health"
echo "  DB Admin  : http://$(hostname -I | awk '{print $1}'):3002/db-admin"
echo "  WebSocket : ws://$(hostname -I | awk '{print $1}'):3002"
echo ""
echo "  Commandes utiles :"
echo "    systemctl status meteo-iot    # Statut"
echo "    journalctl -u meteo-iot -f    # Logs en temps réel"
echo "    systemctl restart meteo-iot   # Redémarrer"
echo ""
echo "  Capteurs → POST http://$(hostname -I | awk '{print $1}'):3002/api/sensors/data"
echo "══════════════════════════════════════════════"
