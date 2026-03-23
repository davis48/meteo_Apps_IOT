// ============================================================
//   ATMOSIQ — Helpers & Weather Computation Utilities
// ============================================================

// ── Formatting ──────────────────────────────────────────────
export const fmt = (v, decimals = 1) =>
  v != null && !isNaN(v) ? Number(v).toFixed(decimals) : '—';

export const fmtInt = (v) =>
  v != null && !isNaN(v) ? Math.round(Number(v)) : '—';

export const ts = (unix) =>
  new Date((unix > 1e12 ? unix : unix * 1000)).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });

export const tsDate = (unix) =>
  new Date((unix > 1e12 ? unix : unix * 1000)).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

export const tsDateFull = (unix) =>
  new Date((unix > 1e12 ? unix : unix * 1000)).toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

export const timeAgo = (unix) => {
  const sec = Math.floor(Date.now() / 1000) - (unix > 1e12 ? Math.floor(unix / 1000) : unix);
  if (sec < 60)  return `il y a ${sec}s`;
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)}min`;
  if (sec < 86400) return `il y a ${Math.floor(sec / 3600)}h`;
  return `il y a ${Math.floor(sec / 86400)}j`;
};

// ── API ──────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const fetchApi = async (endpoint, options = {}) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
};

// ── Data grouping ────────────────────────────────────────────
export const groupByNode = (rows = []) => {
  const map = {};
  [...rows].sort((a, b) => a.timestamp - b.timestamp).forEach((r) => {
    if (!map[r.node_id]) map[r.node_id] = [];
    map[r.node_id].push(r);
  });
  return map;
};

export const getLatestByNode = (rows = []) => {
  const map = {};
  rows.forEach((r) => {
    if (!map[r.node_id] || r.timestamp > map[r.node_id].timestamp) {
      map[r.node_id] = r;
    }
  });
  return map;
};

// ── Risk computation ─────────────────────────────────────────
/**
 * Compute flood risk score (0–100)
 * Factors: rain_level, pressure drop, sustained rain
 */
export const computeFloodRisk = (reading) => {
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
};

/**
 * Compute storm risk score (0–100)
 * Factors: wind_speed, pressure, rain
 */
export const computeStormRisk = (reading) => {
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
};

/**
 * Compute heat stress index (0–100)
 * Based on temperature and humidity
 */
export const computeHeatStress = (reading) => {
  if (!reading) return 0;
  const { temperature = 20, humidity = 50 } = reading;
  const hi = -8.78469475556 +
    1.61139411 * temperature +
    2.33854883889 * humidity +
    -0.14611605 * temperature * humidity +
    -0.012308094 * temperature ** 2 +
    -0.0164248277778 * humidity ** 2 +
    0.002211732 * temperature ** 2 * humidity +
    0.00072546 * temperature * humidity ** 2 +
    -0.000003582 * temperature ** 2 * humidity ** 2;
  if (hi < 27) return 0;
  if (hi > 54) return 100;
  return Math.round(((hi - 27) / 27) * 100);
};

/**
 * Compute Air Quality Index (0–100, 100 = perfect)
 * Derived from temperature comfort, humidity comfort, pressure stability
 */
export const computeAQI = (reading) => {
  if (!reading) return null;
  const { temperature = 20, humidity = 50, pressure = 1013 } = reading;

  // Temperature comfort (18–24°C ideal)
  let tempScore;
  if (temperature >= 18 && temperature <= 24) tempScore = 100;
  else if (temperature < 0 || temperature > 45) tempScore = 0;
  else if (temperature < 18) tempScore = ((temperature + 10) / 28) * 100;
  else tempScore = Math.max(0, 100 - ((temperature - 24) / 21) * 100);

  // Humidity comfort (40–60% ideal)
  let humScore;
  if (humidity >= 40 && humidity <= 60) humScore = 100;
  else if (humidity < 10 || humidity > 95) humScore = 0;
  else if (humidity < 40) humScore = ((humidity - 10) / 30) * 100;
  else humScore = Math.max(0, 100 - ((humidity - 60) / 35) * 100);

  // Pressure stability (1013 hPa ideal)
  const pressureDev = Math.abs(pressure - 1013);
  const pressScore = Math.max(0, 100 - pressureDev * 2.5);

  return Math.round(tempScore * 0.40 + humScore * 0.40 + pressScore * 0.20);
};

/**
 * AQI category from score (0–100)
 */
export const aqiCategory = (score) => {
  if (score == null)   return { label: '—',         cls: 'gray',     color: '#64748b' };
  if (score >= 80)     return { label: 'Excellent',  cls: 'good',     color: '#22c55e' };
  if (score >= 60)     return { label: 'Bon',        cls: 'fair',     color: '#84cc16' };
  if (score >= 40)     return { label: 'Modéré',     cls: 'moderate', color: '#f59e0b' };
  if (score >= 20)     return { label: 'Mauvais',    cls: 'poor',     color: '#ef4444' };
  return               { label: 'Très mauvais',      cls: 'poor',     color: '#dc2626' };
};

/**
 * Risk level from flood/storm risk score
 */
export const riskLevel = (score) => {
  if (score == null) return { label: '—',         cls: '',         color: '#64748b' };
  if (score < 15)    return { label: 'Faible',    cls: 'safe',     color: '#22c55e' };
  if (score < 35)    return { label: 'Modéré',    cls: 'low',      color: '#84cc16' };
  if (score < 55)    return { label: 'Élevé',     cls: 'medium',   color: '#f59e0b' };
  if (score < 75)    return { label: 'Critique',  cls: 'high',     color: '#ef4444' };
  return             { label: 'Extrême',          cls: 'critical', color: '#dc2626' };
};

/**
 * Overall site risk level (max of flood + storm)
 */
export const computeOverallRisk = (reading) => {
  if (!reading) return 0;
  const flood = computeFloodRisk(reading);
  const storm = computeStormRisk(reading);
  const anomaly = (reading.anomaly_score || 0) * 100;
  return Math.round(Math.max(flood, storm, anomaly * 0.5));
};

// ── Weather condition ─────────────────────────────────────────
export const weatherCondition = (reading) => {
  if (!reading) return { label: '—', icon: 'cloud' };
  const { temperature = 20, rain_level = 0, wind_speed = 0, pressure = 1013, luminosity = 500 } = reading;

  if (rain_level > 20 && wind_speed > 50) return { label: 'Tempête',       icon: 'storm' };
  if (rain_level > 15)                    return { label: 'Forte pluie',   icon: 'rain-heavy' };
  if (rain_level > 5)                     return { label: 'Pluie',         icon: 'rain' };
  if (wind_speed > 60)                    return { label: 'Vent violent',  icon: 'wind-strong' };
  if (pressure < 990)                     return { label: 'Dépression',    icon: 'cloud-storm' };
  if (pressure < 1005 && rain_level > 0)  return { label: 'Nuageux',       icon: 'cloud' };
  if (luminosity > 20000)                 return { label: 'Ensoleillé',    icon: 'sun' };
  if (luminosity > 5000)                  return { label: 'Partiellement nuageux', icon: 'sun-cloud' };
  if (temperature > 30)                   return { label: 'Chaud',         icon: 'hot' };
  if (temperature < 0)                    return { label: 'Gel',           icon: 'frost' };
  return                                  { label: 'Stable',               icon: 'cloud-light' };
};

// ── Pressure trend ───────────────────────────────────────────
export const pressureTrend = (readings = []) => {
  if (readings.length < 2) return 'stable';
  const last = readings[readings.length - 1];
  const prev = readings[Math.max(0, readings.length - 6)];
  const diff = last.pressure - prev.pressure;
  if (diff > 2)  return 'rising';
  if (diff < -2) return 'falling';
  return 'stable';
};

export const pressureTrendLabel = (trend) => ({
  rising:  { label: 'En hausse — beau temps probable', icon: '↑', color: '#22c55e' },
  falling: { label: 'En baisse — détérioration probable', icon: '↓', color: '#ef4444' },
  stable:  { label: 'Stable', icon: '→', color: '#f59e0b' },
}[trend] || { label: '—', icon: '—', color: '#64748b' });

// ── Wind ─────────────────────────────────────────────────────
export const windBeaufort = (speed_kmh) => {
  if (speed_kmh < 1)  return { scale: 0, label: 'Calme' };
  if (speed_kmh < 6)  return { scale: 1, label: 'Très légère brise' };
  if (speed_kmh < 12) return { scale: 2, label: 'Légère brise' };
  if (speed_kmh < 20) return { scale: 3, label: 'Petite brise' };
  if (speed_kmh < 29) return { scale: 4, label: 'Jolie brise' };
  if (speed_kmh < 39) return { scale: 5, label: 'Brise fraîche' };
  if (speed_kmh < 50) return { scale: 6, label: 'Brise forte' };
  if (speed_kmh < 62) return { scale: 7, label: 'Grand frais' };
  if (speed_kmh < 75) return { scale: 8, label: 'Coup de vent' };
  if (speed_kmh < 89) return { scale: 9, label: 'Fort coup de vent' };
  if (speed_kmh < 103) return { scale: 10, label: 'Tempête' };
  if (speed_kmh < 118) return { scale: 11, label: 'Violente tempête' };
  return { scale: 12, label: 'Ouragan' };
};

// ── Recommendations ───────────────────────────────────────────
export const getRecommendations = (reading) => {
  if (!reading) return [];
  const recs = [];
  const flood = computeFloodRisk(reading);
  const storm = computeStormRisk(reading);
  const { temperature = 20, humidity = 50, rain_level = 0, wind_speed = 0, pressure = 1013 } = reading;

  if (flood >= 55) recs.push({ type: 'critical', text: 'Risque d\'inondation élevé — évitez les zones basses et sous-sols' });
  else if (flood >= 35) recs.push({ type: 'warning', text: 'Précipitations importantes — surveillez l\'évacuation des eaux' });
  if (storm >= 55) recs.push({ type: 'critical', text: 'Conditions de tempête — restez à l\'intérieur, sécurisez les objets extérieurs' });
  else if (storm >= 35) recs.push({ type: 'warning', text: 'Vents forts — attention aux arbres et structures instables' });
  if (temperature > 35) recs.push({ type: 'warning', text: 'Forte chaleur — hydratation et éviter l\'exposition prolongée au soleil' });
  if (temperature < 2) recs.push({ type: 'warning', text: 'Risque de gel — protégez les canalisations et végétaux sensibles' });
  if (humidity > 85) recs.push({ type: 'info', text: 'Humidité élevée — risque de condensation et développement fongique' });
  if (pressure < 990) recs.push({ type: 'warning', text: 'Pression atmosphérique très basse — perturbation météo probable' });
  if (recs.length === 0) recs.push({ type: 'info', text: 'Conditions météorologiques globalement favorables.' });
  return recs;
};

// ── Chart data helpers ────────────────────────────────────────
export const toChartData = (readings = [], fields = ['temperature']) => {
  return readings.slice(-48).map((r) => {
    const point = { time: ts(r.timestamp), ts: r.timestamp };
    fields.forEach((f) => { point[f] = r[f] != null ? Number(Number(r[f]).toFixed(2)) : null; });
    return point;
  });
};

// ── Stat computation ─────────────────────────────────────────
export const computeStats = (readings = [], field) => {
  const vals = readings.map((r) => Number(r[field])).filter((v) => !isNaN(v));
  if (!vals.length) return { min: null, max: null, avg: null, last: null };
  return {
    min:  Math.min(...vals),
    max:  Math.max(...vals),
    avg:  vals.reduce((s, v) => s + v, 0) / vals.length,
    last: vals[vals.length - 1],
  };
};

// ── Trend arrow ──────────────────────────────────────────────
export const trendArrow = (readings = [], field) => {
  if (readings.length < 2) return 'stable';
  const last = Number(readings[readings.length - 1]?.[field]);
  const prev = Number(readings[Math.max(0, readings.length - 4)]?.[field]);
  if (isNaN(last) || isNaN(prev)) return 'stable';
  const diff = last - prev;
  const threshold = field === 'pressure' ? 1 : 0.5;
  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'stable';
};

// ── Color tokens ──────────────────────────────────────────────
// Palette professionnelle réduite : orange (chaleur), bleu (eau), slate (neutre), rouge (danger)
export const SENSOR_COLORS = {
  temperature:   '#f97316',  // orange  — sémantique : chaleur
  humidity:      '#38bdf8',  // sky-blue — sémantique : eau/vapeur
  pressure:      '#94a3b8',  // slate   — neutre
  wind_speed:    '#64748b',  // steel   — neutre/air
  rain_level:    '#60a5fa',  // blue    — sémantique : précipitation
  luminosity:    '#fbbf24',  // amber   — sémantique : lumière
  anomaly_score: '#ef4444',  // rouge   — sémantique : danger
};

export const SEVERITY_COLORS = {
  critical: '#dc2626',
  warning:  '#f59e0b',
  info:     '#3b82f6',
};
