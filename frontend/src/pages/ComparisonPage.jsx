import { useState, useMemo } from 'react';
import {
  LineChart, Line, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend, ReferenceLine,
} from 'recharts';
import {
  fmt, tsDate, computeStats, trendArrow, SENSOR_COLORS, riskLevel,
} from '../utils/helpers';
import CustomTooltip from '../components/charts/CustomTooltip';
import Icon from '../components/ui/Icon';

// Distinct colors for up to 6 stations
const STATION_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#64748b', '#06b6d4', '#14b8a6'];

const METRICS = [
  { key: 'temperature',   label: 'Température',   unit: '°C',   color: '#f97316',              icon: 'thermometer' },
  { key: 'humidity',      label: 'Humidité',       unit: '%',    color: SENSOR_COLORS.humidity,  icon: 'humidity'    },
  { key: 'pressure',      label: 'Pression',       unit: 'hPa',  color: SENSOR_COLORS.pressure,  icon: 'pressure'    },
  { key: 'wind_speed',    label: 'Vent',           unit: 'km/h', color: SENSOR_COLORS.wind_speed, icon: 'wind'       },
  { key: 'rain_level',    label: 'Pluie',          unit: 'mm',   color: SENSOR_COLORS.rain_level, icon: 'rain'       },
  { key: 'luminosity',    label: 'Luminosité',     unit: 'lux',  color: SENSOR_COLORS.luminosity, icon: 'luminosity' },
];

const PERIODS = [
  { value: 6,   label: '6h'  },
  { value: 24,  label: '24h' },
  { value: 72,  label: '3j'  },
  { value: 168, label: '7j'  },
];

// Align series from multiple nodes to common time buckets (30-min slots)
function buildComparisonData(historyByNode, selectedNodeIds, metric, period) {
  const cutoff = Date.now() / 1000 - period * 3600;
  const SLOT   = 30 * 60; // 30 minutes in seconds

  // Collect + bucket
  const buckets = {};
  selectedNodeIds.forEach((nid) => {
    const rows = (historyByNode[nid] || []).filter((r) => r.timestamp >= cutoff);
    rows.forEach((r) => {
      const slot    = Math.floor(r.timestamp / SLOT) * SLOT;
      const slotKey = slot.toString();
      if (!buckets[slotKey]) buckets[slotKey] = { _slot: slot };
      const vals = (buckets[slotKey][`_${nid}`] = buckets[slotKey][`_${nid}`] || []);
      if (r[metric] != null) vals.push(parseFloat(r[metric]));
    });
  });

  // Compute averages per bucket
  return Object.values(buckets)
    .sort((a, b) => a._slot - b._slot)
    .map((bucket) => {
      const out = { time: tsDate(bucket._slot) };
      selectedNodeIds.forEach((nid) => {
        const vals = bucket[`_${nid}`];
        out[nid] = vals?.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
      });
      return out;
    });
}

