import Icon from '../ui/Icon';

const NAV_ITEMS = [
  {
    section: 'Vue d\'ensemble',
    items: [
      { id: 'dashboard',    label: 'Tableau de bord',    icon: 'dashboard' },
      { id: 'live',         label: 'Météo en direct',    icon: 'weather' },
      { id: 'regions',      label: 'Régions de CI',       icon: 'map' },
      { id: 'map',          label: 'Carte des stations',  icon: 'stations' },
    ],
  },
  {
    section: 'Analyse & Prévisions',
    items: [
      { id: 'forecast',     label: 'Prévisions IA',     icon: 'forecast' },
      { id: 'comparison',   label: 'Comparaison',       icon: 'compare' },
      // { id: 'air-quality',  label: 'Qualité de l\'air', icon: 'air-quality' },
      { id: 'history',      label: 'Historique',        icon: 'history' },
    ],
  },
  {
    section: 'Gestion',
    items: [
      { id: 'alerts',       label: 'Alertes & Risques', icon: 'alerts', badge: true },
      { id: 'stations',     label: 'Stations IoT',      icon: 'stations' },
    ],
  },
];

const Sidebar = ({ page, onNav, wsStatus, alertCount = 0 }) => {
  const wsDot =
    wsStatus === 'connected'  ? 'connected'  :
    wsStatus === 'connecting' ? 'connecting' : '';

  const wsLabel =
    wsStatus === 'connected'  ? 'Temps réel connecté' :
    wsStatus === 'connecting' ? 'Connexion...'        : 'Hors ligne';

  return (
    <aside className="sidebar">
      {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <img src="/logo.png" alt="YATANAN Logo" width={60} className="sidebar-logo" />
          </div>
          <div>
            <div className="sidebar-brand-name">YATANAN</div>
            <div className="sidebar-brand-sub">MétéoAI</div>
          </div>
        </div>

        {/* WebSocket status */}
      <div className="ws-pill">
        <span className={`ws-dot ${wsDot}`} />
        <span>{wsLabel}</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            <div className="nav-section-label">{section}</div>
            {items.map(({ id, label, icon, badge }) => (
              <button
                key={id}
                className={`nav-item${page === id ? ' active' : ''}`}
                onClick={() => onNav(id)}
              >
                <Icon name={icon} size={17} className="nav-item-icon" />
                {label}
                {badge && alertCount > 0 && (
                  <span className="nav-badge">{alertCount > 99 ? '99+' : alertCount}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div>Projet Fablab — IoT Météo</div>
        <div className="sidebar-tags">
          <span className="sidebar-tag">ESP32</span>
          <span className="sidebar-tag">TinyML</span>
          <span className="sidebar-tag">LSTM</span>
          <span className="sidebar-tag">MQTT</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
