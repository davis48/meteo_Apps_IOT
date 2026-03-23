import Icon from '../ui/Icon';

const PAGE_META = {
  dashboard:    { title: 'Tableau de bord',         subtitle: 'Vue d\'ensemble en temps réel' },
  live:         { title: 'Météo en direct',         subtitle: 'Données capteurs live par station' },
  map:          { title: 'Carte des Stations',      subtitle: 'Visualisation géographique et données GPS en temps réel' },
  regions:      { title: 'Météo par Région',        subtitle: "Couverture nationale · Côte d'Ivoire · Cliquez une région pour la filtrer" },
  forecast:     { title: 'Prévisions IA',           subtitle: 'Prédictions LSTM · 3h · 6h · 12h · 24h' },
  comparison:   { title: 'Comparaison',             subtitle: 'Analyse comparative inter-stations' },
  'air-quality':{ title: 'Qualité de l\'air',       subtitle: 'Indice de confort et qualité environnementale' },
  history:      { title: 'Historique',              subtitle: 'Analyse des données historiques' },
  alerts:       { title: 'Alertes & Risques',       subtitle: 'Centre de surveillance et d\'alertes' },
  stations:     { title: 'Stations IoT',            subtitle: 'Gestion des nœuds et capteurs' },
};

const Header = ({ page, onRefresh, isRefreshing, theme, onThemeToggle, lastUpdated, regions = [], regionFilter = null, onRegionChange }) => {
  const meta = PAGE_META[page] || { title: 'AtmosIQ', subtitle: '' };

  const lastStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  // Pages où on n'affiche PAS le filtre régional (gestion globale ou vue régionale elle-même)
  const showRegionFilter = regions.length > 0 && page !== 'map' && page !== 'stations';

  return (
    <header className="header">
      <div>
        <div className="header-title">{meta.title}</div>
        {meta.subtitle && (
          <div className="header-subtitle">{meta.subtitle}</div>
        )}
      </div>

      <div className="header-spacer" />

      <div className="header-actions">
        {/* Sélecteur de région global */}
        {showRegionFilter && (
          <select
            value={regionFilter || ''}
            onChange={(e) => onRegionChange && onRegionChange(e.target.value || null)}
            title="Filtrer par région"
            style={{
              fontSize: 11, padding: '5px 10px', borderRadius: 8,
              background: 'var(--bg-elevated)',
              border: `1px solid ${regionFilter ? '#f97316' : 'var(--border-default)'}`,
              color: regionFilter ? '#f97316' : 'var(--text-muted)',
              cursor: 'pointer', outline: 'none', fontWeight: regionFilter ? 700 : 400,
            }}
          >
            <option value="">🌍 Toutes les régions</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}

        {lastStr && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Màj {lastStr}
          </span>
        )}

        <button
          className={`btn-icon${isRefreshing ? ' spinning' : ''}`}
          onClick={onRefresh}
          title="Actualiser les données"
        >
          <Icon name="refresh" size={16} />
        </button>

        <button
          className="btn-icon"
          onClick={onThemeToggle}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        >
          <Icon name={theme === 'dark' ? 'sun_alt' : 'moon'} size={16} />
        </button>
      </div>
    </header>
  );
};

export default Header;
