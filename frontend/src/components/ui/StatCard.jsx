import Icon from './Icon';

// ─── Inline sparkline SVG ─────────────────────────────────────────────────────
function SparkLine({ data, color, label }) {
  if (!data || data.length < 2) return null;
  const nums = data.map(Number).filter((n) => !isNaN(n));
  if (nums.length < 2) return null;

  const W = 100, H = 32;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const xStep = W / (nums.length - 1);

  const pts = nums.map((v, i) => [
    +(i * xStep).toFixed(2),
    +(H - 6 - ((v - min) / range) * (H - 10)).toFixed(2),
  ]);

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const gradId = `spl-${(label || '').replace(/\s+/g, '').toLowerCase()}-${color.replace('#', '')}`;

  return (
    <svg
      width="100%" height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({
  label,
  value,
  unit,
  icon,
  accent = '#3b82f6',
  trend,
  trendValue,
  subtitle,
  sparkData,
}) => {
  const iconBg = accent + '22';

  const trendClass =
    trend === 'up'   ? 'trend-up'   :
    trend === 'down' ? 'trend-down' : '';

  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div
      className="stat-card"
      style={{ '--card-accent': accent, '--card-icon-bg': iconBg }}
    >
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && (
          <div className="stat-card-icon">
            <Icon name={icon} size={15} />
          </div>
        )}
      </div>

      <div className="stat-card-value">
        <span className="stat-card-number">
          {value != null ? value : '—'}
        </span>
        {unit && <span className="stat-card-unit">{unit}</span>}
      </div>

      {(trend || subtitle) && (
        <div className={`stat-card-trend ${trendClass}`}>
          {trend && <span>{trendArrow}</span>}
          {trendValue && <span>{trendValue}</span>}
          {subtitle && <span style={{ color: 'var(--text-muted)' }}>{subtitle}</span>}
        </div>
      )}

      {/* Sparkline */}
      <SparkLine data={sparkData} color={accent} label={label} />
    </div>
  );
};

export default StatCard;
