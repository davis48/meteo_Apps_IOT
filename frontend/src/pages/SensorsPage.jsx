import { useEffect, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, Legend,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import MiniGauge       from '../components/ui/MiniGauge';
import LiveDot         from '../components/ui/LiveDot';
import CollapsibleCard from '../components/ui/CollapsibleCard';
import CustomTooltip   from '../components/charts/CustomTooltip';
import { fmt, ts }     from '../utils/helpers';

const CH = {
  temp: '#f97316', humidity: '#06b6d4',
  pressure: '#a855f7', wind: '#22c55e',
  rain: '#3b82f6', lux: '#f59e0b', anomaly: '#ef4444',
};
const GRID = 'rgba(100,116,139,0.08)';
const TICK = { fill: '#64748b', fontSize: 10 };

export default function SensorsPage({ nodes, historyByNode, latestByNode }) {
  const [selectedNode, setSelectedNode] = useState('node-001');
  const [period, setPeriod]             = useState('24h');

  useEffect(() => {
    if (nodes.length && !nodes.some((n) => n.id === selectedNode)) {
      setSelectedNode(nodes[0].id);
    }
  }, [nodes, selectedNode]);

  const rangeSec        = period === '6h' ? 6 * 3600 : period === '24h' ? 24 * 3600 : 7 * 86400;
  const fromTs          = Math.floor(Date.now() / 1000) - rangeSec;
  const selectedHistory = (historyByNode[selectedNode] || []).filter((d) => d.timestamp >= fromTs);
  const latest          = latestByNode[selectedNode] || selectedHistory[selectedHistory.length - 1];
  const selectedNodeObj = nodes.find((n) => n.id === selectedNode);

  const data = selectedHistory.map((d) => ({
    time:     ts(d.timestamp),
    Temp:     d.temperature,
    Hum:      d.humidity,
    Press:    d.pressure,
    Pluie:    d.rain_level,
    Vent:     d.wind_speed,
    Anomalie: +(d.anomaly_score * 100).toFixed(1),
  }));

  const gauges = [
    { label: 'Température', value: latest?.temperature, unit: '°C',   max: 55,   color: CH.temp     },
    { label: 'Humidité',    value: latest?.humidity,    unit: '%',    max: 100,  color: CH.humidity },
    { label: 'Pression',    value: latest?.pressure,    unit: 'hPa',  max: 1050, color: CH.pressure },
    { label: 'Vent',        value: latest?.wind_speed,  unit: 'm/s',  max: 30,   color: CH.wind     },
    { label: 'Pluie',       value: latest?.rain_level,  unit: 'mm/h', max: 20,   color: CH.rain     },
    { label: 'Luminosité',  value: latest?.luminosity,  unit: ' lux', max: 1000, color: CH.lux      },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Données Capteurs</div>
          {selectedNodeObj && (
            <div className="page-subtitle">
              <LiveDot active={selectedNodeObj.status === 'online'} /> {selectedNodeObj.name} — {selectedNodeObj.location || 'Emplacement inconnu'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedNode(n.id)}
              className={`btn-ghost${selectedNode === n.id ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <LiveDot active={n.status === 'online'} />
              {n.name}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {['6h', '24h', '7d'].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`btn-ghost${period === p ? ' active' : ''}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 6 Gauge cards */}
      <div className="grid grid-3" style={{ marginBottom: 14 }}>
        {gauges.map(({ label, value, unit, max, color }) => (
          <div key={label} className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, color,
                background: `${color}18`, border: `1px solid ${color}30`,
                borderRadius: 4, padding: '1px 6px',
              }}>
                {unit.trim()}
              </span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, marginBottom: 14, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(value)}
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 3 }}>{unit}</span>
            </div>
            <MiniGauge value={value} max={max} color={color} label={`${Math.round(((value||0)/max)*100)}% max`} unit="" />
          </div>
        ))}
      </div>

      {/* Graphique Temp & Humidité */}
      <CollapsibleCard
        title="Température & Humidité"
        action={<span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{period}</span>}
        style={{ marginBottom: 14 }}
        defaultOpen
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gST" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CH.temp}     stopOpacity={0.3} />
                <stop offset="95%" stopColor={CH.temp}     stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gSH" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CH.humidity} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CH.humidity} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Area type="monotone" dataKey="Temp" name="Temp (°C)"    stroke={CH.temp}     fill="url(#gST)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Hum"  name="Humidité (%)" stroke={CH.humidity} fill="url(#gSH)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </CollapsibleCard>

      {/* Ligne bas : Anomalie + Vent/Pluie */}
      <div className="grid grid-2">
        <CollapsibleCard title="Score Anomalie IA (%)" defaultOpen>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gSA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CH.anomaly} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CH.anomaly} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="time"    tick={TICK} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Anomalie" stroke={CH.anomaly} fill="url(#gSA)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={() => 70} stroke="#f97316" strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CollapsibleCard>

        <CollapsibleCard title="Vent & Précipitations" defaultOpen>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="time" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
              <Line type="monotone" dataKey="Vent"  stroke={CH.wind} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Pluie" stroke={CH.rain} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleCard>
      </div>
    </div>
  );
}
