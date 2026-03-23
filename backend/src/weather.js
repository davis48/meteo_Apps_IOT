'use strict';
// ════════════════════════════════════════════════════════════════
//  WEATHER — Calculs météorologiques centralisés (backend)
//  Ces fonctions enrichissent toutes les réponses API afin que
//  le frontend n'ait plus à recalculer.
// ════════════════════════════════════════════════════════════════

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ── Condition météo ──────────────────────────────────────────────────────────
/**
 * Détermine la condition météo lisible à partir d'une lecture capteur.
 * Retourne { label, severity }
 */
function weatherCondition(reading) {
  if (!reading) return { label: '—', severity: 'none' };
  const {
    temperature = 20,
    rain_level  = 0,
    wind_speed  = 0,
    pressure    = 1013,
    luminosity  = 500,
  } = reading;

  if (rain_level > 20 && wind_speed > 50) return { label: 'Tempête',              severity: 'critical' };
  if (rain_level > 15)                    return { label: 'Forte pluie',           severity: 'warning'  };
  if (rain_level > 5)                     return { label: 'Pluie',                 severity: 'info'     };
  if (wind_speed > 60)                    return { label: 'Vent violent',           severity: 'warning'  };
  if (pressure < 990)                     return { label: 'Dépression',             severity: 'moderate' };
  if (pressure < 1005 && rain_level > 0)  return { label: 'Nuageux',               severity: 'none'     };
  if (luminosity > 20000)                 return { label: 'Ensoleillé',             severity: 'none'     };
  if (luminosity > 5000)                  return { label: 'Partiellement nuageux',  severity: 'none'     };
  if (temperature > 30)                   return { label: 'Chaud',                  severity: 'moderate' };
  if (temperature < 0)                    return { label: 'Gel',                    severity: 'warning'  };
  return                                  { label: 'Stable',                        severity: 'none'     };
}

// ── Risque d'inondation (0–100) ─────────────────────────────────────────────
function computeFloodRisk(reading) {
  if (!reading) return 0;
  const { rain_level = 0, pressure = 1013 } = reading;
  let score = 0;
  if (rain_level > 2)  score += 10;
  if (rain_level > 8)  score += 20;
  if (rain_level > 15) score += 25;
  if (rain_level > 25) score += 25;
  if (pressure < 1005) score += 10;
  if (pressure < 995)  score += 15;
  if (pressure < 985)  score += 20;
  return Math.min(100, score);
}

// ── Risque de tempête (0–100) ───────────────────────────────────────────────
function computeStormRisk(reading) {
  if (!reading) return 0;
  const { wind_speed = 0, pressure = 1013, rain_level = 0 } = reading;
  let score = 0;
  if (wind_speed > 20) score += 10;
  if (wind_speed > 40) score += 20;
  if (wind_speed > 60) score += 25;
  if (wind_speed > 80) score += 20;
  if (pressure < 1005) score += 10;
  if (pressure < 990)  score += 20;
  if (rain_level > 10) score += 10;
  return Math.min(100, score);
}

// ── Risque global (max flood, storm, anomalie) ──────────────────────────────
function computeOverallRisk(reading) {
  if (!reading) return 0;
  const flood   = computeFloodRisk(reading);
  const storm   = computeStormRisk(reading);
  const anomaly = (reading.anomaly_score || 0) * 100;
  return Math.round(Math.max(flood, storm, anomaly * 0.5));
}

// ── Libellé du niveau de risque ─────────────────────────────────────────────
function riskLabel(score) {
  if (score == null || score < 15) return 'Faible';
  if (score < 35) return 'Modéré';
  if (score < 55) return 'Élevé';
  if (score < 75) return 'Critique';
  return 'Extrême';
}

