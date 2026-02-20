# MeteoIoT Platform

Plateforme complète de monitoring météorologique IoT avec **dashboard temps réel**, **analyse IA**, **alertes intelligentes** et **API capteurs physiques**.

![Stack](https://img.shields.io/badge/Node.js-Express-green) ![DB](https://img.shields.io/badge/MySQL-8.x-blue) ![Front](https://img.shields.io/badge/React-Vite-purple) ![WS](https://img.shields.io/badge/WebSocket-temps%20réel-orange)

---

## Architecture

```
┌──────────────────┐     HTTP POST      ┌───────────────────────────────────┐
│  Capteurs IoT    │ ──────────────────► │         Backend (Express)         │
│  ESP32 / RPi     │                     │                                   │
└──────────────────┘                     │  ┌─────────────┐ ┌─────────────┐ │
                                         │  │  AI Engine   │ │  Generator  │ │
┌──────────────────┐     WebSocket       │  │  (analyse +  │ │ (simulation)│ │
│  Dashboard React │ ◄──────────────────►│  │  prédiction) │ │             │ │
│  (Vite / SPA)    │                     │  └─────────────┘ └─────────────┘ │
└──────────────────┘                     │         │                         │
                                         │         ▼                         │
                                         │  ┌─────────────┐                 │
                                         │  │   MySQL 8    │                 │
                                         │  └─────────────┘                 │
                                         └───────────────────────────────────┘
```

## Fonctionnalités

### Dashboard temps réel
- Visualisation température, humidité, pression, vent, pluie, luminosité
- Graphiques interactifs (Recharts) mis à jour en temps réel via WebSocket
- Vue par capteur (node) avec statut online/offline

### IA intégrée (ai-engine)
- **Détection d'anomalies multi-couche** : seuils absolus, z-score glissant, gradient temporel, corrélation croisée
- **Prédictions adaptatives** : tendance linéaire + cycle diurne + historique d'anomalies
- **Diagnostic capteur** : détection de capteurs bloqués, valeurs hors limites, taux d'anomalies
- **Explications** : chaque anomalie est accompagnée de facteurs explicatifs et recommandations

### Alertes intelligentes
- Alertes automatiques (température critique, pluie intense, vent fort, chute de pression, anomalie IA)
- 3 niveaux de sévérité : `info`, `warning`, `critical`
- Acquittement via API

### API capteurs physiques
- Endpoint simplifié pour ESP32/Arduino/Raspberry Pi
- Envoi unitaire ou par lot (batch jusqu'à 100 lectures)
- Enregistrement de capteurs + historique dédié

### DB Admin
- Interface web intégrée pour parcourir la base de données
- Accessible à `/db-admin`

---

## Prérequis

- **Node.js** >= 18 (recommandé: 20 LTS)
- **npm** >= 9
- **MySQL 8** (optionnel en local — le mode embedded démarre automatiquement)

---

## Installation locale (développement)

```bash
# 1. Cloner le dépôt
git clone https://github.com/davis48/meteo_Apps_IOT.git
cd meteo_Apps_IOT

# 2. Installer toutes les dépendances (backend + frontend)
npm install

# 3. Configurer le backend
cp backend/.env.example backend/.env
# Éditer backend/.env si besoin (par défaut: MySQL embedded, port 3002)

# 4. Lancer en mode développement (backend + frontend simultanément)
npm run dev
```

Le backend démarre sur `http://localhost:3002` et le frontend sur `http://localhost:5173` (avec proxy vers le backend).

### Lancer séparément

```bash
# Backend seul
npm run dev:backend

# Frontend seul
npm run dev:frontend
```

---

## Déploiement sur VPS (Hostinger / Ubuntu)

### Méthode automatique (recommandée)

```bash
# Sur le VPS, en tant que root :
git clone https://github.com/davis48/meteo_Apps_IOT.git /opt/meteo-iot
cd /opt/meteo-iot
chmod +x deploy.sh
./deploy.sh
```

Le script installe Node.js, MySQL, configure la base, build le frontend, crée un service systemd et démarre l'application.

### Méthode manuelle

```bash
# 1. Installer Node.js 20 + MySQL 8
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs mysql-server

# 2. Configurer MySQL
mysql -u root <<EOF
CREATE DATABASE meteo_iot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'meteo_user'@'localhost' IDENTIFIED BY 'VotreMotDePasse';
GRANT ALL PRIVILEGES ON meteo_iot.* TO 'meteo_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# 3. Cloner et installer
git clone https://github.com/davis48/meteo_Apps_IOT.git /opt/meteo-iot
cd /opt/meteo-iot
npm install

# 4. Configurer le .env production
cat > backend/.env <<EOF
PORT=3002
HOST=0.0.0.0
MYSQL_EMBEDDED=false
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=meteo_user
MYSQL_PASSWORD=VotreMotDePasse
MYSQL_DATABASE=meteo_iot
SIMULATION_INTERVAL_MS=10000
EOF

# 5. Build le frontend
cd frontend && npm run build && cd ..

# 6. Démarrer
cd backend && node src/server.js
```

### Avec PM2 (alternative à systemd)

```bash
npm install -g pm2
cd /opt/meteo-iot/backend
pm2 start src/server.js --name meteo-iot
pm2 save
pm2 startup
```

---

## API Reference

### Santé

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/health` | État du serveur et de la base |

### Capteurs physiques

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/sensors/register` | Enregistrer un nouveau capteur |
| `POST` | `/api/sensors/data` | Envoyer une lecture (temp + hum + pression) |
| `POST` | `/api/sensors/batch` | Envoyer un lot de lectures (max 100) |
| `GET` | `/api/sensors/:nodeId/latest` | Dernière lecture d'un capteur |
| `GET` | `/api/sensors/:nodeId/history` | Historique d'un capteur |

### Données & Dashboard

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/nodes` | Liste des capteurs |
| `GET` | `/api/nodes/:id` | Détail d'un capteur |
| `GET` | `/api/sensor-data` | Données brutes (filtrable) |
| `GET` | `/api/sensor-data/latest` | Dernières données par capteur |
| `GET` | `/api/sensor-data/stats` | Statistiques agrégées |
| `POST` | `/api/sensor-data` | Ingestion générique |
| `GET` | `/api/dashboard/summary` | Résumé dashboard |

### Alertes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/alerts` | Liste des alertes |
| `PATCH` | `/api/alerts/:id/acknowledge` | Acquitter une alerte |
| `GET` | `/api/anomalies` | Liste des anomalies |

### Intelligence Artificielle

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/ai/metrics` | Métriques globales IA |
| `GET` | `/api/ai/analyze/:nodeId` | Analyse IA du dernier relevé d'un capteur |
| `GET` | `/api/ai/predict/:nodeId` | Prédictions à 3h, 6h, 12h, 24h |
| `GET` | `/api/ai/diagnose/:nodeId` | Diagnostic santé d'un capteur |

### Prédictions

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/predictions` | Dernières prédictions météo |

### WebSocket

```
ws://<host>:3002
```

Événements reçus : `sensor_data`, `alert`, `alert_acknowledged`, `predictions`, `node_registered`, `heartbeat`

Actions client : `subscribe`, `unsubscribe`, `ping`

---

## Connecter un capteur physique

### 1. Enregistrer le capteur (une seule fois)

```bash
curl -X POST http://<IP_VPS>:3002/api/sensors/register \
  -H "Content-Type: application/json" \
  -d '{"node_id":"capteur-01","name":"DHT22 Salle A","location":"Bâtiment B"}'
```

### 2. Envoyer des mesures en boucle

```bash
curl -X POST http://<IP_VPS>:3002/api/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"node_id":"capteur-01","temperature":29.3,"humidity":68.0,"pressure":1012.5}'
```

### Exemple ESP32 (Arduino)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "MonWiFi";
const char* password = "MonMotDePasse";
const char* serverUrl = "http://<IP_VPS>:3002/api/sensors/data";

void setup() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String json = "{\"node_id\":\"capteur-01\","
                  "\"temperature\":" + String(readTemp()) + ","
                  "\"humidity\":" + String(readHum()) + ","
                  "\"pressure\":" + String(readPressure()) + "}";

    http.POST(json);
    http.end();
  }
  delay(30000); // Toutes les 30 secondes
}
```

### Exemple Raspberry Pi (Python)

```python
import requests, time

