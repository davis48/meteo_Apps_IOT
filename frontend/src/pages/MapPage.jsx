import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  riskLevel, fmt, timeAgo, SENSOR_COLORS,
} from '../utils/helpers';
import Icon from '../components/ui/Icon';

// ─── Station popup content (rendered inside Leaflet Popup) ────────────────────
function PopupContent({ node, latest, risk, floodRisk, stormRisk, onNav }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', width: 240, padding: '14px 16px' }}>

      {/* Station header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
            {node.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {node.location || node.id}
          </div>
          {node.latitude && node.longitude && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {parseFloat(node.latitude).toFixed(4)}°N,{' '}
              {Math.abs(parseFloat(node.longitude)).toFixed(4)}°{parseFloat(node.longitude) < 0 ? 'W' : 'E'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
            background: `${risk.color}20`, color: risk.color,
          }}>
            {risk.label}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
            background: node.status === 'online' ? 'rgba(34,197,94,.15)' : 'rgba(148,163,184,.1)',
            color: node.status === 'online' ? '#22c55e' : 'var(--text-muted)',
          }}>
            {node.status === 'online' ? '● En ligne' : '○ Hors ligne'}
          </span>
        </div>
      </div>

      {latest ? (
        <>
          {/* Temperature big */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: 38, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#f97316', lineHeight: 1 }}>
              {fmt(latest.temperature)}
            </span>
            <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>°C</span>
          </div>

          {/* Metrics 2×2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Humidité',  value: fmt(latest.humidity),       unit: '%',    color: SENSOR_COLORS.humidity },
              { label: 'Pression',  value: latest.pressure != null ? Math.round(latest.pressure) : '—', unit: 'hPa', color: SENSOR_COLORS.pressure },
              { label: 'Vent',      value: fmt(latest.wind_speed, 0),  unit: 'km/h', color: SENSOR_COLORS.wind_speed },
              { label: 'Pluie',     value: fmt(latest.rain_level, 1),  unit: 'mm',   color: SENSOR_COLORS.rain_level },
            ].map(({ label, value, unit, color }) => (
              <div key={label} style={{
                background: 'var(--bg-elevated)', borderRadius: 8, padding: '7px 10px',
              }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color }}>
                  {value}
                  <span style={{ fontWeight: 400, fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Risk bars */}
          <div style={{ marginBottom: 10 }}>
            {[
              { label: 'Risque inondation', value: floodRisk, color: '#3b82f6' },
              { label: 'Risque tempête',    value: stormRisk, color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                  <span>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color, fontWeight: 700 }}>{Math.round(value)}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Last update */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
            Dernière mesure : {timeAgo(latest.timestamp)}
            {node.firmware_version && <span style={{ marginLeft: 8 }}>FW {node.firmware_version}</span>}
          </div>

          {/* Nav buttons */}
          {onNav && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => onNav('live')}
                style={{
                  flex: 1, padding: '7px 0',
                  background: '#3b82f6', color: '#fff',
                  border: 'none', borderRadius: 8,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Météo live
              </button>
              <button
                onClick={() => onNav('history')}
                style={{
                  flex: 1, padding: '7px 0',
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)', borderRadius: 8,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Historique
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
          Aucune donnée disponible
        </div>
      )}
    </div>
  );
}

// ─── Main Map Page ─────────────────────────────────────────────────────────────
export default function MapPage({ nodes = [], latestByNode = {}, onNav }) {
  const validNodes = useMemo(
    () => nodes.filter((n) => n.latitude && n.longitude),
    [nodes]
  );

  const stationsData = useMemo(() =>
    validNodes.map((node) => {
      const latest    = latestByNode[node.id];
      // Utiliser les champs pré-calculés par le backend
      const floodRisk = latest?.flood_risk ?? 0;
      const stormRisk = latest?.storm_risk ?? 0;
      const overall   = latest?.overall_risk ?? 0;
      const risk      = riskLevel(overall);
      return { node, latest, risk, floodRisk, stormRisk, overallRisk: overall };
    }),
    [validNodes, latestByNode]
  );

  // Compute map center from average of station coordinates
  const { center, zoom } = useMemo(() => {
    if (!validNodes.length) return { center: [5.35, -4.0], zoom: 11 };
    const lats = validNodes.map((n) => parseFloat(n.latitude));
    const lngs = validNodes.map((n) => parseFloat(n.longitude));
    const cLat  = lats.reduce((a, b) => a + b, 0) / lats.length;
    const cLng  = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    const spread = Math.max(
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lngs) - Math.min(...lngs)
    );
    const z = spread < 0.02 ? 15
            : spread < 0.05 ? 14
            : spread < 0.15 ? 13
            : spread < 0.4  ? 12
            : spread < 1    ? 11
            : spread < 3    ? 10 : 8;
    return { center: [cLat, cLng], zoom: z };
  }, [validNodes]);

  // Detect dark/light theme on each render (synced with App.jsx toggle)
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const tileAttrib = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  if (!validNodes.length) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Carte des Stations</div>
            <div className="page-subtitle">Visualisation géographique des stations IoT</div>
          </div>
        </div>
        <div className="section">
          <div className="card">
            <div className="empty-state">
              <Icon name="stations" size={36} className="empty-state-icon" />
              <div className="empty-state-title">Aucune coordonnée GPS</div>
              <div className="empty-state-text">
                Renseignez la latitude et la longitude des stations dans l'onglet Stations IoT.
              </div>
              {onNav && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNav('stations')}>
                  Gérer les stations
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const onlineCount   = nodes.filter((n) => n.status === 'online').length;
  const offlineCount  = nodes.filter((n) => n.status !== 'online').length;
  const criticalCount = stationsData.filter((s) => s.overallRisk >= 75).length;

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Carte des Stations</div>
          <div className="page-subtitle">
            {validNodes.length} station{validNodes.length > 1 ? 's' : ''} · OpenStreetMap · Cliquez un marqueur pour les détails
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="section">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

          {/* Global counters */}
          {[
            { label: 'En ligne',    value: onlineCount,   color: '#22c55e' },
            { label: 'Hors ligne',  value: offlineCount,  color: 'var(--text-muted)' },
            { label: 'Critiques',   value: criticalCount, color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
              borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 20, color }}>{value}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}

          {/* Per-station live mini-card */}
          {stationsData.map(({ node, latest, risk }) => (
            <div key={node.id} style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${risk.color}35`,
              borderRadius: 12, padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              flex: '1 1 200px',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: risk.color, boxShadow: `0 0 8px ${risk.color}80`,
              }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{node.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{node.location || node.id}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                {latest?.temperature != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14, color: '#f97316' }}>
                    {fmt(latest.temperature)}°C
                  </span>
                )}
                {latest?.humidity != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: SENSOR_COLORS.humidity }}>
                    {fmt(latest.humidity)}%
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 8,
                background: `${risk.color}20`, color: risk.color, fontWeight: 700, flexShrink: 0,
              }}>
                {risk.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Leaflet Map ── */}
      <div className="section">
        <div style={{
          borderRadius: 16, overflow: 'hidden',
          border: '1px solid var(--border-default)',
          height: 520, 
        }}>
          <MapContainer
            key={isDark ? 'dark' : 'light'}
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer url={tileUrl} attribution={tileAttrib} />

            {stationsData.map(({ node, latest, risk, floodRisk, stormRisk, overallRisk }) => {
              const lat    = parseFloat(node.latitude);
              const lng    = parseFloat(node.longitude);
              // Radius scales with risk (min 10, max 22)
              const radius = 10 + (overallRisk / 100) * 12;

              return (
                <CircleMarker
                  key={node.id}
                  center={[lat, lng]}
                  radius={radius}
                  pathOptions={{
                    fillColor:   risk.color,
                    fillOpacity: node.status === 'online' ? 0.9 : 0.45,
                    color:       '#ffffff',
                    weight:      2,
                    opacity:     0.9,
                  }}
                >
                  {/* Hover tooltip */}
                  <Tooltip direction="top" offset={[0, -radius - 2]} opacity={0.95}>
                    <div style={{ fontFamily: 'var(--font-sans)', padding: '2px 6px', fontSize: 12 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{node.name}</strong>
                      {latest?.temperature != null && (
                        <span style={{ color: '#f97316', marginLeft: 8, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {fmt(latest.temperature)}°C
                        </span>
                      )}
                      {latest?.humidity != null && (
                        <span style={{ color: SENSOR_COLORS.humidity, marginLeft: 6, fontFamily: 'var(--font-mono)' }}>
                          {fmt(latest.humidity)}%
                        </span>
                      )}
                      <span style={{
                        marginLeft: 8, fontSize: 10,
                        color: risk.color, fontWeight: 700,
                        padding: '1px 6px', background: `${risk.color}20`, borderRadius: 4,
                      }}>
                        {risk.label}
                      </span>
                    </div>
                  </Tooltip>

                  {/* Click popup */}
                  <Popup maxWidth={260} minWidth={240} autoPan>
                    <PopupContent
                      node={node}
                      latest={latest}
                      risk={risk}
                      floodRisk={floodRisk}
                      stormRisk={stormRisk}
                      onNav={onNav}
                    />
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* ── Stations table ── */}
      <div className="section">
        <div className="section-title">
          Toutes les stations
          <div className="section-title-line" />
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Statut</th>
                  <th>GPS</th>
                  <th>Temp (°C)</th>
                  <th>Humidité (%)</th>
                  <th>Vent (km/h)</th>
                  <th>Pluie (mm)</th>
                  <th>Risque</th>
                  <th>Dernière màj</th>
                </tr>
              </thead>
              <tbody>
                {stationsData.map(({ node, latest, risk }) => (
                  <tr key={node.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{node.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{node.location || node.id}</div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: node.status === 'online' ? 'rgba(34,197,94,.15)' : 'rgba(148,163,184,.1)',
                        color:      node.status === 'online' ? '#22c55e' : 'var(--text-muted)',
                      }}>
                        {node.status === 'online' ? '● En ligne' : '○ Hors ligne'}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {node.latitude && node.longitude
                        ? `${parseFloat(node.latitude).toFixed(4)}, ${parseFloat(node.longitude).toFixed(4)}`
                        : '—'}
                    </td>
                    <td className="mono" style={{ color: '#f97316' }}>{latest ? fmt(latest.temperature) : '—'}</td>
                    <td className="mono" style={{ color: SENSOR_COLORS.humidity }}>{latest ? fmt(latest.humidity) : '—'}</td>
                    <td className="mono" style={{ color: SENSOR_COLORS.wind_speed }}>{latest ? fmt(latest.wind_speed, 0) : '—'}</td>
                    <td className="mono" style={{ color: SENSOR_COLORS.rain_level }}>{latest ? fmt(latest.rain_level, 1) : '—'}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: `${risk.color}20`, color: risk.color,
                      }}>
                        {risk.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {latest ? timeAgo(latest.timestamp) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