// ── IQA (Indice Qualité Air, 0–100, 100 = parfait) ─────────────────────────
function computeAQI(reading) {
  if (!reading) return null;
  const { temperature = 20, humidity = 50, pressure = 1013 } = reading;

  // Confort température (18–24°C idéal pour zones tropicales : 24–28°C)
  let tempScore;
  if (temperature >= 22 && temperature <= 28)        tempScore = 100;
  else if (temperature < 0 || temperature > 45)      tempScore = 0;
  else if (temperature < 22) tempScore = ((temperature + 10) / 32) * 100;
  else                        tempScore = Math.max(0, 100 - ((temperature - 28) / 17) * 100);

  // Confort humidité (40–70% idéal)
  let humScore;
  if (humidity >= 40 && humidity <= 70) humScore = 100;
  else if (humidity < 10 || humidity > 98) humScore = 0;
  else if (humidity < 40) humScore = ((humidity - 10) / 30) * 100;
  else                     humScore = Math.max(0, 100 - ((humidity - 70) / 28) * 100);

  // Stabilité pression (1013 hPa idéal)
  const pressureDev = Math.abs(pressure - 1013);
  const pressScore  = Math.max(0, 100 - pressureDev * 2.5);

  return Math.round(tempScore * 0.40 + humScore * 0.40 + pressScore * 0.20);
}

// ── Catégorie IQA ────────────────────────────────────────────────────────────
function aqiCategory(score) {
  if (score == null)  return { label: '—',         color: '#64748b' };
  if (score >= 80)    return { label: 'Excellent',  color: '#22c55e' };
  if (score >= 60)    return { label: 'Bon',        color: '#84cc16' };
  if (score >= 40)    return { label: 'Modéré',     color: '#f59e0b' };
  if (score >= 20)    return { label: 'Mauvais',    color: '#ef4444' };
  return              { label: 'Très mauvais',      color: '#dc2626' };
}

// ── Beaufort ─────────────────────────────────────────────────────────────────
function windBeaufort(speed_kmh) {
  if (speed_kmh < 1)  return { scale: 0, label: 'Calme' };
  if (speed_kmh < 6)  return { scale: 1, label: 'Très légère brise' };
  if (speed_kmh < 12) return { scale: 2, label: 'Légère brise' };
  if (speed_kmh < 20) return { scale: 3, label: 'Petite brise' };
  if (speed_kmh < 29) return { scale: 4, label: 'Jolie brise' };
  if (speed_kmh < 39) return { scale: 5, label: 'Bonne brise' };
  if (speed_kmh < 50) return { scale: 6, label: 'Vent frais' };
  if (speed_kmh < 62) return { scale: 7, label: 'Grand frais' };
  if (speed_kmh < 75) return { scale: 8, label: 'Coup de vent' };
  if (speed_kmh < 89) return { scale: 9, label: 'Fort coup de vent' };
  if (speed_kmh < 103) return { scale: 10, label: 'Tempête' };
  if (speed_kmh < 118) return { scale: 11, label: 'Violente tempête' };
  return              { scale: 12, label: 'Ouragan' };
}

// ── Tendance de pression ─────────────────────────────────────────────────────
function pressureTrend(current, previous) {
  if (!current || !previous) return 'stable';
  const diff = current.pressure - previous.pressure;
  if (diff > 2)  return 'rising';
  if (diff < -2) return 'falling';
  return 'stable';
}

// ── Enrichir une lecture avec les champs calculés ────────────────────────────
function enrichReading(reading, previousReading = null) {
  if (!reading) return reading;
  const condition  = weatherCondition(reading);
  const floodRisk  = computeFloodRisk(reading);
  const stormRisk  = computeStormRisk(reading);
  const overallRisk = computeOverallRisk(reading);
  const aqi        = computeAQI(reading);
  const aqiCat     = aqiCategory(aqi);
  const beaufort   = reading.wind_speed != null ? windBeaufort(reading.wind_speed) : null;
  const trend      = pressureTrend(reading, previousReading);

  return {
    ...reading,
    // Champs calculés côté backend
    condition_label:   condition.label,
    condition_severity: condition.severity,
    flood_risk:        floodRisk,
    storm_risk:        stormRisk,
    overall_risk:      overallRisk,
    risk_label:        riskLabel(overallRisk),
    aqi,
    aqi_label:         aqiCat.label,
    beaufort_scale:    beaufort?.scale ?? null,
    beaufort_label:    beaufort?.label ?? null,
    pressure_trend:    trend,
  };
}

module.exports = {
  weatherCondition,
  computeFloodRisk,
  computeStormRisk,
  computeOverallRisk,
  computeAQI,
  aqiCategory,
  riskLabel,
  windBeaufort,
  pressureTrend,
  enrichReading,
};
