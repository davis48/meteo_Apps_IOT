import {
  LineChart, Line, BarChart, Bar, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts';
import CustomTooltip from '../components/charts/CustomTooltip';
import Icon from '../components/ui/Icon';
import {
  fmt, tsDate, ts, toChartData, groupByNode,
  riskLevel, SENSOR_COLORS,
} from '../utils/helpers';

// ── Mini horizontal progress bar ──────────────────────────────
function MetricBar({ label, value, max, unit, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {value != null ? `${fmt(value)} ${unit}` : '—'}
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── AI Model metric gauge ──────────────────────────────────────
function ModelGauge({ label, value, color = 'var(--accent)' }) {
  const pct = value != null ? Math.min(100, value * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {value != null ? `${(value * 100).toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Forecast horizon card ──────────────────────────────────────
function ForecastCard({ pred, accent }) {
  if (!pred) return (
    <div className="forecast-card" style={{ '--card-accent': accent }}>
      <div className="forecast-horizon">{accent}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Données insuffisantes</div>
    </div>
  );
  // Risques calculés à partir des données de prédiction disponibles (pas de rain_level/wind prédit)
  const extreme = pred.extreme_event_probability ?? 0;
  const isFlood = pred.predicted_humidity > 80 || (pred.event_type || '').toLowerCase().includes('flood');
  const isStorm = (pred.event_type || '').toLowerCase().includes('storm') || (pred.event_type || '').toLowerCase().includes('vent');
  const flood = Math.round(extreme * 100 * (isFlood ? 1 : 0.35));
  const storm = Math.round(extreme * 100 * (isStorm ? 1 : 0.25));
  const rl = riskLevel(Math.round(extreme * 100));

  return (
    <div className="forecast-card" style={{ '--card-accent': accent }}>
      <div className="forecast-horizon">Dans {pred.horizon_hours}h</div>
      <div className="forecast-temp">
        {fmt(pred.predicted_temp)}<span>°C</span>
      </div>
      <div className="forecast-metrics">
        <div className="forecast-row">
          <span className="forecast-row-label"><Icon name="humidity" size={12} color={SENSOR_COLORS.humidity} /> Humidité</span>
          <span className="forecast-row-val">{fmt(pred.predicted_humidity)}%</span>
        </div>
        <div className="forecast-row">
          <span className="forecast-row-label"><Icon name="pressure" size={12} color={SENSOR_COLORS.pressure} /> Pression</span>
          <span className="forecast-row-val">{pred.predicted_pressure != null ? Math.round(pred.predicted_pressure) : '—'} hPa</span>
        </div>
        {pred.event_type && (
          <div className="forecast-row">
            <span className="forecast-row-label"><Icon name="storm" size={12} color="var(--risk-medium)" /> Événement</span>
            <span className="forecast-row-val" style={{ color: 'var(--risk-medium)' }}>{pred.event_type}</span>
          </div>
        )}
      </div>
      <div className="forecast-risk-section">
        <div className="forecast-risk-label">Probabilité événement extrême</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${(extreme || 0) * 100}%`, background: rl.color }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: rl.color, minWidth: 32, textAlign: 'right' }}>
            {extreme != null ? `${(extreme * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <span className={`risk-badge ${rl.cls}`} style={{ fontSize: 9 }}>{rl.label}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Couleurs par horizon : du plus proche (bleu) au plus lointain (orange plus incertain)
const HORIZON_COLORS = { 3: '#3b82f6', 6: '#06b6d4', 12: '#f97316', 24: '#64748b' };

export default function ForecastPage({ predictions = [], aiMetrics, history = [], nodes = [] }) {
  // Group predictions by horizon
  const byHorizon = {};
  predictions.forEach((p) => {
    const h = p.horizon_hours;
    if (!byHorizon[h] || p.created_at > byHorizon[h].created_at) byHorizon[h] = p;
  });

  // Build chart data from predictions
  const predChartData = [3, 6, 12, 24].map((h) => {
    const p = byHorizon[h];
    return {
      horizon: `+${h}h`,
      predicted_temp: p?.predicted_temp != null ? Number(p.predicted_temp.toFixed(1)) : null,
      predicted_humidity: p?.predicted_humidity != null ? Number(p.predicted_humidity.toFixed(1)) : null,
      predicted_pressure: p?.predicted_pressure != null ? Number(p.predicted_pressure.toFixed(1)) : null,
      extreme_prob: p?.extreme_event_probability != null ? Number((p.extreme_event_probability * 100).toFixed(1)) : null,
    };
  });

  // Get current actual values from latest history point
  const grouped = groupByNode(history);
  const firstNodeHistory = Object.values(grouped)[0] || [];
  const latestActual = firstNodeHistory[firstNodeHistory.length - 1];

  // Anomaly history for chart
  const anomalyData = firstNodeHistory.slice(-30).map((r) => ({
    time: ts(r.timestamp),
    anomaly_score: r.anomaly_score != null ? Number((r.anomaly_score * 100).toFixed(1)) : 0,
    is_anomaly: r.is_anomaly ? 100 : 0,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Prévisions IA</div>
          <div className="page-subtitle">Modèle LSTM · Prédictions adaptatives · Détection événements extrêmes</div>
        </div>
        <div className="page-header-right">
          {aiMetrics && (
            <span className="badge badge-blue">
              <Icon name="ai" size={11} color="#60a5fa" /> Modèle actif
            </span>
          )}
        </div>
      </div>

      {/* ── Forecast cards ────────────────────────────────── */}
      <div className="section">
        <div className="section-title">Prévisions météo <div className="section-title-line" /></div>
        <div className="grid-4">
          {[3, 6, 12, 24].map((h) => (
            <ForecastCard key={h} pred={byHorizon[h]} accent={HORIZON_COLORS[h]} />
          ))}
        </div>
      </div>

      {/* ── Prediction charts ─────────────────────────────── */}
      <div className="grid-2 section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Température & Humidité prévues</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={predChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="horizon" tick={{ fontSize: 12 }} stroke="var(--chart-text)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--chart-text)" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="predicted_temp" stroke="#f97316" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f97316' }} name="Temp. prévue (°C)" />
                <Line type="monotone" dataKey="predicted_humidity" stroke={SENSOR_COLORS.humidity} strokeWidth={2.5}
                  dot={{ r: 4, fill: SENSOR_COLORS.humidity }} name="Humidité prévue (%)" />
                {latestActual && (
                  <ReferenceLine y={latestActual.temperature} stroke="#f97316" strokeDasharray="4 2"
                    label={{ value: 'Actuel', fill: 'var(--chart-text)', fontSize: 10 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Pression prévue & Probabilité événement extrême</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={predChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="horizon" tick={{ fontSize: 12 }} stroke="var(--chart-text)" />
                <YAxis yAxisId="p" domain={['auto','auto']} tick={{ fontSize: 11 }} stroke="var(--chart-text)" />
                <YAxis yAxisId="e" orientation="right" domain={[0,100]} tick={{ fontSize: 11 }} stroke="var(--chart-text)" />
                <Tooltip content={<CustomTooltip />} />
                <Line yAxisId="p" type="monotone" dataKey="predicted_pressure" stroke={SENSOR_COLORS.pressure} strokeWidth={2.5}
                  dot={{ r: 4, fill: SENSOR_COLORS.pressure }} name="Pression (hPa)" />
                <Line yAxisId="e" type="monotone" dataKey="extreme_prob" stroke={SENSOR_COLORS.anomaly_score} strokeWidth={2}
                  dot={{ r: 4, fill: SENSOR_COLORS.anomaly_score }} name="Prob. extrême (%)" strokeDasharray="5 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── AI Model metrics ──────────────────────────────── */}
      {aiMetrics && (
        <div className="section">
          <div className="section-title">Performance modèles IA <div className="section-title-line" /></div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Modèle TinyML (Détection anomalies)</span>
                <span className="badge badge-blue">Embarqué ESP32</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ModelGauge label="Précision"     value={aiMetrics.tinyml?.accuracy} color="var(--accent)" />
                <ModelGauge label="Rappel (Recall)" value={aiMetrics.tinyml?.recall}   color="var(--accent)" />
                <ModelGauge label="Score F1"       value={aiMetrics.tinyml?.f1_score}  color="var(--accent)" />
                <ModelGauge label="Score AUC-ROC"  value={aiMetrics.tinyml?.auc_roc}   color="var(--accent)" />
              </div>
              {aiMetrics.tinyml && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Fenêtre glissante</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{aiMetrics.tinyml.window_size || '—'} pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Anomalies détectées</span>
                    <span style={{ fontWeight: 600 }}>{aiMetrics.tinyml.anomalies_detected ?? '—'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Modèle LSTM (Prévisions)</span>
                <span className="badge badge-green">Serveur</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ModelGauge label="MAE Température" value={aiMetrics.lstm?.mae_temperature ? 1 - (aiMetrics.lstm.mae_temperature / 10) : null} color="#f97316" />
                <ModelGauge label="MAE Humidité"    value={aiMetrics.lstm?.mae_humidity    ? 1 - (aiMetrics.lstm.mae_humidity / 30) : null}    color={SENSOR_COLORS.humidity} />
                <ModelGauge label="MAE Pression"    value={aiMetrics.lstm?.mae_pressure    ? 1 - (aiMetrics.lstm.mae_pressure / 20) : null}    color={SENSOR_COLORS.pressure} />
                <ModelGauge label="Fiabilité prédictions" value={aiMetrics.lstm?.reliability} color="var(--accent)" />
              </div>
              {aiMetrics.lstm && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Séquence d'entrée</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{aiMetrics.lstm.sequence_length || '—'} pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Prédictions générées</span>
                    <span style={{ fontWeight: 600 }}>{aiMetrics.lstm.predictions_made ?? '—'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Anomaly history ───────────────────────────────── */}
      <div className="section">
        <div className="section-title">Historique des anomalies IA <div className="section-title-line" /></div>
        <div className="card">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={anomalyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--chart-text)" interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--chart-text)" unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={70} stroke="var(--risk-high)" strokeDasharray="4 2" label={{ value: 'Seuil 70%', fill: 'var(--risk-high)', fontSize: 10 }} />
                <Bar dataKey="anomaly_score" fill={SENSOR_COLORS.anomaly_score} name="Score anomalie (%)" radius={[2,2,0,0]}
                  label={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Score &gt; 70% : anomalie détectée. Facteurs analysés : seuils absolus, z-score glissant, gradient temporel, corrélation croisée.
          </div>
        </div>
      </div>
    </div>
  );
}
