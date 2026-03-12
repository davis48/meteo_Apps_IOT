import { useState } from 'react';

/**
 * CollapsibleCard — carte repliable réutilisable
 *
 * Props:
 *   title       string | ReactNode   — label section (section-label style)
 *   defaultOpen boolean              — ouvert par défaut (true)
 *   action      ReactNode            — badges / boutons à droite du titre
 *   pad         number               — padding interne (défaut 20)
 *   style       object               — styles supplémentaires sur la carte
 *   className   string               — classes supplémentaires
 *   children    ReactNode            — contenu repliable
 */
export default function CollapsibleCard({
  title,
  defaultOpen = true,
  action,
  pad = 20,
  style,
  className = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`card cc-card ${className}`}
      style={style}
    >
      {/* ── En-tête cliquable ── */}
      <button
        className={`cc-header${open ? ' cc-header-open' : ''}`}
        style={{ padding: `${pad}px ${pad}px ${open ? pad * 0.7 : pad}px` }}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <div className="section-label cc-title">{title}</div>

        <div className="cc-header-right">
          {action && <div className="cc-action">{action}</div>}
          <span className={`cc-chevron${open ? '' : ' cc-chevron-closed'}`}>
            ▾
          </span>
        </div>
      </button>

      {/* ── Corps animé ── */}
      <div className={`cc-body${open ? '' : ' cc-body-closed'}`}>
        <div
          className="cc-body-inner"
          style={{ padding: `0 ${pad}px ${pad}px` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
