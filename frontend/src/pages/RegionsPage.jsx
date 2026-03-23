import { useMemo } from 'react';
import { fmt, SENSOR_COLORS, weatherCondition } from '../utils/helpers';
import Icon from '../components/ui/Icon';

// ─── Correspondance condition → nom d'icône SVG ───────────────
const COND_ICON = {
  'Tempête':              'storm',
  'Forte pluie':          'rain',
  'Pluie':                'rain',
  'Vent violent':         'wind',
  'Dépression':           'cloud',
  'Nuageux':              'cloud',
  'Ensoleillé':           'sun',
  'Partiellement nuageux':'sun',
  'Chaud':               'thermometer',
  'Gel':                 'thermometer',
  'Stable':              'weather',
};

// ─── Palette géographique : 4 zones seulement (pas une couleur par région) ─
// Nord (chaud/sec) : orange · Montagne (altitude) : indigo · Sud (humide) : blue · Centre : slate
const ZONE_COLOR = {
  'Sud': '#3b82f6',       'Sud-Ouest': '#3b82f6',
  'Est': '#64748b',       'Centre-Ouest': '#64748b',
  'Centre': '#64748b',   'Centre-Nord': '#64748b',
  'Ouest': '#6366f1',
  'Nord-Est': '#94a3b8', 'Nord': '#f97316',  'Nord-Ouest': '#f97316',
};
const DEFAULT_ZONE_COLOR = '#64748b';

// ─── Métadonnées régionales (du Sud vers le Nord) ─────────────────────────
const REGION_META = {
  'Lagunes':             { climate: 'Équatorial côtier',      zone: 'Sud',          order: 1 },
  'Bas-Sassandra':       { climate: 'Sub-équatorial côtier',  zone: 'Sud-Ouest',    order: 2 },
  'Comoé':              { climate: 'Sub-équatorial',          zone: 'Est',           order: 3 },
  'Sassandra-Marahoué':  { climate: 'Transition forestière',  zone: 'Centre-Ouest', order: 4 },
  'Lacs':               { climate: 'Tropical humide',         zone: 'Centre',        order: 5 },
  'Vallée du Bandama':   { climate: 'Tropical',               zone: 'Centre-Nord',  order: 6 },
  'Montagnes':           { climate: "Tropical d'altitude",    zone: 'Ouest',         order: 7 },
  'Zanzan':             { climate: 'Soudano-guinéen',         zone: 'Nord-Est',      order: 8 },
  'Savanes':            { climate: 'Tropical sec',            zone: 'Nord',          order: 9 },
  "Denguélé":           { climate: 'Semi-aride',              zone: 'Nord-Ouest',    order: 10 },
};
const DEFAULT_META = { climate: 'Tropical', zone: "Côte d'Ivoire", order: 99 };
const getMeta = (region) => {
  const m = REGION_META[region] || DEFAULT_META;
  return { ...m, color: ZONE_COLOR[m.zone] || DEFAULT_ZONE_COLOR };
};

// ─── Couleur selon la température — 2 états seulement (sémantique) ────────
function tempColor(t) {
  if (t == null) return 'var(--text-muted)';
  if (t >= 32)   return '#f97316'; // chaud
  if (t < 22)    return '#60a5fa'; // frais
  return 'var(--text-primary)';   // normal
}

