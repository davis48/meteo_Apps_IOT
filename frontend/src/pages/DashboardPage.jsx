import {
  Area, AreaChart, BarChart, Bar, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts';
import CustomTooltip from '../components/charts/CustomTooltip';
import StatCard from '../components/ui/StatCard';
import LiveDot from '../components/ui/LiveDot';
import Icon from '../components/ui/Icon';
import {
  fmt, ts, tsDate, timeAgo, toChartData, groupByNode,
  riskLevel, pressureTrend, pressureTrendLabel,
  SENSOR_COLORS,
} from '../utils/helpers';

// ── Correspondance condition (libellé français backend) → nom d'icône SVG ──
const COND_ICON = {
  'Tempête':              'storm',
  'Forte pluie':          'rain',
  'Pluie':                'rain',
  'Vent violent':         'wind',
  'Dépression':           'cloud',
  'Nuageux':              'cloud',
  'Ensoleillé':           'sun',
  'Partiellement nuageux':'sun',
  'Chaud':               'thermometer',
  'Gel':                 'thermometer',
  'Stable':              'weather',
};

// ---------- WeatherHero component ----------
function WeatherHero({ latest, condition, primaryNode }) {
  const temp = latest?.temperature ?? null;

  const tempColor = temp == null ? 'var(--text-primary)'
    : temp >= 32 ? '#f97316'
    : temp < 18 ? '#60a5fa'
    : 'var(--text-primary)';

  const condIconName = COND_ICON[condition?.icon] || 'weather';

  return (
    <div className="weather-hero">
      {/* Icône météo */}
      <div className="weather-hero-emoji" style={{ opacity: 0.5 }}>
        <Icon name={condIconName} size={52} color="var(--text-secondary)" />
      </div>

      {/* Temperature + condition */}
      <div>
        <div className="weather-hero-temp">
          <span className="weather-hero-temp-val" style={{ color: tempColor }}>
            {temp != null ? fmt(temp, 1) : '—'}
          </span>
          <span className="weather-hero-temp-unit">°C</span>
        </div>
        <div className="weather-hero-condition">
          {condition?.label || 'Données météo'}
        </div>
      </div>

      <div className="weather-hero-divider" />

      {/* Key metrics inline */}
      <div className="weather-hero-metrics">
        {[
          { label: 'Humidité',  value: fmt(latest?.humidity),        unit: '%',    color: SENSOR_COLORS.humidity },
          { label: 'Vent',      value: fmt(latest?.wind_speed, 0),   unit: 'km/h', color: SENSOR_COLORS.wind_speed },
          { label: 'Pression',  value: latest?.pressure != null ? Math.round(latest.pressure) : '—', unit: 'hPa', color: SENSOR_COLORS.pressure },
          { label: 'Pluie',     value: fmt(latest?.rain_level, 1),   unit: 'mm',   color: SENSOR_COLORS.rain_level },
        ].map(({ label, value, unit, color }) => (
          <div key={label}>
            <div className="weather-hero-metric-label">{label}</div>
            <div className="weather-hero-metric-value" style={{ color }}>
              {value}
              <span className="weather-hero-metric-unit">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Station info */}
      {primaryNode && (
        <div className="weather-hero-station">
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>Station</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3 }}>{primaryNode.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{primaryNode.location || primaryNode.id}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: primaryNode.status === 'online' ? 'var(--color-online)' : 'var(--color-offline)', animation: primaryNode.status === 'online' ? 'pulse-dot 2s infinite' : undefined }} />
            <span style={{ fontSize: 10, color: primaryNode.status === 'online' ? 'var(--color-online)' : 'var(--text-muted)', fontWeight: 600 }}>
              {primaryNode.status === 'online' ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Small RiskGauge component ----------
function RiskGauge({ label, score, icon }) {
  const rl = riskLevel(score);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={icon} size={14} color={rl.color} /> {label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: rl.color }}>{score != null ? `${Math.round(score)}%` : '—'}</span>
      </div>
      <div className="risk-bar">
        <div className="risk-bar-fill" style={{ width: `${score || 0}%`, background: rl.color }} />
      </div>
    </div>
  );
}

// ---------- DashboardPage ----------
export default function DashboardPage({ liveData, history, alerts = [], summary, nodes = [], onNav }) {
  // Pick primary station data
  const primaryNode = nodes.find((n) => n.status === 'online') || nodes[0];
  const latest = liveData || (primaryNode ? null : null);

  // Collect all history data merged for primary node
  const grouped = groupByNode(history || []);
  const primaryId = primaryNode?.id;
  const primaryHistory = primaryId ? (grouped[primaryId] || []) : [];

  // Also build a merged "all nodes" chart (average per timestamp bucket, simpler: just use first node)
  const chartData = toChartData(primaryHistory, ['temperature', 'humidity']);
  const pressChartData = toChartData(primaryHistory, ['pressure']);
  const rainChartData  = toChartData(primaryHistory.slice(-24), ['rain_level', 'wind_speed']);

  const activeAlerts   = alerts.filter((a) => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
  const warningAlerts  = activeAlerts.filter((a) => a.severity === 'warning');

  // Utiliser les champs pré-calculés par le backend
  const floodRisk   = latest?.flood_risk ?? 0;
  const stormRisk   = latest?.storm_risk ?? 0;
  const overallRisk = latest?.overall_risk ?? 0;
  const rl          = riskLevel(overallRisk);
  const condLabel   = latest?.condition_label ?? 'Données météo';
  const condition   = {
    label:    condLabel,
    icon:     COND_ICON[condLabel] || 'weather',
    severity: latest?.condition_severity ?? 'none',
  };
  const pTrend      = latest?.pressure_trend ?? pressureTrend(primaryHistory);
  const pTrendData  = pressureTrendLabel(pTrend);
  const beaufort    = latest ? { scale: latest.beaufort_scale ?? 0, label: latest.beaufort_label ?? 'Calme' } : null;

  const onlineNodes  = nodes.filter((n) => n.status === 'online').length;

  // Sparkline data: last 12 readings per metric
  const spark = (key) => primaryHistory.slice(-12).map((r) => r[key]).filter((v) => v != null);

  return (
    <div>
      {/* Critical banner */}
      {criticalAlerts.length > 0 && (
        <div className="critical-banner">
          <Icon name="anomaly" size={20} className="critical-banner-icon" />
          <div className="critical-banner-text">
            {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? 's' : ''} critique{criticalAlerts.length > 1 ? 's' : ''} active{criticalAlerts.length > 1 ? 's' : ''} — {criticalAlerts[0]?.message}
          </div>
          <button className="btn btn-danger btn-xs" style={{ marginLeft: 'auto' }} onClick={() => onNav('alerts')}>
            Voir les alertes
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title">Tableau de bord</div>
          <div className="page-subtitle">
            {onlineNodes} / {nodes.length} stations en ligne
            {latest && <> · Condition : <strong>{condition.label}</strong></>}
          </div>
        </div>
        <div className="page-header-right">
          <span className={`risk-badge ${rl.cls}`}>
            Risque global: {rl.label}
          </span>
        </div>
      </div>

      {/* ── Weather Hero ───────────────────────────────────── */}
      <WeatherHero latest={latest} condition={condition} primaryNode={primaryNode} />

      {/* ── Metrics row ───────────────────────────────────── */}
      <div className="section">
        <div className="grid-6">
          <StatCard label="Température"  value={fmt(latest?.temperature)} unit="°C" icon="thermometer"
            accent="#f97316" trend={latest?.temperature > 30 ? 'up' : latest?.temperature < 5 ? 'down' : undefined}
            sparkData={spark('temperature')} />
          <StatCard label="Humidité"     value={fmt(latest?.humidity)}    unit="%" icon="humidity"
            accent={SENSOR_COLORS.humidity} subtitle={latest?.humidity > 80 ? 'Élevée' : latest?.humidity < 30 ? 'Sèche' : 'Normale'}
            sparkData={spark('humidity')} />
          <StatCard label="Pression"     value={fmt(latest?.pressure, 0)} unit="hPa" icon="pressure"
            accent={SENSOR_COLORS.pressure}
            trend={pTrend === 'rising' ? 'up' : pTrend === 'falling' ? 'down' : undefined}
            trendValue={pTrendData.icon}
            sparkData={spark('pressure')} />
          <StatCard label="Vent"         value={fmt(latest?.wind_speed, 0)} unit="km/h" icon="wind"
            accent={SENSOR_COLORS.wind_speed}
            subtitle={beaufort ? beaufort.label : undefined}
            sparkData={spark('wind_speed')} />
          <StatCard label="Pluie"        value={fmt(latest?.rain_level)} unit="mm" icon="rain"
            accent={SENSOR_COLORS.rain_level}
            trend={latest?.rain_level > 10 ? 'up' : undefined}
            sparkData={spark('rain_level')} />
          <StatCard label="Luminosité"   value={latest?.luminosity != null ? Math.round(latest.luminosity) : '—'} unit="lux" icon="luminosity"
            accent={SENSOR_COLORS.luminosity}
            sparkData={spark('luminosity')} />
        </div>
      </div>

      {/* ── Risk assessment ───────────────────────────────── */}
      <div className="section">
        <div className="grid-3">
          {/* Risk panel */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-header" style={{ marginBottom: 0 }}>
              <span className="card-title">Évaluation des risques</span>
              <span className={`risk-badge ${rl.cls}`} style={{ fontSize: 9 }}>{rl.label}</span>
            </div>
            <RiskGauge label="Risque d'inondation" score={floodRisk} icon="flood" />
            <RiskGauge label="Risque tempête"       score={stormRisk} icon="storm" />
            <RiskGauge label="Risque global" score={overallRisk} icon="anomaly" />
          </div>

          {/* Pressure trend */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Tendance pression</span>
              <span style={{ fontSize: 16, color: pTrendData.color }}>{pTrendData.icon}</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>{pTrendData.label}</div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={pressChartData}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="pressure" stroke={SENSOR_COLORS.pressure}
                    strokeWidth={2} dot={false} name="Pression (hPa)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Station statuses */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Stations IoT</span>
              <span className="badge badge-blue" style={{ fontFamily: 'var(--font-mono)' }}>
                {onlineNodes}/{nodes.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {nodes.slice(0, 5).map((n) => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LiveDot active={n.status === 'online'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.location || n.id}</div>
                  </div>
                  <span className={`badge ${n.status === 'online' ? 'badge-online' : 'badge-offline'}`}>
                    {n.status === 'online' ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              ))}
              {nodes.length === 0 && <div className="text-muted text-sm">Aucune station enregistrée.</div>}
            </div>
            {nodes.length > 0 && (
              <button className="btn btn-ghost btn-xs w-full" style={{ marginTop: 12 }} onClick={() => onNav('stations')}>
                Gérer les stations →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Temperature & Humidity chart ──────────────────── */}
      <div className="section">
        <div className="section-title">
          Température & Humidité — 48h
          <div className="section-title-line" />
        </div>
        <div className="card">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={SENSOR_COLORS.temperature} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={SENSOR_COLORS.temperature} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradHum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={SENSOR_COLORS.humidity} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={SENSOR_COLORS.humidity} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="time" stroke="var(--chart-text)" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis stroke="var(--chart-text)" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="temperature" stroke={SENSOR_COLORS.temperature} fill="url(#gradTemp)" strokeWidth={2} name="Temp (°C)" dot={false} />
                <Area type="monotone" dataKey="humidity"    stroke={SENSOR_COLORS.humidity}    fill="url(#gradHum)"  strokeWidth={2} name="Humidité (%)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Rain & Wind + Alerts ──────────────────────────── */}
      <div className="grid-2 section">
        {/* Rain + wind */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Précipitations & Vent — 24 dernières mesures</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rainChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="time" stroke="var(--chart-text)" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="var(--chart-text)" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rain_level" fill={SENSOR_COLORS.rain_level} name="Pluie (mm)" radius={[2,2,0,0]} />
                <Bar dataKey="wind_speed" fill={SENSOR_COLORS.wind_speed} name="Vent (km/h)" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertes récentes</span>
            <span className="badge badge-red">{activeAlerts.length} active{activeAlerts.length !== 1 ? 's' : ''}</span>
          </div>
          {activeAlerts.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <Icon name="check" size={20} color="var(--risk-safe)" />
              <div style={{ marginTop: 8 }}>Aucune alerte active</div>
            </div>
          ) : (
            <div className="scroll-list" style={{ maxHeight: 180 }}>
              {activeAlerts.slice(0, 5).map((a) => (
                <div key={a.id} className={`alert-item ${a.severity}`}>
                  <span className={`alert-dot ${a.severity}`} />
                  <div className="alert-body">
                    <div className="alert-type">{a.type}</div>
                    <div className="alert-msg">{a.message}</div>
                    <div className="alert-meta">
                      <span className="alert-time">{tsDate(a.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeAlerts.length > 0 && (
            <button className="btn btn-ghost btn-xs w-full" style={{ marginTop: 8 }} onClick={() => onNav('alerts')}>
              Voir toutes les alertes →
            </button>
          )}
        </div>
      </div>

      {/* ── Summary stats ────────────────────────────────── */}
      {summary && (
        <div className="section">
          <div className="grid-4">
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="stations" size={20} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{summary?.nodes?.online ?? '—'}/{summary?.nodes?.total ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stations actives</div>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="alerts" size={20} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{summary?.alerts?.active ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Alertes actives</div>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(239,68,68,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="anomaly" size={20} color="var(--risk-high)" />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{summary?.alerts?.critical_active ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Alertes critiques</div>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="thermometer" size={20} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{summary?.latest?.avg_temperature != null ? `${fmt(summary.latest.avg_temperature)}°` : '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Temp. moyenne réseau</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
