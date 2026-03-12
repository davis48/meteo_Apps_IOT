import Icon from '../ui/Icon';

const PAGE_META = {
  dashboard:    { title: 'Tableau de bord',         subtitle: 'Vue d\'ensemble en temps réel' },
  live:         { title: 'Météo en direct',         subtitle: 'Données capteurs live par station' },
  map:          { title: 'Carte des Stations',      subtitle: 'Visualisation géographique et données GPS en temps réel' },
  forecast:     { title: 'Prévisions IA',           subtitle: 'Prédictions LSTM · 3h · 6h · 12h · 24h' },
  comparison:   { title: 'Comparaison',             subtitle: 'Analyse comparative inter-stations' },
  'air-quality':{ title: 'Qualité de l\'air',       subtitle: 'Indice de confort et qualité environnementale' },
  history:      { title: 'Historique',              subtitle: 'Analyse des données historiques' },
  alerts:       { title: 'Alertes & Risques',       subtitle: 'Centre de surveillance et d\'alertes' },
  stations:     { title: 'Stations IoT',            subtitle: 'Gestion des nœuds et capteurs' },
};

const Header = ({ page, onRefresh, isRefreshing, theme, onThemeToggle, lastUpdated }) => {
  const meta = PAGE_META[page] || { title: 'AtmosIQ', subtitle: '' };

  const lastStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

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
