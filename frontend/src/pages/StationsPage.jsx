import { useState } from 'react';
import LiveDot from '../components/ui/LiveDot';
import NodeFormModal from '../components/ui/NodeFormModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Icon from '../components/ui/Icon';
import { SquarePen } from 'lucide-react';
import { fmt, tsDate, timeAgo, computeOverallRisk, riskLevel, fetchApi } from '../utils/helpers';

function NodeCard({ node, latest, onEdit, onDelete }) {
  // Utiliser le champ pré-calculé par le backend si disponible
  const overallRisk = latest?.overall_risk ?? computeOverallRisk(latest);
  const rl = riskLevel(overallRisk);

  return (
    <div className="node-card">
      <div className="node-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <LiveDot active={node.status === 'online'} />
            <div className="node-card-name truncate">{node.name}</div>
            <span className={`badge ${node.status === 'online' ? 'badge-online' : 'badge-offline'}`}>
              {node.status === 'online' ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
          {node.location && (
            <div className="node-card-location">
              <Icon name="node" size={11} color="var(--text-muted)" /> {node.location}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{node.id}</div>
        </div>
        <div className="node-card-actions">
          <button className="btn-icon btn-xl" title="Modifier" onClick={() => onEdit(node)}>
            <SquarePen name='edite' size={14} />
          </button>
          <button className="btn-icon btn-xl" title="Supprimer" onClick={() => onDelete(node)} style={{ color: 'var(--risk-high)' }}>
            <Icon name="delete" size={14} />
          </button>
        </div>
      </div>

      {/* Sensor metrics */}
      {latest ? (
        <div className="node-metrics">
          <div className="node-metric">
            <div className="node-metric-val" style={{ color: '#f97316' }}>{fmt(latest.temperature)}°</div>
            <div className="node-metric-lbl">Temp</div>
          </div>
          <div className="node-metric">
            <div className="node-metric-val" style={{ color: '#3b82f6' }}>{fmt(latest.humidity)}%</div>
            <div className="node-metric-lbl">Hum</div>
          </div>
          <div className="node-metric">
            <div className="node-metric-val">{latest.pressure != null ? Math.round(latest.pressure) : '—'}</div>
            <div className="node-metric-lbl">hPa</div>
          </div>
          <div className="node-metric">
            <div className="node-metric-val">{fmt(latest.wind_speed, 0)}</div>
            <div className="node-metric-lbl">km/h</div>
          </div>
          <div className="node-metric">
            <div className="node-metric-val">{fmt(latest.rain_level)}</div>
            <div className="node-metric-lbl">mm</div>
          </div>
          <div className="node-metric">
            <div className="node-metric-val" style={{ color: rl.color }}>{Math.round(overallRisk)}%</div>
            <div className="node-metric-lbl">Risque</div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
          Aucune donnée capteur
        </div>
      )}

      {/* Footer info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {node.firmware_version && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              FW: <span style={{ fontFamily: 'var(--font-mono)' }}>{node.firmware_version}</span>
            </span>
          )}
          {node.latitude != null && node.longitude != null && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {Number(node.latitude).toFixed(4)}°, {Number(node.longitude).toFixed(4)}°
            </span>
          )}
        </div>
        {latest && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Dernière mesure: {timeAgo(latest.timestamp)}
          </span>
        )}
        {overallRisk > 0 && (
          <span className={`risk-badge ${rl.cls}`} style={{ fontSize: 9 }}>
            Risque {rl.label.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function StationsPage({ nodes = [], latestByNode = {}, onNodeChange }) {
  const [showForm, setShowForm]         = useState(false);
  const [editNode, setEditNode]         = useState(null);
  const [deleteNode, setDeleteNode]     = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const handleEdit = (node) => { setEditNode(node); setShowForm(true); };
  const handleAdd  = () => { setEditNode(null); setShowForm(true); };
  const handleSaved = () => { setShowForm(false); setEditNode(null); onNodeChange?.(); };

  const handleDeleteConfirm = async () => {
    if (!deleteNode) return;
    setDeleteLoading(true);
    try {
      await fetchApi(`/nodes/${deleteNode.id}`, { method: 'DELETE' });
      setDeleteNode(null);
      onNodeChange?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const onlineNodes  = nodes.filter((n) => n.status === 'online').length;
  const offlineNodes = nodes.length - onlineNodes;

  const displayedNodes = nodes.filter((n) => {
    if (statusFilter === 'online'  && n.status !== 'online')  return false;
    if (statusFilter === 'offline' && n.status !== 'offline') return false;
    if (searchQuery && !n.name.toLowerCase().includes(searchQuery.toLowerCase())
      && !n.id.toLowerCase().includes(searchQuery.toLowerCase())
      && !(n.location || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Stations IoT</div>
          <div className="page-subtitle">
            {onlineNodes} en ligne · {offlineNodes} hors ligne · {nodes.length} total
          </div>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>
            <Icon name="add" size={14} /> Nouvelle station
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-3 section">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(34,197,94,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="online" size={22} color="var(--color-online)" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-online)' }}>{onlineNodes}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stations en ligne</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="offline" size={22} color="var(--text-muted)" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-secondary)' }}>{offlineNodes}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stations hors ligne</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="stations" size={22} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{nodes.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stations enregistrées</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="input" placeholder="Rechercher une station..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 240 }} />
        <div className="tabs">
          {[
            { id: 'all',     label: 'Toutes' },
            { id: 'online',  label: 'En ligne' },
            { id: 'offline', label: 'Hors ligne' },
          ].map(({ id, label }) => (
            <button key={id} className={`tab${statusFilter === id ? ' active' : ''}`} onClick={() => setStatusFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Station cards */}
      {displayedNodes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icon name="stations" size={36} className="empty-state-icon" />
            <div className="empty-state-title">Aucune station</div>
            <div className="empty-state-text">
              {nodes.length === 0
                ? 'Créez votre première station IoT pour commencer la surveillance.'
                : 'Aucune station ne correspond à vos critères de recherche.'}
            </div>
            {nodes.length === 0 && (
              <button className="btn btn-primary btn-sm" onClick={handleAdd} style={{ marginTop: 8 }}>
                <Icon name="add" size={14} /> Créer une station
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {displayedNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              latest={latestByNode[node.id]}
              onEdit={handleEdit}
              onDelete={setDeleteNode}
            />
          ))}
        </div>
      )}

      {/* Connection guide */}
      <div className="card mt-6">
        <div className="card-header">
          <span className="card-title">Connecter un capteur physique (ESP32 / Raspberry Pi)</span>
          <span className="badge badge-blue">API REST · MQTT</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              1. Enregistrer le capteur
            </div>
            <pre style={{
              background: 'var(--bg-page)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '10px 14px', fontSize: 11.5,
              fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              overflow: 'auto', lineHeight: 1.7,
            }}>
{`POST /api/sensors/register
{
  "node_id": "node-005",
  "name":    "Ma station",
  "location":"Site A"
}`}
            </pre>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              2. Envoyer des mesures
            </div>
            <pre style={{
              background: 'var(--bg-page)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '10px 14px', fontSize: 11.5,
              fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              overflow: 'auto', lineHeight: 1.7,
            }}>
{`POST /api/sensors/data
{
  "node_id":     "node-005",
  "temperature": 22.5,
  "humidity":    58.0,
  "pressure":    1013.2
}`}
            </pre>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              3. MQTT (optionnel)
            </div>
            <pre style={{
              background: 'var(--bg-page)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '10px 14px', fontSize: 11.5,
              fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              overflow: 'auto', lineHeight: 1.7,
            }}>
{`Topic: meteo/node-005/data
Payload: {
  "temperature": 22.5,
  "humidity": 58.0
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <NodeFormModal node={editNode} onClose={() => setShowForm(false)} onSaved={handleSaved} />
      )}
      {deleteNode && (
        <ConfirmDialog
          title="Supprimer la station"
          message={`Supprimer "${deleteNode.name}" ? Toutes les données capteurs associées seront définitivement supprimées.`}
          confirmLabel="Supprimer"
          danger
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteNode(null)}
        />
      )}
    </div>
  );
}
