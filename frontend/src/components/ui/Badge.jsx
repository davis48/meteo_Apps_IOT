export default function Badge({ children, color, bg }) {
  const safeColor = color || 'var(--accent)';
  const safeBg    = bg    || 'var(--accent-dim)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: safeBg,
        color: safeColor,
        border: `1px solid ${safeColor}44`,
        borderRadius: 20,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