// ─── Carte météo d'une région ─────────────────────────────────────────────
function RegionCard({ regionData, isSelected, onSelect }) {
  const meta = getMeta(regionData.region);
  const {
    avg_temperature, avg_humidity, avg_pressure,
    max_wind_speed, max_rain_level, node_count, online_count, nodes,
  } = regionData;

  const refLatest  = nodes.map((n) => n.latest).find(Boolean);
  // Utiliser le condition_label pré-calculé par le backend si disponible, sinon fallback frontend
  const condLabel    = refLatest?.condition_label || weatherCondition(refLatest).label;
  const condIconName = COND_ICON[condLabel] || 'weather';
  const allOffline = online_count === 0;
  const hasData    = avg_temperature != null && !allOffline;

  return (
    <div
      onClick={() => onSelect(regionData.region)}
      style={{
        background: 'var(--bg-surface)',
        border: isSelected
          ? '2px solid var(--accent)'
          : '1px solid var(--border-default)',
        borderRadius: 16,
        padding: '20px 20px 14px',
        cursor: 'pointer',
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: isSelected
          ? '0 0 0 3px var(--accent-glow), 0 4px 16px rgba(0,0,0,.08)'
          : '0 1px 4px rgba(0,0,0,.04)',
      }}
    >
      {/* Zone badge + emoji */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 6,
            background: 'var(--bg-elevated)', color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
            letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 6,
          }}>
            {meta.zone}
          </div>
          <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {regionData.region}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {meta.climate}
          </div>
        </div>
        <div style={{ flexShrink: 0, marginTop: 2, opacity: node_count === 0 ? 0.25 : allOffline ? 0.4 : 0.55 }}>
          <Icon name={node_count === 0 ? 'node' : allOffline ? 'offline' : condIconName} size={26} color="var(--text-secondary)" />
        </div>
      </div>

      {/* Température hero */}
      {hasData ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 900,
              fontSize: 52, color: tempColor(avg_temperature), lineHeight: 1,
              letterSpacing: '-3px',
            }}>
              {fmt(avg_temperature, 1)}
            </span>
            <span style={{ fontSize: 22, color: 'var(--text-muted)', fontWeight: 500 }}>°C</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 16 }}>
            {condLabel}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 16, marginTop: 4 }}>
          {node_count === 0 ? 'Aucune station déployée' : allOffline ? 'Station hors ligne' : 'Aucune donnée'}
        </div>
      )}

      {/* Métriques 2×2 */}
      {hasData && avg_humidity != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
          {[
            { icon: 'humidity',  label: 'Humidité',  value: `${Math.round(avg_humidity)} %`,           color: SENSOR_COLORS.humidity },
            { icon: 'wind',      label: 'Vent max',  value: `${Math.round(max_wind_speed ?? 0)} km/h`, color: SENSOR_COLORS.wind_speed },
            { icon: 'rain',      label: 'Pluie max', value: `${fmt(max_rain_level ?? 0, 1)} mm`,       color: SENSOR_COLORS.rain_level },
            { icon: 'pressure',  label: 'Pression',  value: `${Math.round(avg_pressure ?? 1013)} hPa`, color: SENSOR_COLORS.pressure },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{
              background: 'var(--bg-elevated)', borderRadius: 10, padding: '8px 10px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name={icon} size={14} color={color} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stations de la région */}
      <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {nodes.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Station prévue — données disponibles dès la connexion
          </div>
        )}
        {nodes.map((n) => {
          const t = n.latest?.temperature;
          return (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: n.status === 'online' ? '#22c55e' : 'var(--text-muted)',
              }} />
              <span style={{
                fontSize: 11, color: 'var(--text-secondary)', flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {n.name}
              </span>
              {t != null && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: tempColor(t), flexShrink: 0 }}>
                  {fmt(t)}°C
                </span>
              )}
            </div>
          );
        })}
        {isSelected && (
          <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
            ✓ Filtre actif sur toutes les pages
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Classement horizontal des températures ───────────────────────────────
function TempRanking({ regions }) {
  const withTemp = [...regions]
    .filter((r) => r.avg_temperature != null)
    .sort((a, b) => b.avg_temperature - a.avg_temperature);

  if (!withTemp.length) return null;

  const maxT  = Math.max(...withTemp.map((r) => r.avg_temperature));
  const minT  = Math.min(...withTemp.map((r) => r.avg_temperature));
  const range = maxT - minT || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {withTemp.map((r) => {
        const meta = getMeta(r.region);
        const pct  = ((r.avg_temperature - minT) / range) * 75 + 25;
        return (
          <div key={r.region} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 180, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{r.region}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{meta.zone}</div>
            </div>
            <div style={{ flex: 1, height: 12, background: 'var(--bg-elevated)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: `linear-gradient(90deg, var(--accent-muted), var(--accent))`,
              opacity: 0.75 + (0.25 * (pct / 100)),
                borderRadius: 6, transition: 'width .5s ease',
              }} />
            </div>
            <div style={{
              width: 60, textAlign: 'right', flexShrink: 0,
              fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15,
              color: tempColor(r.avg_temperature),
            }}>
              {fmt(r.avg_temperature, 1)}°C
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────
export default function RegionsPage({ nodes = [], latestByNode = {}, regionFilter = null, onRegionChange }) {
  const regionData = useMemo(() => {
    const map = {};
    for (const node of nodes) {
      const key = node.region || node.location || 'Inconnue';
      if (!map[key]) map[key] = { region: key, nodes: [] };
      map[key].nodes.push({ ...node, latest: latestByNode[node.id] || null });
    }
    // S'assurer que toutes les régions CI connues apparaissent même sans station
    for (const region of Object.keys(REGION_META)) {
      if (!map[region]) map[region] = { region, nodes: [] };
    }
    return Object.values(map)
      .map((r) => {
        const withData = r.nodes.filter((n) => n.latest);
        const vals     = (field) => withData.map((n) => n.latest[field]).filter((v) => v != null);
        const avg      = (arr)   => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
        const max      = (arr)   => arr.length ? Number(Math.max(...arr).toFixed(1)) : null;
        return {
          region:          r.region,
          node_count:      r.nodes.length,
          online_count:    r.nodes.filter((n) => n.status === 'online').length,
          avg_temperature: avg(vals('temperature')),
          avg_humidity:    avg(vals('humidity')),
          avg_pressure:    avg(vals('pressure')),
          max_wind_speed:  max(vals('wind_speed')),
          max_rain_level:  max(vals('rain_level')),
          nodes:           r.nodes,
        };
      })
      .sort((a, b) => (getMeta(a.region).order || 99) - (getMeta(b.region).order || 99));
  }, [nodes, latestByNode]);

  // KPIs nationaux
  const allTemps     = regionData.filter((r) => r.avg_temperature != null).map((r) => r.avg_temperature);
  const nationalAvgT = allTemps.length ? (allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1) : null;
  const totalOnline  = nodes.filter((n) => n.status === 'online').length;
  const hottest      = [...regionData].sort((a, b) => (b.avg_temperature ?? -99) - (a.avg_temperature ?? -99))[0];
  const coolest      = [...regionData].sort((a, b) => (a.avg_temperature ?? 999) - (b.avg_temperature ?? 999))[0];
  const nationalRef  = regionData.find((r) => r.avg_temperature != null);
  const natCondition = nationalRef
    ? { label: nationalRef.nodes.map((n) => n.latest?.condition_label).find(Boolean) || weatherCondition({ temperature: nationalRef.avg_temperature, rain_level: nationalRef.max_rain_level, wind_speed: nationalRef.max_wind_speed }).label }
    : { label: 'Variable' };

  const handleSelect = (region) => {
    if (onRegionChange) onRegionChange(regionFilter === region ? null : region);
  };

  return (
    <div>
      {/* ── En-tête ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Météo par Région · Côte d'Ivoire</div>
          <div className="page-subtitle">
            {regionData.length} régions · {nodes.length} stations · {totalOnline} en ligne
            {regionFilter && (
              <span style={{ marginLeft: 10, color: '#f97316', fontWeight: 700 }}>
                · Filtre actif : {regionFilter}
              </span>
            )}
          </div>
        </div>
        {regionFilter && (
          <button className="btn" onClick={() => onRegionChange && onRegionChange(null)} style={{ fontSize: 12 }}>
            ✕ Effacer le filtre
          </button>
        )}
      </div>

      {/* ── Bannière météo nationale ── */}
      <div className="section">
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,.08) 0%, var(--bg-surface) 60%)',
          border: '1px solid var(--border-default)',
          borderRadius: 18, padding: '24px 28px',
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', borderRadius: 16 }}>
              <Icon name="map" size={32} color="var(--text-secondary)" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>
                Température nationale moyenne
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 52,
                  color: tempColor(nationalAvgT ? parseFloat(nationalAvgT) : null), lineHeight: 1,
                }}>
                  {nationalAvgT ?? '—'}
                </span>
                <span style={{ fontSize: 22, color: 'var(--text-muted)' }}>°C</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {natCondition.label} · Conditions variables selon la latitude
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 70, background: 'var(--border-default)', flexShrink: 0 }} />

          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {hottest?.avg_temperature != null && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Max. enregistré</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#ef4444' }}>{hottest.region}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 900, color: '#ef4444' }}>
                  {fmt(hottest.avg_temperature, 1)}°C
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{getMeta(hottest.region).zone}</div>
              </div>
            )}
            {coolest?.avg_temperature != null && coolest.region !== hottest?.region && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Min. enregistré</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#22c55e' }}>{coolest.region}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 900, color: '#22c55e' }}>
                  {fmt(coolest.avg_temperature, 1)}°C
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{getMeta(coolest.region).zone}</div>
              </div>
            )}
          </div>

          <div style={{
            marginLeft: 'auto',
            fontSize: 12, color: 'var(--text-muted)',
            background: 'var(--bg-elevated)', borderRadius: 12, padding: '10px 16px',
            maxWidth: 210, lineHeight: 1.5,
          }}>
            Cliquez sur une région pour <strong style={{ color: 'var(--text-primary)' }}>filtrer toutes les pages</strong> de l'application
          </div>
        </div>
      </div>

      {/* ── Cartes météo par région ── */}
      <div className="section">
        <div className="section-title">
          Conditions actuelles par région
          <div className="section-title-line" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
          {regionData.map((r) => (
            <RegionCard
              key={r.region}
              regionData={r}
              isSelected={regionFilter === r.region}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* ── Classement des températures ── */}
      <div className="section">
        <div className="section-title">
          Classement — du plus chaud au plus frais
          <div className="section-title-line" />
        </div>
        <div className="card">
          <TempRanking regions={regionData} />
        </div>
      </div>
    </div>
  );
}

