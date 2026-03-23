import { useState, useRef, useEffect } from 'react';
import Badge         from '../components/ui/Badge';
import LiveDot       from '../components/ui/LiveDot';
import NodeFormModal from '../components/ui/NodeFormModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { fmt, tsDate } from '../utils/helpers';

export default function NodesPage({ nodes, latestByNode, onAdd, onUpdate, onDelete }) {
  const [showCreate,     setShowCreate]     = useState(false);
  const [editNode,       setEditNode]       = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [flashNodeId,    setFlashNodeId]    = useState(null);
  const [collapsedNodes,    setCollapsedNodes]    = useState({});
  const [filterNodeId,      setFilterNodeId]      = useState(null);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!showStationPicker) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setShowStationPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStationPicker]);

  const onlineCount   = nodes.filter((n) => n.status === 'online').length;
  const visibleNodes  = filterNodeId
    ? nodes.filter((n) => n.id === filterNodeId)
    : nodes;

  const toggleCollapse = (id) =>
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleCreated = (newNode) => {
    if (onAdd) onAdd(newNode);
    setFlashNodeId(newNode?.id);
    setTimeout(() => setFlashNodeId(null), 3000);
  };

  const handleUpdated = (updated) => {
    if (onUpdate) onUpdate(updated);
    setFlashNodeId(updated?.id);
    setTimeout(() => setFlashNodeId(null), 3000);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    if (onDelete) await onDelete(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Stations IoT</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            onClick={() => setShowStationPicker((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 10 }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: onlineCount > 0 ? 'var(--green)' : 'var(--text-dim)',
              boxShadow: onlineCount > 0 ? '0 0 0 2px var(--green-dim)' : 'none',
            }} />
            {filterNodeId
              ? <span className="truncate" style={{ maxWidth: 120 }}>{nodes.find((n) => n.id === filterNodeId)?.name}</span>
              : <span>{nodes.length} station{nodes.length !== 1 ? 's' : ''}</span>
            }
            <span style={{
              fontSize: 9, color: 'var(--text-dim)', display: 'inline-block',
              transition: 'transform 0.15s ease',
              transform: showStationPicker ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>▼</span>
          </button>

          {showStationPicker && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
              minWidth: 240, zIndex: 500, overflow: 'hidden',
            }}>
              {/* Résumé */}
              <div style={{
                padding: '8px 14px', borderBottom: '1px solid var(--border)',
                fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                display: 'flex', gap: 10,
              }}>
                <span style={{ color: 'var(--green)' }}>{onlineCount} en ligne</span>
                <span>·</span>
                <span>{nodes.length} total</span>
              </div>

              {/* Option "Toutes" */}
              <button
                onClick={() => { setFilterNodeId(null); setShowStationPicker(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 14px',
                  background: !filterNodeId ? 'var(--accent-dim)' : 'transparent',
                  color: !filterNodeId ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: !filterNodeId ? 600 : 400,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.5 }}>⊞</span>
                Toutes les stations
              </button>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Liste des stations */}
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {nodes.map((n) => {
                  const online = n.status === 'online';
                  const active = filterNodeId === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={() => { setFilterNodeId(n.id); setShowStationPicker(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 14px',
                        background: active ? 'var(--accent-dim)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 9,
                        transition: 'background 0.1s',
                      }}
                    >
                      <LiveDot active={online} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: active ? 600 : 400,
                          color: active ? 'var(--accent)' : 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {n.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}>
                          {n.id}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, flexShrink: 0,
                        color: online ? 'var(--green)' : 'var(--text-dim)',
                      }}>
                        {online ? 'En ligne' : 'Hors ligne'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button className="btn-add" onClick={() => setShowCreate(true)}>
          + Ajouter une station
        </button>
        </div>
      </div>

      {/* Modal — création */}
      {showCreate && (
        <NodeFormModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Modal — édition */}
      {editNode && (
        <NodeFormModal
          node={editNode}
          onClose={() => setEditNode(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Dialog — confirmation suppression */}
      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer la station"
          message={`Voulez-vous vraiment supprimer « ${deleteTarget.name} » (${deleteTarget.id}) ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {nodes.length === 0 && (
        <div style={{
          textAlign: 'center', color: 'var(--text-muted)',
          padding: '80px 0', fontSize: 14,
          border: '1px dashed var(--border)', borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◎</div>
          Aucune station — cliquez sur <strong>+ Ajouter une station</strong> pour commencer
        </div>
      )}

      <div className="grid grid-3">
        {visibleNodes.map((node) => {
          const isOnline    = node.status === 'online';
          const lastSeen    = new Date((node.last_seen || 0) * 1000);
          const ago         = Math.floor((Date.now() - lastSeen) / 60000);
          const d           = latestByNode[node.id];
          const isAnomaly   = d?.is_anomaly === 1 || d?.is_anomaly === true;
          const isNew       = flashNodeId === node.id;
          const isCollapsed = collapsedNodes[node.id] === true;

          return (
            <div
              key={node.id}
              className={`card ${isOnline ? 'node-card-online' : 'node-card-offline'}`}
              style={{
                padding: 18,
                outline: isNew ? '2px solid var(--accent)' : 'none',
                outlineOffset: 2,
                transition: 'outline 0.4s ease',
              }}
            >
              {/* En-tête de carte — cliquable pour plier/déplier */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCollapse(node.id)}
                onKeyDown={(e) => e.key === 'Enter' && toggleCollapse(node.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  marginBottom: isCollapsed ? 0 : 12,
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <LiveDot active={isOnline} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 1 }} className="truncate">
                      {node.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}>
                      {node.id}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <Badge
                      color={isOnline ? 'var(--green)' : 'var(--red)'}
                      bg={isOnline ? 'var(--green-dim)' : 'var(--red-dim)'}
                    >
                      {isOnline ? 'En ligne' : 'Hors ligne'}
                    </Badge>
                    {isNew     && <Badge color="var(--accent)" bg="var(--accent-dim)">Modifié</Badge>}
                    {isAnomaly && <Badge color="var(--red)"   bg="var(--red-dim)">Anomalie</Badge>}
                  </div>
                  {/* Chevron */}
                  <span style={{
                    fontSize: 11, color: 'var(--text-dim)',
                    display: 'inline-block', marginLeft: 2, marginTop: 2,
                    transition: 'transform 0.2s ease',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  }}>▼</span>
                </div>
              </div>

              {/* Corps — masqué quand replié */}
              {!isCollapsed && (
                <>
                  {/* Méta */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10,
                    padding: '10px', background: 'var(--surface)',
                    borderRadius: 8, border: '1px solid var(--border-subtle)',
                  }}>
                    {[
                      ['Emplacement', node.location || '—'],
                      ['Firmware',    node.firmware_version || '—'],
                      ['Coordonnées', `${(node.latitude||0).toFixed(3)}, ${(node.longitude||0).toFixed(3)}`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11.5, display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--text-dim)', minWidth: 72, flexShrink: 0 }}>{k}</span>
                        <span style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Dernier contact */}
                  <div style={{ fontSize: 11, color: isOnline ? 'var(--green)' : 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{isOnline ? '↑' : '↓'}</span>
                    <span>
                      {isOnline
                        ? `Actif · vu il y a ${Math.max(ago, 0)} min`
                        : `Hors ligne depuis ${Math.floor(Math.abs(ago) / 60)}h ${Math.abs(ago) % 60}m`}
                    </span>
                  </div>

                  {/* Dernière mesure */}
                  {d ? (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', marginBottom: 10 }} />
                      <div className="section-label" style={{ marginBottom: 8 }}>
                        Dernière mesure
                        {d.timestamp && (
                          <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-dim)', fontSize: 10 }}>
                            {tsDate(d.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-2" style={{ gap: 5 }}>
                        {[
                          { label: 'Temp',     value: `${fmt(d.temperature)}°C`,   color: '#f97316' },
                          { label: 'Humidité', value: `${fmt(d.humidity)}%`,       color: '#06b6d4' },
                          { label: 'Pression', value: `${fmt(d.pressure)} hPa`,   color: '#a855f7' },
                          { label: 'Vent',     value: `${fmt(d.wind_speed)} m/s`, color: '#22c55e' },
                          { label: 'Pluie',    value: `${fmt(d.rain_level)} mm/h`,color: '#3b82f6' },
                          { label: 'Lux',      value: `${fmt(d.luminosity)} lux`, color: '#f59e0b' },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{
                            background: 'var(--surface)', borderRadius: 6,
                            padding: '6px 10px', border: `1px solid ${color}20`,
                          }}>
                            <div style={{ fontSize: 9.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {d.anomaly_score != null && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Score IA</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: isAnomaly ? '#ef4444' : '#22c55e', fontVariantNumeric: 'tabular-nums' }}>
                              {(d.anomaly_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${d.anomaly_score * 100}%`,
                              background: isAnomaly ? '#ef4444' : '#22c55e', borderRadius: 99,
                            }} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', marginBottom: 10 }} />
                      <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, padding: '12px 0' }}>
                        Aucune donnée reçue
                      </div>
                    </>
                  )}

                  {/* ── Actions CRUD ── */}
                  <div className="card-actions">
                    <button
                      className="card-action-btn"
                      onClick={() => setEditNode(node)}
                      title="Modifier"
                    >
                      ✎ Modifier
                    </button>
                    <button
                      className="card-action-btn card-action-btn-danger"
                      onClick={() => setDeleteTarget(node)}
                      title="Supprimer"
                    >
                      ✕ Supprimer
                    </button>
                  </div>
                </>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
