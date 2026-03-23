import { useState, useEffect } from 'react';
import {
  AlertOctagon, AlertTriangle, Info, CheckCircle2, CheckCheck,
  X, Thermometer, CloudRain, Wind, Gauge, Cpu, Waves, CloudLightning,
  MapPin, Clock, Radio, ShieldAlert, Lightbulb, Trash2,
  ChevronLeft, ChevronRight, CheckSquare, Eye,
} from 'lucide-react';
import {
  tsDate, timeAgo,
  riskLevel, getRecommendations, fmt,
} from '../utils/helpers';

// ── Constants ──────────────────────────────────────────────────────────────────
const STEP_SIZE = 10;

const FILTERS = [
  { id: 'all',      label: 'Toutes'         },
  { id: 'active',   label: 'Actives'        },
  { id: 'critical', label: 'Critiques'      },
  { id: 'warning',  label: 'Avertissements' },
  { id: 'info',     label: 'Info'           },
];

const TYPE_LABELS = {
  TEMP_HIGH:    'Température élevée',
  TEMP_LOW:     'Température basse',
  RAIN:         'Précipitations',
  WIND:         'Vent fort',
  PRESSURE_LOW: 'Pression basse',
  ANOMALY:      'Anomalie IA',
  FLOOD:        'Risque inondation',
  STORM:        'Risque tempête',
};

const SEV = {
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,.12)',  label: 'Critique',       Ic: AlertOctagon  },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: 'Avertissement',  Ic: AlertTriangle },
  info:     { color: '#3b82f6', bg: 'rgba(59,130,246,.12)', label: 'Info',           Ic: Info          },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function TypeIcon({ type, color, size = 15 }) {
  const p = { size, color, strokeWidth: 2 };
  switch (type) {
    case 'TEMP_HIGH':
    case 'TEMP_LOW':     return <Thermometer {...p} />;
    case 'RAIN':         return <CloudRain {...p} />;
    case 'WIND':         return <Wind {...p} />;
    case 'PRESSURE_LOW': return <Gauge {...p} />;
    case 'ANOMALY':      return <Cpu {...p} />;
    case 'FLOOD':        return <Waves {...p} />;
    case 'STORM':        return <CloudLightning {...p} />;
    default:             return <AlertTriangle {...p} />;
  }
}

