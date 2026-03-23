import { useState, useMemo } from 'react';
import {
  Area, AreaChart, BarChart, Bar, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import LiveDot from '../components/ui/LiveDot';
import { Droplets, Wind, Gauge, CloudRain, Sun, Cloud, CloudLightning, Snowflake, Thermometer, Waves } from 'lucide-react';
import {
  fmt, ts, timeAgo,
  aqiCategory, riskLevel, SENSOR_COLORS, weatherCondition,
} from '../utils/helpers';

// ── Palette professionnelle pour graphiques multi-nœuds ──────────────────
const NODE_COLORS = ['#3b82f6', '#f97316', '#10b981', '#6366f1', '#94a3b8', '#06b6d4', '#fbbf24', '#64748b'];

// ── Condition météo → composant Lucide ───────────────────────
const COND_ICON_MAP = {
  'Tempête': CloudLightning, 'Forte pluie': CloudRain, 'Pluie': CloudRain,
  'Vent violent': Wind, 'Dépression': Cloud, 'Nuageux': Cloud,
  'Ensoleillé': Sun, 'Partiellement nuageux': Sun,
  'Chaud': Thermometer, 'Gel': Snowflake, 'Stable': Cloud,
};

const ICON_MAP = {
  humidity: Droplets, wind: Wind, pressure: Gauge, rain: CloudRain,
  luminosity: Sun, flood: Waves, storm: CloudLightning, weather: Cloud,
  thermometer: Thermometer,
};

function MeteoIcon({ name, size = 16, color, style }) {
  const C = ICON_MAP[name] || Cloud;
  return <C size={size} color={color} style={style} />;
}

// ── Weather condition symbol ──────────────────────────────────
function WeatherSymbol({ condition, size = 52 }) {
  const C = COND_ICON_MAP[condition] || Cloud;
  return (
    <div style={{
      width: size, height: size, borderRadius: 14,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <C size={Math.round(size * 0.52)} color="var(--text-secondary)" />
    </div>
  );
}

// ── Collapsible card wrapper ──────────────────────────────────
function CollapsibleCard({ title, subtitle, rightContent, children, defaultOpen = true, style = {} }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ marginBottom: 20, ...style }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, marginBottom: open ? 16 : 0,
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rightContent}
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 13, flexShrink: 0,
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform .2s ease',
          }}>
            ▾
          </div>
        </div>
      </button>
      {open && children}
    </div>
  );
}

