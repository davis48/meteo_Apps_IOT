import { useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import CustomTooltip from '../components/charts/CustomTooltip';
import Icon from '../components/ui/Icon';
import {
  fmt, ts, toChartData, groupByNode,
  computeAQI, aqiCategory, computeHeatStress, windBeaufort,
  SENSOR_COLORS,
} from '../utils/helpers';

// Comfort factors
function ComfortFactor({ label, value, unit, min, max, ideal_min, ideal_max, color }) {
  const pct = max > min ? Math.min(100, ((value - min) / (max - min)) * 100) : 0;
  const inIdeal = value >= ideal_min && value <= ideal_max;
  const status = inIdeal ? 'optimal' : value < ideal_min ? 'trop bas' : 'trop élevé';
  const statusColor = inIdeal ? 'var(--risk-safe)' : 'var(--risk-medium)';
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {value != null ? `${fmt(value)}` : '—'}
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: `${statusColor}22`, padding: '3px 8px', borderRadius: 20 }}>
          {status}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          Plage idéale: {ideal_min}{unit} – {ideal_max}{unit}
        </div>
        <div style={{ position: 'relative', height: 8, background: 'var(--bg-elevated)', borderRadius: 20, overflow: 'hidden' }}>
          {/* Ideal zone highlight */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${Math.max(0, ((ideal_min - min) / (max - min)) * 100)}%`,
            width: `${Math.min(100, ((ideal_max - ideal_min) / (max - min)) * 100)}%`,
            background: 'rgba(34,197,94,.25)', borderRadius: 20,
          }} />
          {/* Current value indicator */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: `${pct}%`, height: '100%',
            background: color, borderRadius: 20, opacity: 0.85,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          <span>{min}{unit}</span><span>{max}{unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function AirQualityPage({ nodes = [], historyByNode = {}, latestByNode = {} }) {
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id || '');

  const node = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const nodeId = node?.id;
  const latest = nodeId ? latestByNode[nodeId] : null;
  const history = nodeId ? (historyByNode[nodeId] || []) : [];

  const aqi = computeAQI(latest);
  const aqiCat = aqiCategory(aqi);
  const heatStress = latest ? (computeHeatStress(latest) ?? 0) : 0;
  const beaufort = latest ? windBeaufort(latest.wind_speed) : null;

  // AQI trend over time
  const aqiHistory = history.slice(-24).map((r) => ({
    time: ts(r.timestamp),
    aqi: computeAQI(r),
    temperature: r.temperature != null ? Number(r.temperature.toFixed(1)) : null,
    humidity: r.humidity != null ? Number(r.humidity.toFixed(1)) : null,
  }));

  // UV/Light index
  const lux = latest?.luminosity || 0;
  const uvIndex = Math.min(11, Math.round(lux / 10000 * 11));
  const uvLabel = uvIndex <= 2 ? 'Faible' : uvIndex <= 5 ? 'Modéré' : uvIndex <= 7 ? 'Élevé' : uvIndex <= 10 ? 'Très élevé' : 'Extrême';
  const uvColor = uvIndex <= 2 ? 'var(--risk-safe)' : uvIndex <= 5 ? 'var(--risk-low)' : uvIndex <= 7 ? 'var(--risk-medium)' : 'var(--risk-high)';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Qualité de l'air</div>
          <div className="page-subtitle">Indice de confort environnemental · Analyse atmosphérique</div>
        </div>
        <div className="page-header-right">
          <select className="select" value={selectedNodeId} onChange={(e) => setSelectedNodeId(e.target.value)}>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
      </div>

      {/* AQI Hero */}
      <div className="section">
        <div className="grid-3">
          {/* AQI Score */}
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <div className="card-header">
              <span className="card-title">Indice Qualité Air (IQA)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                border: `5px solid ${aqiCat.color}`,
                background: `${aqiCat.color}15`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: aqiCat.color, lineHeight: 1 }}>
                  {aqi != null ? aqi : '—'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>/ 100</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: aqiCat.color }}>{aqiCat.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  Calculé sur température, humidité et pression atmosphérique.
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    Gradient IQA
                  </div>
                  <div className="aqi-gradient-bar">
                    <div className="aqi-indicator" style={{ left: `${100 - (aqi || 0)}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 6 }}>
                    <span>Excellent</span><span>Modéré</span><span>Mauvais</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Heat stress */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Indice de chaleur (Heat Stress)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 70, height: 70, borderRadius: '50%',
                border: `4px solid ${heatStress > 60 ? 'var(--risk-high)' : heatStress > 30 ? 'var(--risk-medium)' : 'var(--risk-safe)'}`,
                background: `${heatStress > 60 ? 'rgba(239,68,68' : heatStress > 30 ? 'rgba(245,158,11' : 'rgba(34,197,94'},.12)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{heatStress}%</div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="progress-bar" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{
                    width: `${heatStress}%`,
                    background: heatStress > 60 ? 'var(--risk-high)' : heatStress > 30 ? 'var(--risk-medium)' : 'var(--risk-safe)',
                  }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {heatStress === 0 ? 'Confort thermique excellent' : heatStress < 30 ? 'Légère inconfort thermique' : heatStress < 60 ? 'Stress thermique modéré' : 'Stress thermique élevé'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  T: {latest?.temperature != null ? fmt(latest.temperature) : '—'}°C · Hum: {latest?.humidity != null ? fmt(latest.humidity) : '—'}%
                </div>
              </div>
            </div>
          </div>

          {/* UV / Luminosity */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Indice lumineux / UV estimé</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 70, height: 70, borderRadius: '50%',
                border: `4px solid ${uvColor}`, background: `${uvColor}15`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: uvColor }}>{uvIndex}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>UV</div>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: uvColor }}>{uvLabel}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Luminosité: {latest?.luminosity != null ? Math.round(latest.luminosity).toLocaleString() : '—'} lux
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {uvIndex === 0 ? 'Nuit / intérieur' : uvIndex <= 2 ? 'Protection non nécessaire' : uvIndex <= 5 ? 'Protection recommandée' : uvIndex <= 7 ? 'Protection nécessaire' : 'Protection impérative'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comfort factors */}
      <div className="section">
        <div className="section-title">Facteurs de confort <div className="section-title-line" /></div>
        <div className="grid-3">
          <ComfortFactor label="Température" value={latest?.temperature} unit="°C" min={-10} max={50}
            ideal_min={18} ideal_max={24} color="#f97316" />
          <ComfortFactor label="Humidité relative" value={latest?.humidity} unit="%" min={0} max={100}
            ideal_min={40} ideal_max={60} color={SENSOR_COLORS.humidity} />
          <ComfortFactor label="Pression atm." value={latest?.pressure != null ? Math.round(latest.pressure) : null} unit="hPa" min={970} max={1050}
            ideal_min={1005} ideal_max={1025} color={SENSOR_COLORS.pressure} />
        </div>
      </div>

      {/* Wind comfort */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Comfort éolien (Échelle Beaufort)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>
                {fmt(latest?.wind_speed, 0)} <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-muted)' }}>km/h</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                Force {beaufort?.scale ?? '—'} — {beaufort?.label ?? '—'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[...Array(13)].map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 20, borderRadius: 4,
                    background: i <= (beaufort?.scale ?? 0)
                      ? (i <= 3 ? '#22c55e' : i <= 6 ? '#f59e0b' : i <= 9 ? '#ef4444' : '#dc2626')
                      : 'var(--bg-elevated)',
                    transition: 'background .3s',
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>0 — Calme</span><span>6 — Fort</span><span>12 — Ouragan</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AQI trend chart */}
      <div className="section">
        <div className="section-title">Évolution IQA — 24h <div className="section-title-line" /></div>
        <div className="card">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={aqiHistory}>
                <defs>
                  <linearGradient id="gradAQI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--chart-text)" interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--chart-text)" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="aqi" stroke="#22c55e" fill="url(#gradAQI)" strokeWidth={2.5} dot={false} name="IQA" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Temp & humidity combined */}
      <div className="section">
        <div className="section-title">Température & Humidité — 24h <div className="section-title-line" /></div>
        <div className="card">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={aqiHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--chart-text)" interval="preserveStartEnd" />
                <YAxis yAxisId="t" tick={{ fontSize: 11 }} stroke="var(--chart-text)" />
                <YAxis yAxisId="h" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--chart-text)" />
                <Tooltip content={<CustomTooltip />} />
                <Line yAxisId="t" type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} name="Temp (°C)" />
                <Line yAxisId="h" type="monotone" dataKey="humidity" stroke={SENSOR_COLORS.humidity} strokeWidth={2} dot={false} name="Humidité (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
