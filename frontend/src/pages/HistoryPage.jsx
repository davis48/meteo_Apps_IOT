import { useState, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  CartesianGrid, Brush, ResponsiveContainer, Tooltip,
  XAxis, YAxis, ReferenceLine,
} from 'recharts';
import CustomTooltip from '../components/charts/CustomTooltip';
import Icon from '../components/ui/Icon';
import {
  fmt, tsDate, toChartData, computeStats, trendArrow, SENSOR_COLORS,
} from '../utils/helpers';

// ── Constants ──────────────────────────────────────────────────────────────────
const PERIODS = [
  { value: 6,   label: '6h'  },
  { value: 24,  label: '24h' },
  { value: 72,  label: '3j'  },
  { value: 168, label: '7j'  },
];

const METRICS = [
  { key: 'temperature',   label: 'Température',   unit: '°C',   color: '#f97316' },
  { key: 'humidity',      label: 'Humidité',       unit: '%',    color: SENSOR_COLORS.humidity },
  { key: 'pressure',      label: 'Pression',       unit: 'hPa',  color: SENSOR_COLORS.pressure },
  { key: 'wind_speed',    label: 'Vent',           unit: 'km/h', color: SENSOR_COLORS.wind_speed },
  { key: 'rain_level',    label: 'Pluie',          unit: 'mm',   color: SENSOR_COLORS.rain_level },
  { key: 'luminosity',    label: 'Luminosité',     unit: 'lux',  color: SENSOR_COLORS.luminosity },
  { key: 'anomaly_score', label: 'Score anomalie', unit: '',     color: SENSOR_COLORS.anomaly_score },
];

// ── Heatmap ───────────────────────────────────────────────────────────────────
function heatColor(t) {
  const r = Math.round(t < 0.5 ? t * 2 * 50        : 50  + (t - 0.5) * 2 * 205);
  const g = Math.round(t < 0.5 ? 100 + t * 2 * 155 : 255 - (t - 0.5) * 2 * 255);
  const b = Math.round(t < 0.5 ? 200 - t * 2 * 200 : 0);
  return `rgba(${r},${g},${b},0.82)`;
}

