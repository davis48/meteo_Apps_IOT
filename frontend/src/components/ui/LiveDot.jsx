export default function LiveDot({ active = true, size = 8 }) {
  return (
    <span
      className={`live-dot ${active ? 'online' : 'offline'}`}
      style={{ width: size, height: size }}
    />
  );
}
