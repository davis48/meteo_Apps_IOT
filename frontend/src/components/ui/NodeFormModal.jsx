import { useState } from 'react';
import { fetchApi } from '../../utils/helpers';

const EMPTY = { node_id: '', name: '', location: '', latitude: '', longitude: '', firmware_version: '' };

export default function NodeFormModal({ node, onClose, onSaved }) {
  const isEdit = !!node?.id;
  const [form, setForm] = useState(
    node ? {
      node_id:          node.id || '',
      name:             node.name || '',
      location:         node.location || '',
      latitude:         node.latitude != null ? String(node.latitude) : '',
      longitude:        node.longitude != null ? String(node.longitude) : '',
      firmware_version: node.firmware_version || '',
    } : { ...EMPTY }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) { setError('Le nom est requis.'); return; }
    if (!isEdit && !form.node_id.trim()) { setError('L\'identifiant est requis.'); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await fetchApi(`/nodes/${node.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name, location: form.location,
            latitude:  form.latitude  ? parseFloat(form.latitude)  : undefined,
            longitude: form.longitude ? parseFloat(form.longitude) : undefined,
            firmware_version: form.firmware_version || undefined,
          }),
        });
      } else {
        await fetchApi('/sensors/register', {
          method: 'POST',
          body: JSON.stringify({
            node_id:  form.node_id, name: form.name, location: form.location,
            latitude:  form.latitude  ? parseFloat(form.latitude)  : undefined,
            longitude: form.longitude ? parseFloat(form.longitude) : undefined,
          }),
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Modifier la station' : 'Nouvelle station'}</span>
          <button className="btn-icon" onClick={onClose} style={{ width: 28, height: 28 }}>✕</button>
        </div>
        <div className="modal-body">
          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Identifiant *</label>
              <input className="form-input" placeholder="ex: node-004" value={form.node_id} onChange={set('node_id')} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Nom *</label>
            <input className="form-input" placeholder="ex: Station Delta" value={form.name} onChange={set('name')} />
          </div>
          <div className="form-group">
            <label className="form-label">Localisation</label>
            <input className="form-input" placeholder="ex: Site Nord — Toit Bâtiment A" value={form.location} onChange={set('location')} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input className="form-input" type="number" placeholder="48.8566" value={form.latitude} onChange={set('latitude')} />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input className="form-input" type="number" placeholder="2.3522" value={form.longitude} onChange={set('longitude')} />
            </div>
          </div>
          {isEdit && (
            <div className="form-group">
              <label className="form-label">Version firmware</label>
              <input className="form-input" placeholder="ex: 1.2.0" value={form.firmware_version} onChange={set('firmware_version')} />
            </div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: 'var(--risk-high)', background: 'rgba(239,68,68,.1)', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>Annuler</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Sauvegarde...' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
