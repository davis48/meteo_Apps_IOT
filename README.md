# MeteoIoT Platform

Projet full-stack de station meteo IoT:

- Frontend React + Recharts
- Backend Node.js + Express + WebSocket
- Base de donnees MySQL (sans Docker, mode embarque par defaut)
- Simulation temps reel des capteurs (si aucun ESP32 connecte)

## Structure

```text
meteo-iot-platform/
  backend/
    src/
    .env
  frontend/
    src/
```

## Prerequis

- Node.js 20+
- npm 10+

## Installation

Depuis la racine du projet:

```bash
cd meteo-iot-platform
npm install
```

Les dependances front et back sont deja declarees dans leurs dossiers respectifs.

## Lancer l'application

### Mode developpement (front + back)

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API REST: `http://localhost:3002/api`
- WebSocket: `ws://localhost:3002`

### Lancer uniquement le backend

```bash
npm run dev:backend
```

### Lancer uniquement le frontend

```bash
npm run dev:frontend
```

## Endpoints principaux

- `GET /api/health`
- `GET /api/nodes`
- `GET /api/nodes/:id`
- `GET /api/sensor-data`
- `GET /api/sensor-data/latest`
- `GET /api/sensor-data/stats`
- `POST /api/sensor-data`
- `GET /api/alerts`
- `PATCH /api/alerts/:id/acknowledge`
- `GET /api/anomalies`
- `GET /api/predictions`
- `GET /api/ai/metrics`
- `GET /api/dashboard/summary`

## Variables d'environnement backend

Copier `backend/.env.example` en `backend/.env` si besoin.

Variables disponibles:

- `PORT` (defaut: `3002`)
- `MYSQL_EMBEDDED` (defaut: `true`)
- `MYSQL_EMBEDDED_VERSION` (defaut: `8.4.x`)
- `MYSQL_EMBEDDED_DBNAME` (defaut: `meteo_iot`)
- `MYSQL_EMBEDDED_PORT` (defaut: `3307`)
- `MYSQL_HOST` (defaut: `127.0.0.1`)
- `MYSQL_PORT` (defaut: `3306`)
- `MYSQL_USER` (defaut: `root`)
- `MYSQL_PASSWORD` (defaut: `root`)
- `MYSQL_DATABASE` (defaut: `meteo_iot`)
- `SIMULATION_INTERVAL_MS` (defaut: `10000`)

Notes:

- Avec `MYSQL_EMBEDDED=true`, le backend lance automatiquement une instance MySQL locale (aucun Docker requis), en utilisant un binaire MySQL embarque dans les dependances npm.
- Sur Mac Apple Silicon, le binaire MySQL embarque est x86_64: Rosetta doit etre disponible.
- Pour un MySQL externe, mets `MYSQL_EMBEDDED=false` puis configure `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.

## Fonctionnement metier

- Le backend seed automatiquement:
  - 3 stations IoT
  - historique initial de mesures
  - previsions meteo
- Toutes les `SIMULATION_INTERVAL_MS`, il genere des mesures pour les noeuds en ligne.
- Chaque mesure passe par:
  - calcul du score d'anomalie
  - detection des alertes meteo
  - sauvegarde MySQL
  - diffusion WebSocket (`sensor_data`, `alert`)

## Build frontend

```bash
npm run build
```