// ── Single metric horizontal bar indicator ───────────────────
function MetricBar({ label, icon, value, unit, pct, color, note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
          <MeteoIcon name={icon} size={13} color={color} />
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {value != null ? `${value} ${unit}` : '—'}
          {note && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 5 }}>{note}</span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 20,
          width: `${Math.min(100, Math.max(0, pct || 0))}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          transition: 'width .6s ease',
        }} />
      </div>
    </div>
  );
}

// ── 7-day forecast card ──────────────────────────────────────
function DayCard({ day, isToday }) {
  const CondIcon = COND_ICON_MAP[day.condLabel] || Cloud;
  const maxT = day.temp_max != null ? Math.round(day.temp_max) : '—';
  const minT = day.temp_min != null ? Math.round(day.temp_min) : '—';
  const rain  = day.rain_prob != null ? Math.round(day.rain_prob) : 0;
  const rainColor = rain >= 60 ? '#3b82f6' : rain >= 30 ? '#60a5fa' : 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '14px 10px', borderRadius: 12,
      background: isToday ? 'var(--accent-muted)' : 'var(--bg-elevated)',
      border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border-subtle)'}`,
      minWidth: 80, flex: 1,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: isToday ? 'var(--accent)' : 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.5px',
      }}>{day.dayName}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CondIcon size={20} color="var(--text-muted)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{maxT}°</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{minT}°</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Droplets size={10} color="var(--text-muted)" />
        <span style={{ fontSize: 11, fontWeight: 700, color: rainColor }}>{rain}%</span>
      </div>
      {rain > 0 && (
        <div style={{ width: '100%', height: 3, background: 'var(--bg-hover)', borderRadius: 10 }}>
          <div style={{ width: `${rain}%`, height: '100%', background: rainColor, borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}

// ── Data helpers ─────────────────────────────────────────────
function deterministicShift(base, d) {
  return Math.round(Math.sin((base + d * 1.7) * 0.4) * 2);
}

function buildEmptyDay(d) {
  const now = new Date(); const date = new Date(now);
  date.setDate(date.getDate() + d);
  const dayName = d === 0 ? 'Auj.' : d === 1 ? 'Dem.' :
    date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').slice(0, 3);
  return { dayName, temp_max: null, temp_min: null, rain_prob: null, condLabel: '—', source: 'none' };
}

function buildExtrap(dayName, latest, d) {
  const shift = deterministicShift(latest.temperature, d);
  const pressureFalling = latest.pressure < 1005;
  const basePrecip = latest.rain_level > 2 ? 50 : pressureFalling ? 35 : 15;
  const extrapReading = {
    temperature: latest.temperature + shift,
    humidity: Math.min(100, latest.humidity + shift * 1.5),
    pressure: latest.pressure - d * 0.3,
    rain_level: basePrecip > 40 ? 6 : 1,
    wind_speed: latest.wind_speed,
    luminosity: latest.luminosity,
  };
  return {
    dayName,
    temp_max: latest.temperature + shift + 2,
    temp_min: latest.temperature + shift - 4,
    rain_prob: Math.min(90, basePrecip + d * 2),
    condLabel: weatherCondition(extrapReading).label,
    source: 'estimated',
  };
}

function buildWeekForecast(history, latest, predictions) {
  if (!latest) return Array.from({ length: 7 }, (_, i) => buildEmptyDay(i));
  const toCondLabel = (r) => weatherCondition(r).label;
  const now = new Date();
  const days = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dayName = d === 0 ? 'Auj.' : d === 1 ? 'Dem.' :
      date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').slice(0, 3);
    if (d === 0) {
      const todaySamples = history.filter((r) => {
        const h = new Date(r.timestamp > 1e12 ? r.timestamp : r.timestamp * 1000);
        return h.toDateString() === date.toDateString();
      });
      const temps = todaySamples.map((r) => Number(r.temperature)).filter((v) => !isNaN(v));
      const rains = todaySamples.map((r) => Number(r.rain_level)).filter((v) => !isNaN(v));
      days.push({
        dayName,
        temp_max: temps.length ? Math.max(...temps) : latest.temperature + 2,
        temp_min: temps.length ? Math.min(...temps) : latest.temperature - 4,
        rain_prob: rains.length
          ? Math.min(100, (rains.filter((v) => v > 1).length / rains.length) * 100 * 2)
          : (latest.rain_level > 2 ? 60 : 10),
        condLabel: toCondLabel(latest), source: 'actual',
      });
    } else if (d === 1) {
      const pred = (predictions || []).find((p) => p.horizon_hours === 24);
      if (pred) {
        days.push({
          dayName,
          temp_max: pred.predicted_temp + 2, temp_min: pred.predicted_temp - 3,
          rain_prob: Math.min(100, pred.extreme_event_probability * 120),
          condLabel: toCondLabel({ temperature: pred.predicted_temp, humidity: pred.predicted_humidity, pressure: pred.predicted_pressure, rain_level: pred.extreme_event_probability > 0.4 ? 8 : 1, wind_speed: latest.wind_speed }),
          source: 'lstm',
        });
      } else {
        days.push(buildExtrap(dayName, latest, d));
      }
    } else if (d === 2) {
      const pred = (predictions || []).find((p) => p.horizon_hours === 12);
      days.push(pred ? {
        dayName,
        temp_max: pred.predicted_temp + 1 + deterministicShift(latest.temperature, d),
        temp_min: pred.predicted_temp - 4 + deterministicShift(latest.temperature, d),
        rain_prob: Math.min(100, pred.extreme_event_probability * 100 + 10),
        condLabel: toCondLabel({ temperature: pred.predicted_temp, humidity: pred.predicted_humidity, pressure: pred.predicted_pressure, rain_level: 2, wind_speed: latest.wind_speed }),
        source: 'estimated',
      } : buildExtrap(dayName, latest, d));
    } else {
      days.push(buildExtrap(dayName, latest, d));
    }
  }
  return days;
}

// Aggregate all-stations latest into a single synthetic reading
function aggregateLatest(latestByNode, nodeIds) {
  const latests = nodeIds.map((id) => latestByNode[id]).filter(Boolean);
  if (!latests.length) return null;
  const avg = (field) => {
    const vals = latests.map((r) => Number(r[field])).filter((v) => !isNaN(v));
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const maxVal = (field) => {
    const vals = latests.map((r) => Number(r[field])).filter((v) => !isNaN(v));
    return vals.length ? Math.max(...vals) : null;
  };
  return {
    temperature: avg('temperature'),
    humidity:    avg('humidity'),
    pressure:    avg('pressure'),
    wind_speed:  maxVal('wind_speed'),
    rain_level:  avg('rain_level'),
    luminosity:  avg('luminosity'),
    anomaly_score: maxVal('anomaly_score'),
    timestamp:   Math.max(...latests.map((r) => r.timestamp || 0)),
  };
}

// Multi-node temperature chart: one series per node name
function buildMultiTempChart(historyByNode, nodes, cutoff24h) {
  const buckets = {};
  nodes.forEach((node) => {
    const readings = (historyByNode[node.id] || []).filter((r) => r.timestamp >= cutoff24h).slice(-48);
    readings.forEach((r) => {
      const t = ts(r.timestamp);
      if (!buckets[t]) buckets[t] = { time: t };
      buckets[t][node.name] = r.temperature != null ? Number(r.temperature.toFixed(1)) : null;
    });
  });
  return Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time));
}

// Combined rain chart: average across nodes per time bucket
function buildCombinedRainChart(historyByNode, nodes, cutoff24h) {
  const buckets = {};
  nodes.forEach((node) => {
    const readings = (historyByNode[node.id] || []).filter((r) => r.timestamp >= cutoff24h).slice(-24);
    readings.forEach((r) => {
      const t = ts(r.timestamp);
      if (!buckets[t]) buckets[t] = { time: t, total: 0, count: 0 };
      if (r.rain_level != null) { buckets[t].total += Number(r.rain_level); buckets[t].count++; }
    });
  });
  return Object.values(buckets)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(({ time, total, count }) => ({ time, Pluie: count > 0 ? Number((total / count).toFixed(1)) : 0 }));
}

// ── Main component ────────────────────────────────────────────
const ALL_ID = '__all__';

export default function LiveWeatherPage({ nodes = [], historyByNode = {}, latestByNode = {}, predictions = [] }) {
  const [selectedNodeId, setSelectedNodeId] = useState(ALL_ID);
  const isAllMode = selectedNodeId === ALL_ID;

  const node   = !isAllMode ? (nodes.find((n) => String(n.id) === String(selectedNodeId)) || nodes[0]) : null;
  const nodeId = node?.id;

  const cutoff24h = Date.now() / 1000 - 24 * 3600;

  const latest = useMemo(() => {
    if (isAllMode) return aggregateLatest(latestByNode, nodes.map((n) => n.id));
    return nodeId ? latestByNode[nodeId] : null;
  }, [isAllMode, nodeId, latestByNode, nodes]);

  const history = useMemo(() => {
    if (isAllMode) return Object.values(historyByNode).flat().sort((a, b) => a.timestamp - b.timestamp);
    return nodeId ? (historyByNode[nodeId] || []) : [];
  }, [isAllMode, nodeId, historyByNode]);

  const last24h = useMemo(() => history.filter((r) => r.timestamp >= cutoff24h), [history, cutoff24h]);

  const tempChart = useMemo(() => {
    if (isAllMode) return buildMultiTempChart(historyByNode, nodes, cutoff24h);
    return last24h.slice(-48).map((r) => ({
      time: ts(r.timestamp),
      Température: r.temperature != null ? Number(r.temperature.toFixed(1)) : null,
    }));
  }, [isAllMode, historyByNode, nodes, last24h, cutoff24h]);

  const rainChart = useMemo(() => {
    if (isAllMode) return buildCombinedRainChart(historyByNode, nodes, cutoff24h);
    return last24h.slice(-24).map((r) => ({
      time: ts(r.timestamp),
      Pluie: r.rain_level != null ? Number(r.rain_level.toFixed(1)) : 0,
    }));
  }, [isAllMode, historyByNode, nodes, last24h, cutoff24h]);

  // Utiliser les champs pré-calculés par le backend
  const floodRisk = latest?.flood_risk ?? 0;
  const stormRisk = latest?.storm_risk ?? 0;
  const aqi       = latest?.aqi ?? 0;
  const aqiCat    = aqiCategory(aqi);
  const condition = { label: latest?.condition_label ?? '—', severity: latest?.condition_severity ?? 'none' };
  const beaufort  = latest ? { scale: latest.beaufort_scale ?? 0, label: latest.beaufort_label ?? 'Calme' } : null;
  const isAnomaly = (latest?.anomaly_score ?? 0) >= 0.7 || latest?.is_anomaly;
  const floodRL   = riskLevel(floodRisk);
  const stormRL   = riskLevel(stormRisk);

  const weekForecast = useMemo(
    () => buildWeekForecast(history, latest, predictions),
    [history, latest, predictions]
  );

  const onlineCount = nodes.filter((n) => n.status === 'online').length;

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Météo en direct</div>
          <div className="page-subtitle">Surveillance environnementale · Prévisions 7 jours</div>
        </div>
        <select className="select" value={selectedNodeId} onChange={(e) => setSelectedNodeId(e.target.value)}>
          <option value={ALL_ID}>🌐 Toutes les stations ({nodes.length})</option>
          {nodes.map((n) => (
            <option key={n.id} value={String(n.id)}>
              {n.status === 'online' ? '● ' : '○ '}{n.name}
            </option>
          ))}
          {nodes.length === 0 && <option disabled>Aucune station disponible</option>}
        </select>
      </div>

      {/* ── Hero — current conditions ─────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 220 }}>
          <WeatherSymbol condition={condition.label} size={64} />
          <div>
            <div style={{ fontSize: 52, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>
              {latest?.temperature != null ? `${Math.round(latest.temperature)}°` : '—'}
              {isAllMode && latest?.temperature != null && (
                <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0 }}> moy.</span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{condition.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              {isAllMode ? (
                <>
                  <LiveDot active={onlineCount > 0} size={7} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {onlineCount}/{nodes.length} stations en ligne
                  </span>
                  {latest && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· données combinées</span>}
                </>
              ) : (
                <>
                  <LiveDot active={node?.status === 'online'} size={7} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{node?.name}</span>
                  {node?.location && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {node.location}</span>}
                  {latest && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {timeAgo(latest.timestamp)}</span>}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 80, background: 'var(--border-subtle)', flexShrink: 0 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, flex: 1, minWidth: 220 }}>
          {[
            { icon: 'humidity', label: 'Humidité',  value: fmt(latest?.humidity, 0),   unit: '%',    color: SENSOR_COLORS.humidity },
            { icon: 'wind',     label: 'Vent',       value: fmt(latest?.wind_speed, 0), unit: 'km/h', color: SENSOR_COLORS.wind_speed, note: beaufort?.label },
            { icon: 'pressure', label: 'Pression',   value: latest?.pressure != null ? Math.round(latest.pressure) : '—', unit: 'hPa', color: SENSOR_COLORS.pressure },
            { icon: 'rain',     label: 'Pluie',      value: fmt(latest?.rain_level, 1), unit: 'mm',   color: SENSOR_COLORS.rain_level },
          ].map(({ icon, label, value, unit, color, note }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MeteoIcon name={icon} size={16} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {value}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>
                </div>
                {note && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{note}</div>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ width: 1, height: 80, background: 'var(--border-subtle)', flexShrink: 0 }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 70, height: 70, borderRadius: '50%',
            border: `4px solid ${aqiCat.color}`, background: `${aqiCat.color}12`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: aqiCat.color }}>{aqi ?? '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>IQA</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: aqiCat.color }}>{aqiCat.label}</div>
          {isAnomaly && <span className="badge badge-red" style={{ fontSize: 9 }}>⚠ Anomalie IA</span>}
          {isAllMode && nodes.length > 1 && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              moy. {nodes.length} stations
            </span>
          )}
        </div>
      </div>

      {/* ── 7-day forecast ────────────────────────────────────── */}
      <CollapsibleCard
        title="Prévisions sur 7 jours"
        rightContent={
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Mesuré
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> LSTM
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Estimé
          </span>
        }
      >
        <div style={{ display: 'flex', gap: 8, overflow: 'auto', paddingBottom: 4 }}>
          {weekForecast.map((day, idx) => <DayCard key={idx} day={day} isToday={idx === 0} />)}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          J+0 : capteurs réels · J+1 : LSTM 24h · J+2 : LSTM extrapolé · J+3–J+6 : estimation tendance
          {isAllMode && ' · Basé sur les données de toutes les stations combinées'}
        </div>
      </CollapsibleCard>

      {/* ── Temperature chart ─────────────────────────────────── */}
      <CollapsibleCard
        title="Températures — 24 dernières heures"
        subtitle={isAllMode
          ? `${nodes.length} stations — une courbe par station`
          : 'Évolution de la température sur la journée'
        }
      >
        {tempChart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Pas assez de données
          </div>
        ) : isAllMode ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              {nodes.map((n, i) => (
                <span key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 20, height: 3, borderRadius: 2, background: NODE_COLORS[i % NODE_COLORS.length], display: 'inline-block' }} />
                  {n.name}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tempChart} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                  {nodes.map((n, i) => (
                    <linearGradient key={n.id} id={`tg${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NODE_COLORS[i % NODE_COLORS.length]} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={NODE_COLORS[i % NODE_COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} unit="°" width={30} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="chart-tooltip">
                        <div className="chart-tooltip-label">{label}</div>
                        {payload.map((p) => (
                          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: p.color }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                            {p.dataKey}: {p.value != null ? `${p.value}°C` : '—'}
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {nodes.map((n, i) => (
                  <Area key={n.id} type="monotone" dataKey={n.name}
                    stroke={NODE_COLORS[i % NODE_COLORS.length]} fill={`url(#tg${i})`}
                    strokeWidth={2} dot={false} connectNulls />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={tempChart} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} unit="°" width={30} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-label">{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#f97316' }}>
                        {payload[0]?.value != null ? `${payload[0].value}°C` : '—'}
                      </div>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="Température" stroke="#f97316" fill="url(#tempGrad)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CollapsibleCard>

      {/* ── Precipitation chart ───────────────────────────────── */}
      <CollapsibleCard
        title="Précipitations — 24 dernières heures"
        subtitle={isAllMode
          ? 'Moyenne des précipitations sur toutes les stations (mm)'
          : "Hauteur d'eau mesurée heure par heure (mm)"
        }
      >
        {rainChart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Pas assez de données
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={rainChart} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} unit="mm" width={35} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-label">{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#6366f1' }}>
                        {payload[0]?.value != null ? `${payload[0].value} mm` : '0 mm'}
                        {isAllMode && <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>(moy.)</span>}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="Pluie" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CollapsibleCard>

      {/* ── Environmental indicators ──────────────────────────── */}
      <CollapsibleCard
        title="Indicateurs environnementaux"
        subtitle={isAllMode
          ? 'Valeurs moyennes / maximales sur toutes les stations'
          : 'Conditions actuelles de la station sélectionnée'
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <MetricBar
            label="Humidité relative"
            icon="humidity"
            value={latest?.humidity != null ? Math.round(latest.humidity) : null}
            unit="%" pct={latest?.humidity} color={SENSOR_COLORS.humidity}
            note={latest?.humidity > 80 ? 'Élevée' : latest?.humidity < 30 ? 'Sèche' : 'Normale'}
          />
          <MetricBar
            label="Vitesse du vent"
            icon="wind"
            value={latest?.wind_speed != null ? Math.round(latest.wind_speed) : null}
            unit="km/h" pct={latest?.wind_speed != null ? Math.min(100, latest.wind_speed) : 0}
            color={SENSOR_COLORS.wind_speed} note={beaufort?.label}
          />
          <MetricBar
            label="Pression atmosphérique"
            icon="pressure"
            value={latest?.pressure != null ? Math.round(latest.pressure) : null}
            unit="hPa"
            pct={latest?.pressure != null ? Math.min(100, Math.max(0, ((latest.pressure - 970) / 60) * 100)) : 0}
            color={SENSOR_COLORS.pressure}
            note={latest?.pressure < 995 ? 'Basse' : latest?.pressure > 1025 ? 'Haute' : 'Normale'}
          />
          <MetricBar
            label="Luminosité"
            icon="luminosity"
            value={latest?.luminosity != null ? Math.round(latest.luminosity).toLocaleString() : null}
            unit="lux"
            pct={latest?.luminosity != null ? Math.min(100, (latest.luminosity / 80000) * 100) : 0}
            color={SENSOR_COLORS.luminosity}
            note={latest?.luminosity > 20000 ? 'Lumière vive' : latest?.luminosity > 1000 ? 'Nuageux' : 'Faible'}
          />
        </div>
      </CollapsibleCard>

      {/* ── Risk summary ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          {
            label: 'Risque inondation', risk: floodRisk, rl: floodRL, icon: 'flood',
            detail: `Pluie: ${fmt(latest?.rain_level)} mm · Pression: ${latest?.pressure != null ? Math.round(latest.pressure) : '—'} hPa`,
          },
          {
            label: 'Risque tempête', risk: stormRisk, rl: stormRL, icon: 'storm',
            detail: `Vent: ${fmt(latest?.wind_speed, 0)} km/h · ${beaufort?.label || '—'}`,
          },
        ].map(({ label, risk, rl, icon, detail }) => (
          <div key={label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderLeft: `3px solid ${rl.color}`, borderRadius: 12, padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                <MeteoIcon name={icon} size={16} color={rl.color} /> {label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`risk-badge ${rl.cls}`} style={{ fontSize: 9 }}>{rl.label}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: rl.color, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(risk)}%
                </span>
              </div>
            </div>
            <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 20, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 20, width: `${risk}%`,
                background: `linear-gradient(90deg, ${rl.color}88, ${rl.color})`,
                transition: 'width .6s ease',
              }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {detail}
              {isAllMode && <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--text-muted)' }}>— valeur max toutes stations</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
