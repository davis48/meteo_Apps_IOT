'use strict';

/**
 * Service MQTT — MeteoIoT
 *
 * Reçoit les données des capteurs ESP32 via un broker MQTT (ex. Mosquitto).
 * S'intègre dans le pipeline existant : ingestReading() → IA → DB → WebSocket.
 *
 * Topics attendus :
 *   meteo/{nodeId}/data    — lecture capteur (température, humidité, etc.)
 *   meteo/{nodeId}/alert   — alerte émise directement par le device
 *   meteo/{nodeId}/status  — statut du node (online/offline, batterie)
 *
 * Variables d'environnement :
 *   MQTT_URL   — ex. mqtt://localhost:1883  (défaut: mqtt://localhost:1883)
 *   MQTT_USER  — identifiant broker (optionnel)
 *   MQTT_PASS  — mot de passe broker (optionnel)
 */

const mqtt = require('mqtt');

let client = null;

const mqttService = {
  /**
   * Initialise la connexion MQTT et branche les handlers.
   *
   * @param {object} deps
   * @param {object}   deps.db            — instance base de données
   * @param {Function} deps.ingestReading — pipeline complet (IA + DB + broadcast)
   * @param {Function} deps.broadcast     — diffusion WebSocket
   * @param {Function} deps.updateNode    — mise à jour statut node
   * @param {Function} deps.insertAlert   — insertion alerte en base
   */
  init({ db, ingestReading, broadcast, updateNode, insertAlert }) {
    const brokerUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';

    const opts = {
      clientId:        `meteo-server-${Math.random().toString(36).slice(2)}`,
      username:        process.env.MQTT_USER || undefined,
      password:        process.env.MQTT_PASS || undefined,
      keepalive:       60,
      reconnectPeriod: 5000,   // reconnexion auto toutes les 5s
      connectTimeout:  15000,
      clean:           true,
    };

    try {
      client = mqtt.connect(brokerUrl, opts);

      client.on('connect', () => {
        console.log(`[MQTT] ✓ Connecté au broker : ${brokerUrl}`);
        client.subscribe(
          ['meteo/+/data', 'meteo/+/alert', 'meteo/+/status'],
          { qos: 1 },
          (err) => {
            if (err) console.error('[MQTT] Erreur abonnement topics :', err.message);
            else     console.log('[MQTT] Topics abonnés : meteo/+/data · meteo/+/alert · meteo/+/status');
          },
        );
      });

      client.on('message', async (topic, raw) => {
        try {
          const parts  = topic.split('/');
          const nodeId = parts[1];
          const type   = parts[2];

          if (!nodeId || !type) return;

          const data = JSON.parse(raw.toString());

          // ── Données capteur ────────────────────────────────────────────────
          if (type === 'data') {
            await ingestReading(
              { ...data, node_id: nodeId },
              'mqtt',
            );
          }

          // ── Alerte émise par le device ────────────────────────────────────
          else if (type === 'alert') {
            const alert = await insertAlert(db, {
              node_id:   nodeId,
              timestamp: Math.floor(Date.now() / 1000),
              type:      data.type     || 'DEVICE_ALERT',
              severity:  data.severity || 'info',
              message:   data.message  || 'Alerte reçue via MQTT',
              details:   data.details  ? JSON.stringify(data.details) : null,
            });
            if (alert) broadcast('alert', alert);
          }

          // ── Statut node (batterie, online/offline) ────────────────────────
          else if (type === 'status') {
            const status = data.online !== false ? 'online' : 'offline';
            await updateNode(db, nodeId, {
              status,
              last_seen:     Math.floor(Date.now() / 1000),
              battery_level: data.battery ?? null,
            });
            broadcast('node_status', { node_id: nodeId, status, battery: data.battery });
          }

        } catch (err) {
          console.error(`[MQTT] Erreur traitement message (${topic}) :`, err.message);
        }
      });

      client.on('error',   (err) => console.error('[MQTT] Erreur :', err.message));
      client.on('offline', ()    => console.warn('[MQTT] Broker hors ligne — reconnexion automatique dans 5s…'));
      client.on('reconnect', ()  => console.log('[MQTT] Tentative de reconnexion…'));

    } catch (err) {
      console.warn('[MQTT] Impossible de démarrer le service MQTT :', err.message);
      console.warn('[MQTT] Le serveur continue en mode REST + WebSocket uniquement.');
    }
  },

  /**
   * Publie un message vers un topic MQTT (ex: commande vers un device).
   * @returns {boolean} true si publié, false si non connecté
   */
  publish(topic, payload, opts = {}) {
    if (client?.connected) {
      client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false, ...opts });
      return true;
    }
    return false;
  },

  isConnected: () => client?.connected || false,
};

module.exports = mqttService;
