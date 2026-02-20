'use strict';
// ════════════════════════════════════════════════════════════════
//  AI ENGINE — Moteur d'analyse météo-IoT
//  Détection d'anomalies + Prédiction + Corrélation multi-capteurs
// ════════════════════════════════════════════════════════════════

/**
 * Fenêtre glissante par node pour l'analyse temporelle.
 * On conserve les N dernières lectures en mémoire pour du calcul rapide.
 */
const WINDOW_SIZE = 60; // garder 60 lectures par nœud
const windows = new Map(); // nodeId -> Array<reading>

function pushToWindow(nodeId, reading) {
  if (!windows.has(nodeId)) windows.set(nodeId, []);
  const win = windows.get(nodeId);
  win.push(reading);
  if (win.length > WINDOW_SIZE) win.shift();
  return win;
}

function getWindow(nodeId) {
  return windows.get(nodeId) || [];
}

// ─── Statistiques glissantes ────────────────────────────────────────────────

function stats(arr) {
  if (!arr.length) return { mean: 0, std: 0, min: 0, max: 0 };
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return {
    mean: +mean.toFixed(3),
    std: +Math.sqrt(variance).toFixed(3),
    min: Math.min(...arr),
    max: Math.max(...arr),
  };
}

function movingAverage(arr, windowSize = 5) {
  if (arr.length < windowSize) return arr;
  const result = [];
  for (let i = windowSize - 1; i < arr.length; i++) {
    const slice = arr.slice(i - windowSize + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / windowSize);
  }
  return result;
}

// ─── Détection d'anomalie multi-couche ──────────────────────────────────────

/**
 * Analyse une lecture en profondeur :
 * 1. Seuils absolus (limites physiques dangereuses)
 * 2. Z-score glissant (écart par rapport à la fenêtre récente)
 * 3. Gradient temporel (variation brutale)
 * 4. Corrélation croisée (incohérence entre capteurs)
 */
