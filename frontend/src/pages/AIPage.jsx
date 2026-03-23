import {
  Area, AreaChart, CartesianGrid,
  Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Badge           from '../components/ui/Badge';
import MiniGauge       from '../components/ui/MiniGauge';
import CollapsibleCard from '../components/ui/CollapsibleCard';
import CustomTooltip   from '../components/charts/CustomTooltip';
import { ts, fmt }     from '../utils/helpers';

const GRID = 'rgba(100,116,139,0.08)';
const TICK = { fill: '#64748b', fontSize: 10 };

const FALLBACK_AI = {
  embedded_model: { name: 'Autoencoder TinyML', status: 'active', precision: 89.1, recall: 91.3, f1_score: 90.2, inference_latency_ms: 120, memory_footprint_kb: 164 },
  cloud_model:    { name: 'LSTM Forecast', status: 'active', mae_temp: 1.4, mae_pressure: 4.2, mae_humidity: 5.1, extreme_event_accuracy: 82.0, retrain_policy: 'weekly-auto' },
  realtime:       { anomaly_threshold: 70, sample_count_24h: 144, anomaly_count_24h: 2, avg_risk_probability: 0.08 },
};
const FALLBACK_PREDS = [3, 6, 12, 24].map((h) => ({
  horizon_hours: h, predicted_temp: 29.0 + h * 0.3,
  predicted_humidity: 68.0, predicted_pressure: 1012.0,
  extreme_event_probability: 0.05, event_type: null,
}));

const riskMeta = (p) => {
  if (p > 0.35) return { color: '#ef4444', label: 'Élevé',  bg: '#ef444418' };
  if (p > 0.2)  return { color: '#f97316', label: 'Modéré', bg: '#f9731618' };
  return              { color: '#22c55e', label: 'Normal', bg: '#22c55e18' };
};

export default function AIPage({ history, predictions, aiMetrics }) {
  const metrics   = aiMetrics || FALLBACK_AI;
  const embedded  = metrics.embedded_model || FALLBACK_AI.embedded_model;
  const cloud     = metrics.cloud_model    || FALLBACK_AI.cloud_model;
  const realtime  = metrics.realtime       || FALLBACK_AI.realtime;
  const threshold = realtime.anomaly_threshold ?? 70;
  const preds     = predictions?.length ? predictions : FALLBACK_PREDS;

  const anomalyData = history.slice(-24).map((d) => ({
    time:  ts(d.timestamp),
    Score: +(d.anomaly_score * 100).toFixed(1),
    Seuil: threshold,
  }));

  const statusBadge = (status) =>
    status === 'active'
      ? <Badge color="var(--green)"  bg="var(--green-dim)">Actif</Badge>
      : <Badge color="var(--yellow)" bg="var(--yellow-dim)">Dégradé</Badge>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Intelligence Artificielle</div>
          <div className="page-subtitle">Modèles TinyML embarqués &middot; Détection d’anomalies &middot; Prévisions</div>
        </div>
        <Badge color="var(--purple)" bg="var(--purple-dim)">
          {embedded.status === 'active' && cloud.status === 'active' ? 'TinyML + LSTM actifs' : 'Modèles en vérification'}
        </Badge>
      </div>

      {/* Cartes modèles côte à côte */}
      <div className="grid grid-2" style={{ marginBottom: 14 }}>

        <CollapsibleCard
          title="Modèle embarqué — Détection anomalies"
          action={statusBadge(embedded.status)}
          defaultOpen
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{embedded.name}</span>
          </div>
          <MiniGauge value={embedded.precision}            max={100} color="#22c55e" label="Précision globale"   unit="%" />
          <MiniGauge value={embedded.recall}               max={100} color="#22c55e" label="Rappel"              unit="%" />
          <MiniGauge value={embedded.f1_score}             max={100} color="#3b82f6" label="F1-Score"            unit="%" />
          <MiniGauge value={embedded.inference_latency_ms} max={300} color="#a855f7" label="Latence inférence"   unit=" ms" />
          <MiniGauge value={embedded.memory_footprint_kb}  max={256} color="#f97316" label="Empreinte mémoire"   unit=" Ko" />
          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {statusBadge(embedded.status)}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {realtime.sample_count_24h ?? 0} échantillons / 24h
            </span>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="Modèle cloud — Prévision LSTM"
          action={statusBadge(cloud.status)}
          defaultOpen
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{cloud.name}</span>
          </div>
          <MiniGauge value={cloud.mae_temp}               max={4}   color="#22c55e" label="MAE Température"     unit=" °C" />
          <MiniGauge value={cloud.mae_pressure}           max={12}  color="#22c55e" label="MAE Pression"        unit=" hPa" />
          <MiniGauge value={cloud.mae_humidity}           max={14}  color="#3b82f6" label="MAE Humidité"        unit="%" />
          <MiniGauge value={cloud.extreme_event_accuracy} max={100} color="#22c55e" label="Précision événement" unit="%" />
          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {statusBadge(cloud.status)}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              {cloud.retrain_policy || 'weekly-auto'}
            </span>
          </div>
        </CollapsibleCard>

      </div>

      {/* Score anomalie */}
      <CollapsibleCard
        title="Score d'anomalie temps réel (24h)"
        action={
          <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Anomalies : <strong style={{ color: '#ef4444' }}>{realtime.anomaly_count_24h ?? 0}</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Risque : <strong style={{ color: '#f97316' }}>{((realtime.avg_risk_probability ?? 0) * 100).toFixed(0)}%</strong>
            </span>
          </div>
        }
        style={{ marginBottom: 14 }}
        defaultOpen
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={anomalyData}>
            <defs>
              <linearGradient id="gAnoScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time"    tick={TICK} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Score" stroke="#ef4444" fill="url(#gAnoScore)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Seuil" stroke="#f97316" strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </CollapsibleCard>

      {/* Prévisions LSTM */}
      <CollapsibleCard
        title="Prévisions LSTM"
        action={<span style={{ fontSize: 10, color: 'var(--text-dim)' }}>3h · 6h · 12h · 24h</span>}
        defaultOpen
      >
        <div className="grid grid-4">
          {preds.map((p) => {
            const risk = riskMeta(p.extreme_event_probability);
            return (
              <div key={p.horizon_hours} className="prediction-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    +{p.horizon_hours}h
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: risk.color, background: risk.bg,
                    border: `1px solid ${risk.color}30`, borderRadius: 5, padding: '2px 7px',
                  }}>
                    {risk.label}
                  </span>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Température</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: '#f97316', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(p.predicted_temp)}
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>°C</span>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Humidité</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#06b6d4', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(p.predicted_humidity)}<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Pression</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#a855f7', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(p.predicted_pressure)}<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>hPa</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Risque extrême</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: risk.color, fontVariantNumeric: 'tabular-nums' }}>
                      {(p.extreme_event_probability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${p.extreme_event_probability * 100}%`,
                      background: risk.color, borderRadius: 99, transition: 'width 0.5s ease',
                    }} />
                  </div>
                  {p.event_type && (
                    <div style={{ fontSize: 9, color: risk.color, marginTop: 4, fontWeight: 600 }}>{p.event_type}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleCard>
    </div>
  );
}