function HeatMap({ data, unit }) {
  const [tip, setTip] = useState(null);
  const allValues = data.flatMap((d) => d.hours.map((h) => h.value)).filter((v) => v !== null);

  if (!allValues.length) {
    return (
      <div className="empty-state" style={{ padding: '32px 0' }}>
        <div className="empty-state-title">Pas de données</div>
        <div className="empty-state-text">Aucune mesure sur cette période.</div>
      </div>
    );
  }

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', marginBottom: 4, marginLeft: 52 }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{
            flex: 1, minWidth: 24, textAlign: 'center',
            fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          }}>
            {h % 6 === 0 ? `${h}h` : ''}
          </div>
        ))}
      </div>
      {data.map(({ day, hours }) => (
        <div key={day} style={{ display: 'flex', marginBottom: 3, alignItems: 'center' }}>
          <div style={{
            width: 48, flexShrink: 0, fontSize: 9.5,
            fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
            textAlign: 'right', paddingRight: 8,
          }}>
            {day}
          </div>
          {hours.map(({ hour, value }) => {
            const t = value !== null ? (value - minVal) / (maxVal - minVal || 1) : null;
            const id = `${day}-${hour}`;
            return (
              <div
                key={hour}
                style={{
                  flex: 1, minWidth: 24, height: 24, borderRadius: 3,
                  background: t !== null ? heatColor(t) : 'var(--bg-elevated)',
                  margin: '0 1px',
                  border: tip?.id === id ? '1px solid rgba(255,255,255,.5)' : '1px solid transparent',
                  transform: tip?.id === id ? 'scale(1.15)' : undefined,
                  transition: 'transform .1s',
                  cursor: value !== null ? 'pointer' : 'default',
                }}
                onMouseEnter={() => value !== null && setTip({ id, hour, day, value })}
                onMouseLeave={() => setTip(null)}
              />
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, marginLeft: 52 }}>
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 48 }}>
          {fmt(minVal)}{unit}
        </span>
        <div style={{
          flex: 1, height: 6, borderRadius: 3,
          background: 'linear-gradient(to right, rgba(0,100,200,.8), rgba(50,255,100,.8), rgba(255,50,0,.8))',
        }} />
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 48, textAlign: 'right' }}>
          {fmt(maxVal)}{unit}
        </span>
      </div>
      {tip && (
        <div style={{
          marginTop: 10, display: 'inline-flex', gap: 12, alignItems: 'center',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: '6px 12px', fontSize: 12,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>{tip.day} à {tip.hour}h</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {fmt(tip.value)}{unit}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Export helpers ─────────────────────────────────────────────────────────────
function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function exportCSV(rows, nodeId) {
  const h  = ['timestamp','datetime','temperature','humidity','pressure','wind_speed','rain_level','luminosity','anomaly_score','is_anomaly'];
  const lines = [h.join(','), ...rows.map((r) => {
    const dt = r.timestamp ? new Date(r.timestamp * 1000).toISOString() : '';
    return [r.timestamp ?? '', dt, r.temperature ?? '', r.humidity ?? '', r.pressure ?? '',
            r.wind_speed ?? '', r.rain_level ?? '', r.luminosity ?? '',
            r.anomaly_score ?? '', r.is_anomaly ?? ''].join(',');
  })];
  downloadFile(lines.join('\n'), `export_${nodeId}_${Date.now()}.csv`, 'text/csv');
}
function exportJSON(rows, nodeId) {
  const out = rows.map((r) => ({
    id: r.id, timestamp: r.timestamp,
    datetime: r.timestamp ? new Date(r.timestamp * 1000).toISOString() : null,
    node_id: r.node_id, temperature: r.temperature, humidity: r.humidity,
    pressure: r.pressure, wind_speed: r.wind_speed, rain_level: r.rain_level,
    luminosity: r.luminosity, anomaly_score: r.anomaly_score, is_anomaly: r.is_anomaly,
  }));
  downloadFile(JSON.stringify(out, null, 2), `export_${nodeId}_${Date.now()}.json`, 'application/json');
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function HistoryPage({ nodes = [], historyByNode = {}, latestByNode = {} }) {
  const [selectedNodeId,   setSelectedNodeId]   = useState(nodes[0]?.id || '');
  const [period,           setPeriod]           = useState(24);
  const [selectedMetrics,  setSelectedMetrics]  = useState(['temperature', 'humidity']);
  const [chartType,        setChartType]        = useState('line');
  const [exportOpen,       setExportOpen]       = useState(false);

  const nodeId      = selectedNodeId || nodes[0]?.id;
  const currentNode = nodes.find((n) => n.id === nodeId);
  const history     = nodeId ? (historyByNode[nodeId] || []) : [];

  const cutoff   = Date.now() / 1000 - period * 3600;
  const filtered = useMemo(() => history.filter((r) => r.timestamp >= cutoff), [history, cutoff]);

  const chartData  = useMemo(() => toChartData(filtered, selectedMetrics), [filtered, selectedMetrics]);
  const stats      = useMemo(
    () => METRICS.reduce((acc, { key }) => { acc[key] = computeStats(filtered, key); return acc; }, {}),
    [filtered],
  );
  const anomalyData = useMemo(
    () => filtered.filter((r) => r.is_anomaly || r.anomaly_score >= 0.7),
    [filtered],
  );

  const heatmapMetric = selectedMetrics[0] || 'temperature';
  const heatmapUnit   = METRICS.find((m) => m.key === heatmapMetric)?.unit || '';

  const heatmapData = useMemo(() => {
    const dayMap = {};
    filtered.forEach((r) => {
      const d    = new Date(r.timestamp * 1000);
      const day  = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
      const hour = d.getHours();
      if (!dayMap[day]) dayMap[day] = {};
      if (!dayMap[day][hour]) dayMap[day][hour] = [];
      const v = r[heatmapMetric];
      if (v != null) dayMap[day][hour].push(parseFloat(v));
    });
    const days = Object.keys(dayMap).sort((a, b) => {
      const [da, ma] = a.split('/').map(Number);
      const [db, mb] = b.split('/').map(Number);
      return ma !== mb ? ma - mb : da - db;
    });
    return days.map((day) => ({
      day,
      hours: Array.from({ length: 24 }, (_, h) => {
        const vals = dayMap[day][h];
        return {
          hour: h,
          value: vals?.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null,
        };
      }),
    }));
  }, [filtered, heatmapMetric]);

  const toggleMetric = (key) =>
    setSelectedMetrics((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const selectedMeta = METRICS.filter((m) => selectedMetrics.includes(m.key));
  const firstMetric  = selectedMeta[0];
  const secondMetric = selectedMeta[1];

  const periodStart = filtered.length ? tsDate(filtered[0].timestamp) : null;
  const periodEnd   = filtered.length ? tsDate(filtered[filtered.length - 1].timestamp) : null;

  return (
    <div>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Historique</div>
          <div className="page-subtitle">
            {currentNode?.name || '—'}
            {periodStart && ` · du ${periodStart} au ${periodEnd}`}
          </div>
        </div>
        <div className="page-header-right">
          <select
            className="select"
            value={selectedNodeId}
            onChange={(e) => setSelectedNodeId(e.target.value)}
          >
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <div className="tabs">
            {PERIODS.map(({ value, label }) => (
              <button
                key={value}
                className={`tab${period === value ? ' active' : ''}`}
                onClick={() => setPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setExportOpen((v) => !v)}
            >
              <Icon name="download" size={14} />
              Exporter
            </button>
            {exportOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.3)',
                zIndex: 50, minWidth: 160, padding: 6,
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 10px 6px', fontWeight: 600 }}>
                  {filtered.length} mesures · {currentNode?.name || nodeId}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', textAlign: 'left', fontSize: 12, padding: '7px 12px', borderRadius: 7 }}
                  onClick={() => { exportCSV(filtered, nodeId); setExportOpen(false); }}
                >
                  Exporter en CSV
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', textAlign: 'left', fontSize: 12, padding: '7px 12px', borderRadius: 7 }}
                  onClick={() => { exportJSON(filtered, nodeId); setExportOpen(false); }}
                >
                  Exporter en JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Period summary strip ── */}
      {filtered.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '10px 16px', marginBottom: 20,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
        }}>
          {[
            { label: 'Mesures',   value: filtered.length.toLocaleString() },
            { label: 'Période',   value: `${period}h` },
            { label: 'Anomalies', value: anomalyData.length },
          ].map(({ label, value }, i) => (
            <span key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {i > 0 && <span style={{ color: 'var(--border-default)', marginRight: 8 }}>·</span>}
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', fontSize: 10 }}>{label}</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Metric selectors + chart type ── */}
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Métriques
          </span>
          {METRICS.map(({ key, label, color }) => {
            const active = selectedMetrics.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleMetric(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  border: `1px solid ${active ? color + '66' : 'var(--border-default)'}`,
                  background: active ? `${color}14` : 'transparent',
                  color: active ? color : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 11.5, fontWeight: active ? 600 : 400,
                  transition: 'all .15s',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? color : 'var(--text-muted)', flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {[
              { id: 'line',    label: 'Courbe'      },
              { id: 'bar',     label: 'Barres'      },
              { id: 'heatmap', label: 'Heatmap'     },
            ].map(({ id, label }) => (
              <button
                key={id}
                className={`tab${chartType === id ? ' active' : ''}`}
                onClick={() => setChartType(id)}
                style={{ fontSize: 11 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main chart ── */}
      <div className="section">
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">
              {chartType === 'heatmap'
                ? `Carte thermique — ${METRICS.find((m) => m.key === heatmapMetric)?.label}`
                : `Évolution sur ${period}h`}
            </span>
            {chartType !== 'heatmap' && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedMeta.map((m) => m.label).join(' · ')}
              </span>
            )}
          </div>

          {chartType === 'heatmap' ? (
            <HeatMap data={heatmapData} unit={heatmapUnit} />
          ) : chartData.length === 0 ? (
            <div className="empty-state">
              <Icon name="history" size={32} className="empty-state-icon" />
              <div className="empty-state-title">Pas de données</div>
              <div className="empty-state-text">Aucune mesure sur cette période.</div>
            </div>
          ) : (
            <div className="chart-container" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--chart-text)" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-text)" />
                    <Tooltip content={<CustomTooltip />} />
                    {selectedMeta.map(({ key, label, color, unit }) => (
                      <Bar key={key} dataKey={key} fill={color} fillOpacity={0.7} name={`${label} (${unit})`} radius={[2, 2, 0, 0]} />
                    ))}
                    <Brush dataKey="time" height={20} stroke="var(--border-default)" fill="var(--bg-elevated)" travellerWidth={5} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--chart-text)" interval="preserveStartEnd" />
                    {firstMetric  && <YAxis yAxisId="y1" domain={['auto','auto']} tick={{ fontSize: 10 }} stroke="var(--chart-text)" />}
                    {secondMetric && <YAxis yAxisId="y2" orientation="right" domain={['auto','auto']} tick={{ fontSize: 10 }} stroke="var(--chart-text)" />}
                    <Tooltip content={<CustomTooltip />} />
                    {selectedMeta.map(({ key, color }, idx) => {
                      const avg = stats[key]?.avg;
                      return avg != null ? (
                        <ReferenceLine
                          key={`ref-${key}`}
                          yAxisId={idx === 0 ? 'y1' : 'y2'}
                          y={avg}
                          stroke={color}
                          strokeDasharray="4 3"
                          strokeOpacity={0.4}
                        />
                      ) : null;
                    })}
                    {selectedMeta.map(({ key, label, color, unit }, idx) => (
                      <Line
                        key={key}
                        yAxisId={idx === 0 ? 'y1' : 'y2'}
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                        name={`${label} (${unit})`}
                      />
                    ))}
                    <Brush dataKey="time" height={20} stroke="var(--border-default)" fill="var(--bg-elevated)" travellerWidth={5} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Statistics table ── */}
      <div className="section">
        <div className="section-title">
          Statistiques de la période
          <div className="section-title-line" />
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mesure</th>
                  <th style={{ textAlign: 'right' }}>Min</th>
                  <th style={{ textAlign: 'right' }}>Max</th>
                  <th style={{ textAlign: 'right' }}>Moyenne</th>
                  <th style={{ textAlign: 'right' }}>Dernière valeur</th>
                  <th style={{ textAlign: 'right' }}>Relevés</th>
                  <th style={{ textAlign: 'center' }}>Tendance</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map(({ key, label, unit, color }) => {
                  const s     = stats[key];
                  const trend = trendArrow(filtered, key);
                  if (!s || s.count === 0) return null;
                  return (
                    <tr key={key}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {s.min != null ? `${fmt(s.min)} ${unit}` : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {s.max != null ? `${fmt(s.max)} ${unit}` : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {s.avg != null ? `${fmt(s.avg)} ${unit}` : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {s.last != null ? `${fmt(s.last)} ${unit}` : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {s.count}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 14, fontWeight: 700,
                          color: trend === 'up' ? 'var(--risk-high)' : trend === 'down' ? 'var(--risk-safe)' : 'var(--text-muted)',
                        }}>
                          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Anomaly log ── */}
      {anomalyData.length > 0 && (
        <div className="section">
          <div className="section-title">
            Journal des anomalies · {anomalyData.length} événement{anomalyData.length > 1 ? 's' : ''}
            <div className="section-title-line" />
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Horodatage</th>
                    <th style={{ textAlign: 'right' }}>Temp.</th>
                    <th style={{ textAlign: 'right' }}>Humidité</th>
                    <th style={{ textAlign: 'right' }}>Pression</th>
                    <th style={{ textAlign: 'right' }}>Vent</th>
                    <th style={{ textAlign: 'right' }}>Score anomalie</th>
                  </tr>
                </thead>
                <tbody>
                  {[...anomalyData].reverse().map((r, i) => {
                    const score = r.anomaly_score ?? 0;
                    const sevColor = score >= 0.9 ? 'var(--risk-critical)' : score >= 0.75 ? 'var(--risk-medium)' : 'var(--risk-low)';
                    return (
                      <tr key={r.id} style={{ borderLeft: `3px solid ${sevColor}` }}>
                        <td className="mono" style={{ color: 'var(--text-muted)', width: 40 }}>
                          {anomalyData.length - i}
                        </td>
                        <td className="mono" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {tsDate(r.timestamp)}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {r.temperature != null ? `${fmt(r.temperature)} °C` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {r.humidity != null ? `${fmt(r.humidity, 0)} %` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {r.pressure != null ? `${Math.round(r.pressure)} hPa` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {r.wind_speed != null ? `${fmt(r.wind_speed, 0)} km/h` : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
                            color: sevColor,
                          }}>
                            {fmt(score * 100, 0)} %
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