function analyzeReading(nodeId, reading, previousReading = null) {
  const result = {
    anomaly_score: 0,
    is_anomaly: false,
    factors: [],         // explications humaines
    risk_level: 'normal', // normal | elevated | high | critical
    recommendations: [],
  };

  let score = 0;

  // ── 1. Seuils absolus ─────────────────────────────────────────────────────
  const { temperature: t, humidity: h, pressure: p } = reading;

  if (t !== undefined && t !== null) {
    if (t >= 42) { score += 0.35; result.factors.push(`Température critique: ${t}°C`); }
    else if (t >= 38) { score += 0.20; result.factors.push(`Température très élevée: ${t}°C`); }
    else if (t <= 8) { score += 0.25; result.factors.push(`Température très basse: ${t}°C`); }

    if (t <= 0)  { score += 0.15; result.factors.push(`Gel détecté: ${t}°C`); }
  }

  if (h !== undefined && h !== null) {
    if (h >= 95) { score += 0.22; result.factors.push(`Humidité saturée: ${h}%`); }
    else if (h <= 15) { score += 0.20; result.factors.push(`Air extrêmement sec: ${h}%`); }
  }

  if (p !== undefined && p !== null) {
    if (p <= 995) { score += 0.25; result.factors.push(`Dépression atmosphérique: ${p} hPa`); }
    else if (p >= 1035) { score += 0.15; result.factors.push(`Anticyclone intense: ${p} hPa`); }
  }

  if (reading.wind_speed >= 20) {
    score += 0.25;
    result.factors.push(`Vent violent: ${reading.wind_speed} m/s`);
  }
  if (reading.rain_level >= 10) {
    score += 0.22;
    result.factors.push(`Pluie torrentielle: ${reading.rain_level} mm/h`);
  }

  // ── 2. Z-score sur la fenêtre glissante ───────────────────────────────────
  const win = getWindow(nodeId);
  if (win.length >= 8) {
    const fields = ['temperature', 'humidity', 'pressure'];
    for (const field of fields) {
      const values = win.map(r => r[field]).filter(v => v != null);
      if (values.length < 5) continue;
      const s = stats(values);
      if (s.std > 0) {
        const z = Math.abs((reading[field] - s.mean) / s.std);
        if (z > 3.0) {
          score += 0.18;
          result.factors.push(`${field}: z-score=${z.toFixed(1)} (loin de la moyenne récente)`);
        } else if (z > 2.5) {
          score += 0.08;
        }
      }
    }
  }

  // ── 3. Gradient temporel (variation brutale) ──────────────────────────────
  if (previousReading) {
    const dt = (reading.timestamp || 0) - (previousReading.timestamp || 0);
    if (dt > 0 && dt < 600) { // Moins de 10 min entre 2 lectures
      const tempDelta = Math.abs((reading.temperature ?? 0) - (previousReading.temperature ?? 0));
      const pressureDelta = Math.abs((reading.pressure ?? 0) - (previousReading.pressure ?? 0));
      const humDelta = Math.abs((reading.humidity ?? 0) - (previousReading.humidity ?? 0));

      if (tempDelta > 4) {
        score += 0.15;
        result.factors.push(`Variation temp brutale: ±${tempDelta.toFixed(1)}°C en ${Math.round(dt/60)}min`);
      }
      if (pressureDelta > 8) {
        score += 0.18;
        result.factors.push(`Chute pression rapide: ±${pressureDelta.toFixed(1)} hPa en ${Math.round(dt/60)}min`);
      }
      if (humDelta > 20) {
        score += 0.10;
        result.factors.push(`Variation humidité brusque: ±${humDelta.toFixed(0)}% en ${Math.round(dt/60)}min`);
      }
    }
  }

  // ── 4. Corrélation croisée (cohérence physique) ───────────────────────────
  if (t != null && h != null && p != null) {
    // Pression basse + humidité haute → cohérent (dépression)
    // Pression basse + humidité basse → suspect (capteur défaillant ?)
    if (p < 1000 && h < 40) {
      score += 0.12;
      result.factors.push('Incohérence: basse pression avec air sec (capteur humidité à vérifier)');
    }
    // Température haute + humidité haute → index de chaleur dangereux
    if (t >= 35 && h >= 70) {
      score += 0.15;
      result.factors.push(`Index de chaleur dangereux: ${t}°C / ${h}%`);
    }
  }

  // ── Bruit stochastique léger ──────────────────────────────────────────────
  score += (Math.random() - 0.4) * 0.03;

  // ── Résultat final ────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(1, score));
  result.anomaly_score = +score.toFixed(4);
  result.is_anomaly = score >= 0.65;

  if (score >= 0.85) result.risk_level = 'critical';
  else if (score >= 0.65) result.risk_level = 'high';
  else if (score >= 0.40) result.risk_level = 'elevated';
  else result.risk_level = 'normal';

  // ── Recommandations ───────────────────────────────────────────────────────
  if (result.risk_level === 'critical') {
    result.recommendations.push('⚠️ Vérifier immédiatement les capteurs et les conditions sur site');
    result.recommendations.push('Envoyer une alerte à l\'équipe terrain');
  }
  if (t >= 40) result.recommendations.push('Activer le refroidissement / vérifier l\'exposition');
  if (p <= 998) result.recommendations.push('Préparer les mesures anti-intempéries');
  if (h >= 95) result.recommendations.push('Vérifier le capteur humidité (possible condensation)');
  if (reading.wind_speed >= 18) result.recommendations.push('Sécuriser les équipements extérieurs');

  return result;
}

// ─── Prédiction adaptative ──────────────────────────────────────────────────

/**
 * Prédictions basées sur :
 * - Tendance linéaire de la fenêtre glissante
 * - Cycle diurne sinusoïdal
 * - Amplification si anomalie récente
 */