// ── Step paginator ─────────────────────────────────────────────────────────────
function StepNav({ step, total, onChange }) {
  if (total <= 1) return null;

  // Build list of visible page numbers with possible ellipsis entries
  const slots = [];
  if (total <= 7) {
    for (let i = 0; i < total; i++) slots.push(i);
  } else {
    const shown = new Set(
      [0, total - 1, step - 1, step, step + 1].filter((i) => i >= 0 && i < total)
    );
    let prev = -1;
    [...shown].sort((a, b) => a - b).forEach((i) => {
      if (prev !== -1 && i > prev + 1) slots.push('…');
      slots.push(i);
      prev = i;
    });
  }

  const btnBase = {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all .15s', fontSize: 12, fontWeight: 600,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 18 }}>
      {/* Prev */}
      <button
        onClick={() => onChange(step - 1)}
        disabled={step === 0}
        style={{
          ...btnBase,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', color: 'var(--text-muted)',
          opacity: step === 0 ? 0.35 : 1,
          cursor: step === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        <ChevronLeft size={14} strokeWidth={2} />
      </button>

      {/* Page dots */}
      {slots.map((s, i) =>
        s === '…' ? (
          <span key={`e${i}`} style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>…</span>
        ) : (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              ...btnBase,
              background: s === step ? 'var(--accent)' : 'var(--bg-surface)',
              color: s === step ? '#fff' : 'var(--text-secondary)',
              boxShadow: s === step ? '0 2px 10px rgba(59,130,246,.35)' : 'none',
              border: s === step ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            {s + 1}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onChange(step + 1)}
        disabled={step >= total - 1}
        style={{
          ...btnBase,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', color: 'var(--text-muted)',
          opacity: step >= total - 1 ? 0.35 : 1,
          cursor: step >= total - 1 ? 'not-allowed' : 'pointer',
        }}
      >
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AlertsPage({
  alerts = [], nodes = [], onAcknowledge, onDelete, latestByNode = {}, onNav,
}) {
  const [filter,        setFilter]        = useState('all');
  const [search,        setSearch]        = useState('');
  const [step,          setStep]          = useState(0);
  const [expandId,      setExpandId]      = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // id awaiting 2nd-click confirm

  // Build derived sets
  const primaryNodeId = Object.keys(latestByNode)[0];
  const primaryLatest = primaryNodeId ? latestByNode[primaryNodeId] : null;
  const floodRisk     = primaryLatest?.flood_risk ?? 0;
  const stormRisk     = primaryLatest?.storm_risk ?? 0;
  const recs          = getRecommendations(primaryLatest);

  const criticals   = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged);
  const warnings    = alerts.filter((a) => a.severity === 'warning'  && !a.acknowledged);
  const infos       = alerts.filter((a) => a.severity === 'info'     && !a.acknowledged);
  const totalActive = alerts.filter((a) => !a.acknowledged).length;

  const filtered = alerts.filter((a) => {
    if (filter === 'active'   && a.acknowledged)            return false;
    if (filter === 'critical' && a.severity !== 'critical') return false;
    if (filter === 'warning'  && a.severity !== 'warning')  return false;
    if (filter === 'info'     && a.severity !== 'info')     return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(a.node_id  || '').toLowerCase().includes(q) &&
        !(a.message  || '').toLowerCase().includes(q) &&
        !(a.type     || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalSteps = Math.max(1, Math.ceil(filtered.length / STEP_SIZE));
  const pageAlerts = filtered.slice(step * STEP_SIZE, (step + 1) * STEP_SIZE);

  // Reset pagination when filter/search changes
  useEffect(() => { setStep(0); setExpandId(null); }, [filter, search]);

  const nodeMap = {};
  nodes.forEach((n) => { nodeMap[n.id] = n; });

  const handleAckAll = () => {
    alerts.filter((a) => !a.acknowledged).forEach((a) => onAcknowledge?.(a.id));
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirmDelete === id) {
      onDelete?.(id);
      setConfirmDelete(null);
      if (expandId === id) setExpandId(null);
    } else {
      setConfirmDelete(id);
      // Auto-cancel after 3 s
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 3000);
    }
  };

  return (
    <div>
      {/* ── Critical banner ── */}
      {criticals.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          borderRadius: 10, background: 'rgba(220,38,38,.1)', border: '1px solid rgba(220,38,38,.3)',
          marginBottom: 20,
        }}>
          <ShieldAlert size={18} color="#dc2626" strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
            {criticals.length} alerte critique{criticals.length > 1 ? 's' : ''} — Intervention recommandée
          </span>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Alertes &amp; Risques</div>
          <div className="page-subtitle">
            Centre de surveillance · {totalActive} active{totalActive !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="page-header-right">
          {totalActive > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleAckAll}>
              <CheckCheck size={14} strokeWidth={2} /> Tout acquitter
            </button>
          )}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid-4 section">
        {[
          { label: 'Critiques',      value: criticals.length,            color: '#dc2626', Ic: AlertOctagon  },
          { label: 'Avertissements', value: warnings.length,             color: '#f59e0b', Ic: AlertTriangle },
          { label: 'Informations',   value: infos.length,                color: '#3b82f6', Ic: Info          },
          { label: 'Acquittées',     value: alerts.length - totalActive, color: '#22c55e', Ic: CheckCircle2  },
        ].map(({ label, value, color, Ic }) => (
          <div key={label} className="card" style={{ borderTop: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {label}
              </div>
              <Ic size={15} color={color} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Risk + Recommendations ── */}
      <div className="grid-2 section">
        <div className="card">
          <div className="card-header"><span className="card-title">Risques environnementaux</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Inondation', score: floodRisk, Ic: Waves          },
              { label: 'Tempête',    score: stormRisk, Ic: CloudLightning  },
            ].map(({ label, score, Ic }) => {
              const rl = riskLevel(score);
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Ic size={14} color={rl.color} strokeWidth={2} /> Risque {label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`risk-badge ${rl.cls}`} style={{ fontSize: 9 }}>{rl.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: rl.color }}>{Math.round(score)}%</span>
                    </div>
                  </div>
                  <div className="risk-bar">
                    <div className="risk-bar-fill" style={{ width: `${score}%`, background: rl.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lightbulb size={14} color="var(--accent)" strokeWidth={2} /> Recommandations
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recs.map((r, i) => {
              const Ic  = r.type === 'critical' ? AlertOctagon : r.type === 'warning' ? AlertTriangle : Info;
              const col = r.type === 'critical' ? '#dc2626' : r.type === 'warning' ? '#f59e0b' : '#3b82f6';
              return (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8,
                  background: r.type === 'critical' ? 'rgba(220,38,38,.08)' : r.type === 'warning' ? 'rgba(245,158,11,.08)' : 'var(--bg-elevated)',
                  borderLeft: `3px solid ${col}`,
                }}>
                  <Ic size={14} color={col} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Alert list ── */}
      <div className="section">

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div className="tabs">
            {FILTERS.map(({ id, label }) => (
              <button key={id} className={`tab${filter === id ? ' active' : ''}`} onClick={() => setFilter(id)}>
                {label}
                {id === 'critical' && criticals.length > 0 && (
                  <span style={{ marginLeft: 4, background: '#dc2626', color: '#fff', borderRadius: 4, fontSize: 10, padding: '0 4px' }}>
                    {criticals.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              className="input"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            {filtered.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                {step * STEP_SIZE + 1}–{Math.min((step + 1) * STEP_SIZE, filtered.length)}/{filtered.length}
              </span>
            )}
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <CheckCircle2 size={36} color="var(--risk-safe)" style={{ margin: '0 auto 12px' }} strokeWidth={1.5} />
              <div className="empty-state-title">Aucune alerte</div>
              <div className="empty-state-text">Aucune alerte correspondant à ces filtres.</div>
            </div>
          </div>
        ) : (
          <>
            {/* Alert cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pageAlerts.map((a, idx) => {
                const node     = nodeMap[a.node_id];
                const sev      = SEV[a.severity] || SEV.info;
                const color    = a.acknowledged ? '#22c55e' : sev.color;
                const SevIc    = sev.Ic;
                const isExpanded      = expandId === a.id;
                const isPendingDelete = confirmDelete === a.id;
                const latest   = node ? latestByNode[node.id] : null;

                return (
                  <div
                    key={a.id}
                    className="fade-in-up"
                    style={{
                      '--delay': `${idx * 0.03}s`,
                      background: 'var(--bg-surface)',
                      border: `1px solid ${isExpanded ? color + '44' : 'var(--border-subtle)'}`,
                      borderLeft: `4px solid ${color}`,
                      borderRadius: 12,
                      opacity: a.acknowledged ? 0.75 : 1,
                      overflow: 'hidden',
                      transition: 'border-color .2s, box-shadow .2s',
                    }}
                  >
                    {/* ── Compact row ── */}
                    <div
                      onClick={() => setExpandId(isExpanded ? null : a.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
                    >
                      {/* Severity icon */}
                      <div style={{ flexShrink: 0, opacity: a.acknowledged ? 0.5 : 1 }}>
                        <SevIc size={16} color={color} strokeWidth={2} />
                      </div>

                      {/* Type icon bubble */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `${color}15`, border: `1px solid ${color}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <TypeIcon type={a.type} color={color} size={15} />
                      </div>

                      {/* Text content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {TYPE_LABELS[a.type] || a.type}
                          </span>
                          {a.acknowledged ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
                              background: 'rgba(34,197,94,.15)', color: '#22c55e',
                            }}>
                              <CheckCircle2 size={9} strokeWidth={2.5} /> Acquittée
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
                              background: sev.bg, color: sev.color,
                            }}>
                              {sev.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.message}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Radio size={10} strokeWidth={2} /> {node ? node.name : a.node_id}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} strokeWidth={2} /> {timeAgo(a.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Actions — stop propagation so clicks don't toggle expand */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {/* Quick acknowledge */}
                        {!a.acknowledged && onAcknowledge && (
                          <button
                            title="Acquitter"
                            onClick={() => onAcknowledge(a.id)}
                            style={{
                              width: 28, height: 28, borderRadius: 6,
                              border: '1px solid rgba(34,197,94,.3)',
                              background: 'rgba(34,197,94,.1)', color: '#22c55e',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all .15s',
                            }}
                          >
                            <CheckSquare size={13} strokeWidth={2} />
                          </button>
                        )}

                        {/* Delete (2-click confirm) */}
                        {onDelete && (
                          <button
                            title={isPendingDelete ? 'Cliquer à nouveau pour confirmer' : 'Supprimer'}
                            onClick={(e) => handleDelete(e, a.id)}
                            style={{
                              width: isPendingDelete ? 'auto' : 28,
                              padding: isPendingDelete ? '0 10px' : 0,
                              height: 28, borderRadius: 6,
                              border: `1px solid ${isPendingDelete ? 'rgba(220,38,38,.5)' : 'rgba(220,38,38,.2)'}`,
                              background: isPendingDelete ? 'rgba(220,38,38,.18)' : 'rgba(220,38,38,.08)',
                              color: '#dc2626', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                              fontSize: 11, fontWeight: 600,
                              transition: 'all .2s',
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                            {isPendingDelete && <span>Confirmer?</span>}
                          </button>
                        )}
                      </div>

                      {/* Expand chevron */}
                      <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        <ChevronRight
                          size={14} strokeWidth={2}
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}
                        />
                      </div>
                    </div>

                    {/* ── Expanded detail ── */}
                    {isExpanded && (
                      <div style={{
                        borderTop: '1px solid var(--border-subtle)',
                        padding: '14px 16px',
                        background: 'var(--bg-elevated)',
                      }}>
                        {/* Meta grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <Radio size={12} color="var(--text-muted)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>Station</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{node ? node.name : a.node_id}</div>
                              {node?.location && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <MapPin size={9} strokeWidth={2} /> {node.location}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <Clock size={12} color="var(--text-muted)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>Déclenchée</div>
                              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 1 }}>{tsDate(a.timestamp)}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(a.timestamp)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Message bubble */}
                        {a.message && (
                          <div style={{
                            fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5,
                            marginBottom: 12, padding: '8px 12px',
                            background: 'var(--bg-surface)', borderRadius: 8,
                            borderLeft: `3px solid ${color}`,
                          }}>
                            {a.message}
                          </div>
                        )}

                        {/* Live sensor values */}
                        {latest && (
                          <div style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                            borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                          }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
                              Valeurs actuelles
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                              {[
                                { label: 'Temp.',    value: `${fmt(latest.temperature)}°C`,                                           color: '#f97316' },
                                { label: 'Humidité', value: `${fmt(latest.humidity, 0)}%`,                                            color: '#3b82f6' },
                                { label: 'Pression', value: `${latest.pressure != null ? Math.round(latest.pressure) : '—'} hPa`,    color: '#8b5cf6' },
                                { label: 'Vent',     value: `${fmt(latest.wind_speed, 0)} km/h`,                                     color: '#06b6d4' },
                                { label: 'Pluie',    value: `${fmt(latest.rain_level)} mm`,                                          color: '#6366f1' },
                              ].map(({ label, value, color: c }) => (
                                <div key={label} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Footer actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {!a.acknowledged && onAcknowledge && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { onAcknowledge(a.id); setExpandId(null); }}
                            >
                              <CheckCircle2 size={13} strokeWidth={2.5} /> Acquitter
                            </button>
                          )}
                          {onNav && node && (
                            <button className="btn btn-secondary btn-sm" onClick={() => onNav('stations')}>
                              <Eye size={13} strokeWidth={2} /> Voir la station
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ marginLeft: 'auto' }}
                            onClick={() => setExpandId(null)}
                          >
                            <X size={13} strokeWidth={2} /> Fermer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Step navigator ── */}
            <StepNav step={step} total={totalSteps} onChange={setStep} />

            {totalSteps > 1 && (
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                Page {step + 1} sur {totalSteps} · {filtered.length} alertes au total
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