// Ranking card
function RankCard({ metric, nodes, latestByNode, stationColors }) {
  const data = nodes
    .map((n) => {
      const v = latestByNode[n.id]?.[metric.key];
      return { node: n, value: v != null ? parseFloat(v) : null };
    })
    .filter((d) => d.value !== null)
    .sort((a, b) => b.value - a.value);

  if (!data.length) return null;
  const winner = data[0];
  const loser  = data[data.length - 1];
  const idx    = nodes.findIndex((n) => n.id === winner.node.id);
  const winnerColor = stationColors[idx] || '#3b82f6';

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 12, padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon name={metric.icon} size={13} color="var(--text-muted)" />{metric.label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Plus élevé</div>
          <div style={{ fontWeight: 800, fontSize: 13, color: winnerColor }}>{winner.node.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>
            {fmt(winner.value)}{metric.unit}
          </div>
        </div>
        {data.length > 1 && loser.node.id !== winner.node.id && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Plus bas</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>{loser.node.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              {fmt(loser.value)}{metric.unit}
            </div>
          </div>
        )}
      </div>
      {/* Mini bar for each station */}
      {data.length > 1 && (
        <div style={{ marginTop: 8 }}>
          {data.map((d) => {
            const ni  = nodes.findIndex((n) => n.id === d.node.id);
            const col = stationColors[ni] || '#3b82f6';
            const pct = ((d.value - loser.value) / ((winner.value - loser.value) || 1)) * 100;
            return (
              <div key={d.node.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                  {fmt(d.value, 1)}{metric.unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Delta table
function DeltaTable({ nodes, latestByNode, stationColors, selectedNodeIds }) {
  const selected = nodes.filter((n) => selectedNodeIds.includes(n.id));
  if (selected.length < 2) return null;

  const [a, b] = selected;
  const la = latestByNode[a.id];
  const lb = latestByNode[b.id];
  if (!la || !lb) return null;

  const ia = nodes.findIndex((n) => n.id === a.id);
  const ib = nodes.findIndex((n) => n.id === b.id);

  return (
    <div className="section">
      <div className="section-title">
        Écart entre {a.name} et {b.name}
        <div className="section-title-line" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Mesure</th>
              <th style={{ color: stationColors[ia] }}>{a.name}</th>
              <th style={{ color: stationColors[ib] }}>{b.name}</th>
              <th>Delta (A−B)</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ key, label, unit }) => {
              const va  = la[key] != null ? parseFloat(la[key]) : null;
              const vb  = lb[key] != null ? parseFloat(lb[key]) : null;
              const delta = va != null && vb != null ? va - vb : null;
              const col = delta == null ? 'var(--text-muted)' :
                          delta > 0    ? '#f97316' : delta < 0 ? '#3b82f6' : 'var(--text-secondary)';
              return (
                <tr key={key}>
                  <td style={{ fontWeight: 600 }}>{label}</td>
                  <td className="mono" style={{ color: stationColors[ia] }}>{va != null ? `${fmt(va)} ${unit}` : '—'}</td>
                  <td className="mono" style={{ color: stationColors[ib] }}>{vb != null ? `${fmt(vb)} ${unit}` : '—'}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: col }}>
                      {delta != null ? `${delta > 0 ? '+' : ''}${fmt(delta)} ${unit}` : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ComparisonPage({ nodes = [], historyByNode = {}, latestByNode = {} }) {
  const [selectedNodeIds, setSelectedNodeIds] = useState(() =>
    nodes.slice(0, Math.min(2, nodes.length)).map((n) => n.id)
  );
  const [metric, setMetric] = useState('temperature');
  const [period, setPeriod] = useState(24);

  const stationColors = useMemo(() =>
    nodes.reduce((acc, n, i) => {
      acc[n.id] = STATION_COLORS[i % STATION_COLORS.length];
      return acc;
    }, {}),
    [nodes]
  );

  const colorArr = nodes.map((_, i) => STATION_COLORS[i % STATION_COLORS.length]);

  const toggleNode = (id) => {
    setSelectedNodeIds((prev) =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter((x) => x !== id) : prev
        : [...prev, id].slice(0, 4)
    );
  };

  // Build comparison chart data
  const compData = useMemo(
    () => buildComparisonData(historyByNode, selectedNodeIds, metric, period),
    [historyByNode, selectedNodeIds, metric, period]
  );

  // Stats per station for selected metric
  const statsPerStation = useMemo(() =>
    nodes.filter((n) => selectedNodeIds.includes(n.id)).map((n) => {
      const cutoff = Date.now() / 1000 - period * 3600;
      const rows   = (historyByNode[n.id] || []).filter((r) => r.timestamp >= cutoff);
      const s      = computeStats(rows, metric);
      const trend  = trendArrow(rows, metric);
      const latest = latestByNode[n.id];
      const overall = latest?.overall_risk ?? 0;
      return { node: n, stats: s, trend, risk: riskLevel(overall) };
    }),
    [nodes, selectedNodeIds, historyByNode, latestByNode, metric, period] // eslint-disable-line
  );

  const selectedMetaMeta = METRICS.find((m) => m.key === metric);

  if (nodes.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div><div className="page-title">Comparaison</div></div>
        </div>
        <div className="section">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-title">Aucune station disponible</div>
              <div className="empty-state-text">Ajoutez des stations dans l'onglet Stations IoT.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Comparaison des Stations</div>
          <div className="page-subtitle">
            Analyse comparative — {selectedNodeIds.length} station{selectedNodeIds.length > 1 ? 's' : ''} sélectionnée{selectedNodeIds.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="page-header-right">
          <div className="tabs">
            {PERIODS.map(({ value, label }) => (
              <button key={value} className={`tab${period === value ? ' active' : ''}`} onClick={() => setPeriod(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Station selector ── */}
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Stations :</span>
          {nodes.map((n, i) => {
            const color    = STATION_COLORS[i % STATION_COLORS.length];
            const isActive = selectedNodeIds.includes(n.id);
            const latest   = latestByNode[n.id];
            return (
              <button
                key={n.id}
                onClick={() => toggleNode(n.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 10,
                  border: `1.5px solid ${isActive ? color : 'var(--border-default)'}`,
                  background: isActive ? `${color}18` : 'var(--bg-elevated)',
                  color: isActive ? color : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--font-sans)', transition: 'all .15s',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span>{n.name}</span>
                {latest?.temperature != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: .85 }}>
                    {fmt(latest.temperature)}°C
                  </span>
                )}
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 6,
                  background: n.status === 'online' ? 'rgba(34,197,94,.2)' : 'rgba(148,163,184,.1)',
                  color: n.status === 'online' ? '#22c55e' : 'var(--text-muted)', fontWeight: 700,
                }}>
                  {n.status === 'online' ? '●' : '○'}
                </span>
              </button>
            );
          })}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
            (max 4 stations)
          </span>
        </div>
      </div>

      {/* ── Rankings ── */}
      <div className="section">
        <div className="section-title">
          Classement en temps réel
          <div className="section-title-line" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {METRICS.map((m) => (
            <RankCard
              key={m.key}
              metric={m}
              nodes={nodes}
              latestByNode={latestByNode}
              stationColors={colorArr}
            />
          ))}
        </div>
      </div>

      {/* ── Metric selector + Chart ── */}
      <div className="section">
        <div className="section-title">
          Graphique comparatif
          <div className="section-title-line" />
        </div>

        {/* Metric tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {METRICS.map(({ key, label, unit, icon }) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`tab${metric === key ? ' active' : ''}`}
              style={{ fontSize: 11 }}
            >
              <Icon name={icon} size={12} color="currentColor" /> {label} ({unit})
            </button>
          ))}
        </div>

        <div className="card">
          {compData.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-title">Pas de données</div>
              <div className="empty-state-text">Aucune mesure disponible pour cette période.</div>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={compData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--chart-text)" interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} stroke="var(--chart-text)" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {nodes
                    .filter((n) => selectedNodeIds.includes(n.id))
                    .map((n, i) => {
                      const color = stationColors[n.id];
                      return (
                        <Line
                          key={n.id}
                          type="monotone"
                          dataKey={n.id}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          name={`${n.name} (${selectedMetaMeta?.unit || ''})`}
                          connectNulls
                        />
                      );
                    })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats per station ── */}
      <div className="section">
        <div className="section-title">
          Statistiques par station — {selectedMetaMeta?.label} sur {PERIODS.find((p) => p.value === period)?.label}
          <div className="section-title-line" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {statsPerStation.map(({ node, stats, trend, risk }) => {
            const color = stationColors[node.id];
            const latest = latestByNode[node.id];
            return (
              <div key={node.id} className="card" style={{ border: `1px solid ${color}30` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color }}>{node.name}</span>
                  </div>
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 8,
                    background: `${risk.color}20`, color: risk.color, fontWeight: 700,
                  }}>{risk.label}</span>
                </div>

                {/* Current value big */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Valeur actuelle</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 22, color }}>
                    {latest?.[metric] != null ? fmt(latest[metric]) : '—'}
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                      {selectedMetaMeta?.unit}
                    </span>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { label: 'Min', value: stats.min },
                    { label: 'Max', value: stats.max },
                    { label: 'Moyenne', value: stats.avg },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: 'var(--bg-elevated)', borderRadius: 8, padding: '6px 10px',
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
                        {value != null ? fmt(value) : '—'}
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}> {selectedMetaMeta?.unit}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Tendance</div>
                    <div style={{
                      fontWeight: 800, fontSize: 16,
                      color: trend === 'up' ? '#ef4444' : trend === 'down' ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Delta table ── */}
      <DeltaTable
        nodes={nodes}
        latestByNode={latestByNode}
        stationColors={colorArr}
        selectedNodeIds={selectedNodeIds}
      />
    </div>
  );
}