function predictForNode(nodeId, horizonHours = [3, 6, 12, 24]) {
  const win = getWindow(nodeId);
  if (win.length < 3) return null;

  const latest = win[win.length - 1];
  const temperatures = win.map(r => r.temperature).filter(v => v != null);
  const humidities = win.map(r => r.humidity).filter(v => v != null);
  const pressures = win.map(r => r.pressure).filter(v => v != null);

  // Tendance linéaire simple (pente des N dernières lectures)
  function linearTrend(values) {
    const n = values.length;
    if (n < 2) return 0;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    return den === 0 ? 0 : num / den;
  }

  const tTrend = linearTrend(temperatures);
  const hTrend = linearTrend(humidities);
  const pTrend = linearTrend(pressures);

  // Facteur diurne
  function dayFactor(ts) {
    const d = new Date(ts * 1000);
    const hours = d.getHours() + d.getMinutes() / 60;
    return Math.sin(((hours - 6) * Math.PI) / 12);
  }

  // Scores d'anomalie récents
  const recentScores = win.slice(-10).map(r => r.anomaly_score || 0);
  const avgRecentAnomaly = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

  return horizonHours.map(h => {
    const futureTs = (latest.timestamp || Math.floor(Date.now() / 1000)) + h * 3600;
    const sun = dayFactor(futureTs);

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const rand = () => (Math.random() - 0.5);

    const predictedTemp = clamp(
      (latest.temperature || 28) + tTrend * h * 0.3 + sun * 2.5 + rand() * 1.2,
      -10, 55
    );
    const predictedHumidity = clamp(
      (latest.humidity || 70) + hTrend * h * 0.3 - sun * 6 + rand() * 3,
      5, 100
    );
    const predictedPressure = clamp(
      (latest.pressure || 1013) + pTrend * h * 0.2 + rand() * 3,
      950, 1060
    );

    // Probabilité d'événement extrême
    let riskProb = 0.05;
    if (predictedTemp >= 38) riskProb += 0.15;
    if (predictedTemp <= 5) riskProb += 0.12;
    if (predictedHumidity >= 90) riskProb += 0.12;
    if (predictedPressure <= 1002) riskProb += 0.18;
    riskProb += avgRecentAnomaly * 0.25;
    riskProb += Math.abs(tTrend) * 0.08;
    riskProb += Math.abs(pTrend) * 0.10;
    riskProb += rand() * 0.05;
    riskProb = clamp(riskProb, 0.02, 0.98);

    let eventType = null;
    if (riskProb >= 0.35) {
      if (predictedTemp >= 38) eventType = 'HEATWAVE';
      else if (predictedPressure <= 1000) eventType = 'HEAVY_RAIN';
      else if (predictedHumidity >= 92) eventType = 'FOG';
      else eventType = 'WEATHER_SHIFT';
    }

    return {
      horizon_hours: h,
      predicted_temp: +predictedTemp.toFixed(1),
      predicted_humidity: +predictedHumidity.toFixed(0),
      predicted_pressure: +predictedPressure.toFixed(0),
      extreme_event_probability: +riskProb.toFixed(3),
      event_type: eventType,
    };
  });
}

// ─── Diagnostic capteur ─────────────────────────────────────────────────────

function diagnoseNode(nodeId) {
  const win = getWindow(nodeId);
  if (win.length < 5) {
    return { status: 'insufficient_data', message: 'Pas assez de données pour un diagnostic', readings: win.length };
  }

  const temps = win.map(r => r.temperature).filter(v => v != null);
  const hums = win.map(r => r.humidity).filter(v => v != null);
  const press = win.map(r => r.pressure).filter(v => v != null);

  const tStats = stats(temps);
  const hStats = stats(hums);
  const pStats = stats(press);

  const issues = [];

  // Valeur fixe → capteur bloqué
  if (tStats.std < 0.01 && temps.length > 10) issues.push('Capteur température possiblement bloqué (aucune variation)');
  if (hStats.std < 0.01 && hums.length > 10) issues.push('Capteur humidité possiblement bloqué (aucune variation)');
  if (pStats.std < 0.01 && press.length > 10) issues.push('Capteur pression possiblement bloqué (aucune variation)');

  // Valeurs hors limites physiques
  if (tStats.min < -40 || tStats.max > 60) issues.push(`Température hors limites physiques: [${tStats.min}, ${tStats.max}]`);
  if (pStats.min < 870 || pStats.max > 1085) issues.push(`Pression hors limites physiques: [${pStats.min}, ${pStats.max}]`);

  // Anomalies fréquentes
  const anomalyCount = win.filter(r => (r.anomaly_score || 0) >= 0.65).length;
  const anomalyRate = anomalyCount / win.length;
  if (anomalyRate > 0.4) issues.push(`Taux d'anomalies élevé: ${(anomalyRate*100).toFixed(0)}% des lectures`);

  return {
    status: issues.length === 0 ? 'healthy' : 'attention',
    readings: win.length,
    issues,
    stats: {
      temperature: tStats,
      humidity: hStats,
      pressure: pStats,
    },
    anomaly_rate: +(anomalyRate * 100).toFixed(1),
  };
}

module.exports = {
  pushToWindow,
  getWindow,
  analyzeReading,
  predictForNode,
  diagnoseNode,
  stats,
  movingAverage,
};