SERVER = "http://<IP_VPS>:3002"

# Enregistrement (une fois)
requests.post(f"{SERVER}/api/sensors/register", json={
    "node_id": "capteur-rpi-01",
    "name": "BME280 Raspberry Pi",
    "location": "Terrasse"
})

# Envoi en boucle
while True:
    requests.post(f"{SERVER}/api/sensors/data", json={
        "node_id": "capteur-rpi-01",
        "temperature": read_temperature(),
        "humidity": read_humidity(),
        "pressure": read_pressure()
    })
    time.sleep(30)
```

---

## Structure du projet

```
meteo-iot-platform/
├── backend/
│   ├── src/
│   │   ├── server.js       # Serveur Express + WebSocket + API
│   │   ├── db.js            # MySQL (embedded ou externe) + schéma + requêtes
│   │   ├── generator.js     # Simulation de données météo réalistes
│   │   ├── ai-engine.js     # Moteur IA (anomalies + prédictions + diagnostic)
│   │   └── config.js        # Configuration centralisée
│   ├── .env                 # Variables d'environnement (non versionné)
│   ├── .env.example         # Template de configuration
│   └── .env.production      # Template pour VPS
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Application React complète
│   │   └── main.jsx         # Point d'entrée React
│   ├── index.html           # Template HTML
│   └── vite.config.js       # Configuration Vite + proxy
├── deploy.sh                # Script de déploiement automatique VPS
├── package.json             # Workspace root (scripts dev/build)
└── README.md                # Ce fichier
```

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3002` | Port du serveur |
| `HOST` | `0.0.0.0` | Adresse d'écoute |
| `MYSQL_EMBEDDED` | `true` | Utiliser MySQL embedded (dev) |
| `MYSQL_HOST` | `127.0.0.1` | Hôte MySQL (production) |
| `MYSQL_PORT` | `3306` | Port MySQL |
| `MYSQL_USER` | `root` | Utilisateur MySQL |
| `MYSQL_PASSWORD` | `root` | Mot de passe MySQL |
| `MYSQL_DATABASE` | `meteo_iot` | Nom de la base |
| `SIMULATION_INTERVAL_MS` | `10000` | Intervalle simulation (ms) |

---

## Fonctionnement métier

- Le backend seed automatiquement 3 stations IoT + historique initial + prévisions
- Toutes les `SIMULATION_INTERVAL_MS`, il génère des mesures pour les nœuds en ligne
- Chaque mesure passe par :
  - **AI Engine** : analyse multi-couche (seuils + z-score + gradient + corrélation)
  - Calcul du score d'anomalie et détection d'alertes
  - Sauvegarde MySQL
  - Diffusion WebSocket temps réel (`sensor_data`, `alert`)
- En production, le frontend buildé est servi par le backend (SPA fallback)

## Commandes utiles (VPS)

```bash
systemctl status meteo-iot       # Statut du service
journalctl -u meteo-iot -f       # Logs en temps réel
systemctl restart meteo-iot      # Redémarrer
curl http://localhost:3002/api/health  # Test rapide
```

---

## Build frontend

```bash
npm run build
```

---

## Licence

ISC
