import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// API CONFIG
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3002";

// THEME
const C = {
  bg: "#050b14",
  surface: "#0a1628",
  card: "#0d1f3c",
  cardHover: "#112347",
  border: "#1a3058",
  accent: "#00d4ff",
  accentDim: "#0099bb",
  green: "#00e676",
  yellow: "#ffd740",
  orange: "#ff9100",
  red: "#ff1744",
  purple: "#ea80fc",
  text: "#e8f4fd",
  textMuted: "#5a8aaa",
  textDim: "#2d5070",
};

// HELPERS
const fmt = (v, u = "") => (v != null ? `${Number(v).toFixed(1)}${u}` : "—");
const ts = (unix) =>
  new Date(unix * 1000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
const tsDate = (unix) =>
  new Date(unix * 1000).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const severityColor = { critical: C.red, warning: C.orange, info: C.accent };
const severityBg = { critical: "#2a0a10", warning: "#2a1a00", info: "#002a35" };

// STYLES
const S = {
  app: {
    background: C.bg,
    minHeight: "100vh",
    fontFamily: "'Space Grotesk', 'DM Mono', monospace",
    color: C.text,
    display: "flex",
  },
  sidebar: {
    width: 220,
    minWidth: 220,
    background: C.surface,
    borderRight: `1px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    padding: "0",
    position: "sticky",
    top: 0,
    height: "100vh",
  },
  logo: {
    padding: "24px 20px 20px",
    borderBottom: `1px solid ${C.border}`,
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: C.accent,
    letterSpacing: "0.05em",
    lineHeight: 1.2,
  },
  logoSub: { fontSize: 10, color: C.textMuted, marginTop: 3, letterSpacing: "0.08em" },
  nav: { flex: 1, padding: "16px 0" },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    cursor: "pointer",
    color: active ? C.accent : C.textMuted,
    background: active ? `${C.accent}12` : "transparent",
    borderLeft: `3px solid ${active ? C.accent : "transparent"}`,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    transition: "all 0.15s",
    userSelect: "none",
  }),
  main: { flex: 1, overflow: "auto", padding: 24 },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  pageTitle: { fontSize: 22, fontWeight: 700, color: C.text },
  badge: (color) => ({
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 600,
  }),
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  card: (extra = {}) => ({
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 20,
    ...extra,
  }),
  cardTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: C.textMuted,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 14,
  },
  statVal: { fontSize: 32, fontWeight: 700, color: C.text, lineHeight: 1 },
  statUnit: { fontSize: 14, color: C.textMuted, marginLeft: 4 },
  statLabel: { fontSize: 12, color: C.textMuted, marginTop: 6 },
  dot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    marginRight: 6,
  }),
  tag: (color) => ({
    background: `${color}20`,
    color,
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600,
    border: `1px solid ${color}40`,
  }),
  row: { display: "flex", alignItems: "center", gap: 10 },
  divider: { height: 1, background: C.border, margin: "16px 0" },
  btn: (color = C.accent) => ({
    background: `${color}20`,
    color,
    border: `1px solid ${color}50`,
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  }),
  input: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    color: C.text,
    fontSize: 13,
    outline: "none",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: C.textMuted,
    letterSpacing: "0.08em",
    borderBottom: `1px solid ${C.border}`,
  },
  td: { padding: "10px 12px", fontSize: 13, borderBottom: `1px solid ${C.border}20` },
};

// MINI COMPONENTS
const Icon = ({ name, size = 16, color = "currentColor" }) => {
  const icons = {
    dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
    sensors:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    alerts:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
    ai: "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-13h2v6h-2zm0 8h2v2h-2z",
    nodes:
      "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
    api: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z",
    temp: "M17 8C8 10 5.9 16.17 3.82 21H5.71c.19-.5.39-1 .59-1.46C8.4 17.74 11 17 14 17c-1.04-4.36-4-5-4-5 7 0 9 5.41 9 10h1.5C21 12 17 8 17 8z",
    humidity:
      "M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z",
    pressure:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z",
    wind: "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z",
    rain: "M17 8H7l-5 9h20l-5-9zm-9 7l1.5-6h5l1.5 6H8z",
    lux: "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d={icons[name] || icons.dashboard} />
    </svg>
  );
};

const LiveDot = ({ active = true }) => (
  <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 8 }}>
    {active && (
      <span
        style={{
          position: "absolute",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: `${C.green}33`,
          animation: "ping 1.5s ease-in-out infinite",
          left: -3,
          top: -3,
        }}
      />
    )}
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: active ? C.green : C.textDim,
        display: "inline-block",
      }}
    />
    <style>{`@keyframes ping { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(2.2);opacity:0} }`}</style>
  </span>
);

const MiniGauge = ({ value, max, color, label, unit }) => {
  const pct = Math.min(100, Math.max(0, ((value || 0) / max) * 100));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>
          {fmt(value)}
          {unit}
        </span>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div
          style={{
            height: 4,
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value} {p.unit || ""}
        </div>
      ))}
    </div>
  );
};

const StatCard = ({ icon, label, value, unit, color, sub, trend }) => (
  <div style={S.card()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={S.cardTitle}>{label}</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ ...S.statVal, color }}>{value}</span>
          <span style={S.statUnit}>{unit}</span>
        </div>
        {sub && (
          <div
            style={{
              ...S.statLabel,
              color: trend === "up" ? C.green : trend === "down" ? C.red : C.textMuted,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <div style={{ background: `${color}18`, padding: 10, borderRadius: 10 }}>
        <Icon name={icon} size={22} color={color} />
      </div>
    </div>
  </div>
);

// PAGES
const DashboardPage = ({ liveData, history, alerts, summary }) => {
  const latest = liveData || history[history.length - 1];
  const chartData = history.slice(-24).map((d) => ({
    time: ts(d.timestamp),
    Température: d.temperature,
    Humidité: d.humidity,
    Pression: d.pressure,
    Vent: d.wind_speed,
    Pluie: d.rain_level,
  }));
  const activeAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.pageTitle}>Tableau de Bord</h1>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            Surveillance météorologique en temps réel
            <LiveDot active />
          </div>
        </div>
        <div style={S.row}>
          <span style={S.badge(C.green)}>{summary?.nodes?.online ?? 0} stations actives</span>
          <span style={S.badge(C.orange)}>{activeAlerts.length} alertes actives</span>
        </div>
      </div>

      <div style={S.grid4}>
        <StatCard
          icon="temp"
          label="Température"
          value={fmt(latest?.temperature)}
          unit="°C"
          color={C.orange}
          sub={latest?.temperature > 35 ? "Niveau élevé" : "Niveau stable"}
          trend={latest?.temperature > 35 ? "up" : "flat"}
        />
        <StatCard
          icon="humidity"
          label="Humidité"
          value={fmt(latest?.humidity)}
          unit="%"
          color={C.accent}
          sub="Normale pour la saison"
        />
        <StatCard
          icon="pressure"
          label="Pression"
          value={fmt(latest?.pressure)}
          unit="hPa"
          color={C.purple}
          sub={latest?.pressure < 1006 ? "Tendance orageuse" : "Pression stable"}
          trend={latest?.pressure < 1006 ? "down" : "flat"}
        />
        <StatCard icon="wind" label="Vent" value={fmt(latest?.wind_speed)} unit="m/s" color={C.green} sub="Direction: O-NO" />
      </div>

      <div style={{ height: 16 }} />

      <div style={S.grid4}>
        <StatCard icon="rain" label="Précipitations" value={fmt(latest?.rain_level)} unit="mm/h" color={C.accent} />
        <StatCard icon="lux" label="Luminosité" value={fmt(latest?.luminosity, "")} unit=" lux" color={C.yellow} />
        <StatCard
          icon="ai"
          label="Score Anomalie"
          value={latest ? (latest.anomaly_score * 100).toFixed(0) : "0"}
          unit="%"
          color={latest?.anomaly_score > 0.7 ? C.red : C.green}
          sub={latest?.is_anomaly ? "⚠ Anomalie détectée" : "Normal"}
        />
        <StatCard
          icon="sensors"
          label="Lectures totales"
          value={(summary?.readings?.total ?? 0).toLocaleString("fr-FR")}
          unit=""
          color={C.textMuted}
          sub="Depuis initialisation"
        />
      </div>

      <div style={{ height: 20 }} />

      <div style={S.grid2}>
        <div style={S.card()}>
          <div style={S.cardTitle}>Température & Humidité — 24 dernières heures</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.orange} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.orange} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gHum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="time" tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Température" stroke={C.orange} fill="url(#gTemp)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Humidité" stroke={C.accent} fill="url(#gHum)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={S.card()}>
          <div style={S.cardTitle}>Pression atmosphérique — 24 dernières heures</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="time" tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Pression" stroke={C.purple} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div style={S.grid2}>
        <div style={S.card()}>
          <div style={S.cardTitle}>Précipitations (mm/h)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData.slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="time" tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Pluie" fill={C.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={S.card()}>
          <div style={S.cardTitle}>Alertes récentes</div>
          {alerts.slice(0, 4).map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 12,
                padding: "8px 10px",
                background: severityBg[a.severity] || severityBg.info,
                borderRadius: 8,
                borderLeft: `3px solid ${severityColor[a.severity] || C.accent}`,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: severityColor[a.severity] || C.accent, marginBottom: 2 }}>
                  {a.type}
                </div>
                <div style={{ fontSize: 12, color: C.text }}>{a.message}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                  {tsDate(a.timestamp)} — {a.node_id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SensorsPage = ({ nodes, historyByNode, latestByNode }) => {
  const [selectedNode, setSelectedNode] = useState("node-001");
  const [period, setPeriod] = useState("24h");

  useEffect(() => {
    if (nodes.length && !nodes.some((n) => n.id === selectedNode)) {
      setSelectedNode(nodes[0].id);
    }
  }, [nodes, selectedNode]);

  const rangeSec = period === "6h" ? 6 * 3600 : period === "24h" ? 24 * 3600 : 7 * 86400;
  const fromTs = Math.floor(Date.now() / 1000) - rangeSec;
  const selectedHistory = (historyByNode[selectedNode] || []).filter((d) => d.timestamp >= fromTs);
  const latest = latestByNode[selectedNode] || selectedHistory[selectedHistory.length - 1];

  const data = selectedHistory.map((d) => ({
    time: ts(d.timestamp),
    Temp: d.temperature,
    Hum: d.humidity,
    Press: d.pressure,
    Lux: d.luminosity / 10,
    Pluie: d.rain_level,
    Vent: d.wind_speed,
    Anomalie: d.anomaly_score * 100,
  }));

  return (
    <div>
      <div style={S.header}>
        <h1 style={S.pageTitle}>Données Capteurs</h1>
        <div style={S.row}>
          {nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedNode(n.id)}
              style={{
                ...S.btn(selectedNode === n.id ? C.accent : C.textMuted),
                background: selectedNode === n.id ? `${C.accent}25` : "transparent",
              }}
            >
              {n.name}
            </button>
          ))}
          {["6h", "24h", "7d"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                ...S.btn(period === p ? C.purple : C.textMuted),
                background: period === p ? `${C.purple}25` : "transparent",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={S.grid4}>
        {[
          { icon: "temp", label: "Température", value: latest?.temperature, unit: "°C", max: 50, color: C.orange },
          { icon: "humidity", label: "Humidité", value: latest?.humidity, unit: "%", max: 100, color: C.accent },
          { icon: "pressure", label: "Pression", value: latest?.pressure, unit: "hPa", max: 1050, color: C.purple },
          { icon: "wind", label: "Vent", value: latest?.wind_speed, unit: "m/s", max: 30, color: C.green },
        ].map(({ icon, label, value, unit, max, color }) => (
          <div key={label} style={S.card()}>
            <div style={S.cardTitle}>{label}</div>
            <div style={{ ...S.statVal, color, fontSize: 36, marginBottom: 8 }}>
              {fmt(value)}
              <span style={S.statUnit}>{unit}</span>
            </div>
            <MiniGauge value={value} max={max} color={color} label={label} unit={unit} />
          </div>
        ))}
      </div>

      <div style={{ height: 16 }} />

      <div style={S.card({ marginBottom: 16 })}>
        <div style={S.cardTitle}>Température & Humidité</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.orange} stopOpacity={0.4} />
                <stop offset="95%" stopColor={C.orange} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.accent} stopOpacity={0.4} />
                <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="time" tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: C.textMuted, fontSize: 12 }} />
            <Area type="monotone" dataKey="Temp" name="Temp (°C)" stroke={C.orange} fill="url(#gT)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Hum" name="Humidité (%)" stroke={C.accent} fill="url(#gH)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={S.grid2}>
        <div style={S.card()}>
          <div style={S.cardTitle}>Score Anomalie IA (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.red} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={C.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="time" tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Anomalie" stroke={C.red} fill="url(#gA)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={() => 70} stroke={C.orange} strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={S.card()}>
          <div style={S.cardTitle}>Vent & Précipitations</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="time" tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: C.textMuted, fontSize: 12 }} />
              <Line type="monotone" dataKey="Vent" stroke={C.green} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Pluie" stroke={C.accent} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const AlertsPage = ({ alerts, onAcknowledge }) => {
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all"
      ? alerts
      : filter === "active"
        ? alerts.filter((a) => !a.acknowledged)
        : alerts.filter((a) => a.severity === filter);

  return (
    <div>
      <div style={S.header}>
        <h1 style={S.pageTitle}>Alertes & Événements</h1>
        <div style={S.row}>
          {["all", "active", "critical", "warning", "info"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...S.btn(filter === f ? C.accent : C.textMuted),
                background: filter === f ? `${C.accent}20` : "transparent",
                textTransform: "capitalize",
              }}
            >
              {f === "all" ? "Toutes" : f === "active" ? "Actives" : f}
            </button>
          ))}
        </div>
      </div>

      <div style={S.grid4}>
        {[
          { label: "Total alertes", value: alerts.length, color: C.textMuted },
          { label: "Actives", value: alerts.filter((a) => !a.acknowledged).length, color: C.orange },
          { label: "Critiques", value: alerts.filter((a) => a.severity === "critical").length, color: C.red },
          { label: "Acquittées", value: alerts.filter((a) => a.acknowledged).length, color: C.green },
        ].map(({ label, value, color }) => (
          <div key={label} style={S.card()}>
            <div style={S.cardTitle}>{label}</div>
            <div style={{ ...S.statVal, color, fontSize: 40 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 16 }} />

      <div style={S.card()}>
        <div style={S.cardTitle}>Journal des alertes ({filtered.length})</div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textMuted, padding: "40px 0" }}>Aucune alerte</div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                background: a.acknowledged ? "transparent" : severityBg[a.severity] || severityBg.info,
                borderRadius: 10,
                marginBottom: 8,
                borderLeft: `4px solid ${a.acknowledged ? C.border : severityColor[a.severity] || C.accent}`,
                opacity: a.acknowledged ? 0.6 : 1,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={S.row}>
                  <span style={S.tag(severityColor[a.severity] || C.accent)}>{a.severity.toUpperCase()}</span>
                  <span style={S.tag(C.textMuted)}>{a.type}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{a.node_id}</span>
                </div>
                <div style={{ fontSize: 13, color: C.text, marginTop: 6 }}>{a.message}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{tsDate(a.timestamp)}</div>
              </div>
              {!a.acknowledged && (
                <button onClick={() => onAcknowledge(a.id)} style={S.btn(C.green)}>
                  Acquitter
                </button>
              )}
              {a.acknowledged && <span style={{ fontSize: 11, color: C.green }}>✓ Acquittée</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AIPage = ({ history, predictions, aiMetrics }) => {
  const metrics = aiMetrics || FALLBACK_AI_METRICS;
  const embedded = metrics.embedded_model || FALLBACK_AI_METRICS.embedded_model;
  const cloud = metrics.cloud_model || FALLBACK_AI_METRICS.cloud_model;
  const realtime = metrics.realtime || FALLBACK_AI_METRICS.realtime;
  const threshold = realtime.anomaly_threshold ?? 70;

  const anomalyData = history.slice(-24).map((d) => ({
    time: ts(d.timestamp),
    Score: +(d.anomaly_score * 100).toFixed(1),
    Seuil: threshold,
  }));

  const preds = predictions.length ? predictions : FALLBACK_PREDS;

  return (
    <div>
      <div style={S.header}>
        <h1 style={S.pageTitle}>Intelligence Artificielle</h1>
        <span style={S.badge(C.purple)}>
          {embedded.status === "active" && cloud.status === "active" ? "TinyML + LSTM actifs" : "Modèles en vérification"}
        </span>
      </div>

      <div style={S.grid2}>
        <div style={S.card()}>
          <div style={S.cardTitle}>Modèle embarqué — Détection anomalies</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>
              Architecture : {embedded.name || "Autoencoder TinyML"}
            </div>
            <MiniGauge value={embedded.precision} max={100} color={C.green} label="Précision globale" unit="%" />
            <MiniGauge value={embedded.recall} max={100} color={C.green} label="Rappel" unit="%" />
            <MiniGauge value={embedded.f1_score} max={100} color={C.accent} label="F1-Score" unit="%" />
            <MiniGauge value={embedded.inference_latency_ms} max={300} color={C.purple} label="Latence d'inférence" unit="ms" />
            <MiniGauge value={embedded.memory_footprint_kb} max={256} color={C.orange} label="Empreinte mémoire" unit="Ko" />
          </div>
          <div style={S.divider} />
          <div style={S.row}>
            <span style={S.tag(embedded.status === "active" ? C.green : C.orange)}>
              {embedded.status === "active" ? "Actif" : "Dégradé"}
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              Échantillons 24h : {realtime.sample_count_24h ?? 0}
            </span>
          </div>
        </div>

        <div style={S.card()}>
          <div style={S.cardTitle}>Modèle cloud — Prévision LSTM</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>
              Architecture : {cloud.name || "LSTM Forecast"}
            </div>
            <MiniGauge value={cloud.mae_temp} max={4} color={C.green} label="MAE Température" unit="°C" />
            <MiniGauge value={cloud.mae_pressure} max={12} color={C.green} label="MAE Pression" unit="hPa" />
            <MiniGauge value={cloud.mae_humidity} max={14} color={C.accent} label="MAE Humidité" unit="%" />
            <MiniGauge value={cloud.extreme_event_accuracy} max={100} color={C.green} label="Précision alerte extrême" unit="%" />
          </div>
          <div style={S.divider} />
          <div style={S.row}>
            <span style={S.tag(cloud.status === "active" ? C.green : C.orange)}>
              {cloud.status === "active" ? "Actif" : "Dégradé"}
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              Politique : {cloud.retrain_policy || "weekly-auto"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div style={S.card({ marginBottom: 16 })}>
        <div style={S.cardTitle}>Score d'anomalie en temps réel (24h)</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={anomalyData}>
            <defs>
              <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.red} stopOpacity={0.4} />
                <stop offset="95%" stopColor={C.red} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="time" tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: C.textMuted, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Score" stroke={C.red} fill="url(#gScore)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Seuil" stroke={C.orange} strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
          <span style={{ color: C.orange }}>— — — </span> Seuil d'alerte : {threshold}%
          {" · "}
          Anomalies 24h : {realtime.anomaly_count_24h ?? 0}
          {" · "}
          Risque moyen : {((realtime.avg_risk_probability ?? 0) * 100).toFixed(0)}%
        </div>
      </div>

      <div style={S.card()}>
        <div style={S.cardTitle}>Prévisions météo — Modèle LSTM (horizons 3h, 6h, 12h, 24h)</div>
        <div style={S.grid4}>
          {preds.map((p) => (
            <div
              key={p.horizon_hours}
              style={{
                background: C.surface,
                borderRadius: 10,
                padding: 14,
                border: `1px solid ${p.extreme_event_probability > 0.35 ? C.orange : C.border}`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 10 }}>
                Dans {p.horizon_hours}h
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>Température</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.orange }}>{p.predicted_temp}°C</div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>Humidité</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.accent }}>{p.predicted_humidity}%</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>Pression</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.purple }}>{p.predicted_pressure} hPa</div>
              </div>
              <div style={S.divider} />
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Risque événement extrême</div>
              <div
                style={{
                  ...S.tag(
                    p.extreme_event_probability > 0.35
                      ? C.red
                      : p.extreme_event_probability > 0.2
                        ? C.orange
                        : C.green
                  ),
                  display: "inline-block",
                }}
              >
                {(p.extreme_event_probability * 100).toFixed(0)}%{" "}
                {p.event_type ? `— ${p.event_type}` : "— Normal"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const NodesPage = ({ nodes, latestByNode }) => (
  <div>
    <div style={S.header}>
      <h1 style={S.pageTitle}>Stations IoT</h1>
      <span style={S.badge(C.accent)}>{nodes.length} nœuds configurés</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      {nodes.map((node) => {
        const isOnline = node.status === "online";
        const lastSeen = new Date(node.last_seen * 1000);
        const ago = Math.floor((Date.now() - lastSeen) / 60000);
        const d = latestByNode[node.id];
        return (
          <div key={node.id} style={S.card({ borderColor: isOnline ? `${C.green}40` : C.border })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{node.name}</div>
              <span style={S.tag(isOnline ? C.green : C.red)}>{isOnline ? "En ligne" : "Hors ligne"}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>ID : {node.id}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Emplacement : {node.location}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Firmware : {node.firmware_version}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
              Coords : {node.latitude.toFixed(3)}, {node.longitude.toFixed(3)}
            </div>
            <div style={S.divider} />
            <div style={{ fontSize: 12, color: isOnline ? C.green : C.textMuted }}>
              {isOnline ? `Vu il y a ${Math.max(ago, 0)} min` : `Hors ligne depuis ${Math.floor(ago / 60)}h${ago % 60}m`}
            </div>
            {isOnline && d && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Temp", value: `${fmt(d.temperature)}°C`, color: C.orange },
                    { label: "Hum", value: `${fmt(d.humidity)}%`, color: C.accent },
                    { label: "Press", value: `${fmt(d.pressure)} hPa`, color: C.purple },
                    { label: "Vent", value: `${fmt(d.wind_speed)} m/s`, color: C.green },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: C.surface, borderRadius: 8, padding: "6px 10px" }}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const APIPage = () => {
  const [copied, setCopied] = useState(null);
  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const endpoints = [
    {
      method: "GET",
      path: "/api/health",
      desc: "Vérification de l'état du serveur",
      response: `{ "success": true, "status": "ok", "timestamp": "...", "version": "1.0.0" }`,
    },
    {
      method: "GET",
      path: "/api/nodes",
      desc: "Liste de tous les nœuds IoT",
      response: `{ "success": true, "data": [{ "id": "node-001", "name": "Station Alpha", "status": "online" }] }`,
    },
    {
      method: "GET",
      path: "/api/nodes/:id",
      desc: "Détails d'un nœud spécifique",
      response: `{ "success": true, "data": { "id": "node-001", "name": "...", "latest_data": { ... } } }`,
    },
    {
      method: "GET",
      path: "/api/sensor-data",
      desc: "Données capteurs filtrées (node_id, from, to, limit, interval)",
      response: `{ "success": true, "count": 100, "data": [{ "temperature": 29.3, "humidity": 68.1 }] }`,
    },
    {
      method: "GET",
      path: "/api/sensor-data/latest",
      desc: "Dernière mesure de chaque station active",
      response: `{ "success": true, "data": [{ "node_id": "node-001", "temperature": 30.1 }] }`,
    },
    {
      method: "GET",
      path: "/api/sensor-data/stats",
      desc: "Statistiques agrégées (period: 1h|6h|24h|7d|30d)",
      response: `{ "success": true, "period": "24h", "data": { "avg_temp": 28.4, "max_temp": 36.1 } }`,
    },
    {
      method: "POST",
      path: "/api/sensor-data",
      desc: "Ingestion manuelle d'une mesure",
      response: `{ "success": true, "data": { "id": "uuid", "timestamp": 1708000000 }, "alerts_created": 1 }`,
    },
    {
      method: "GET",
      path: "/api/alerts",
      desc: "Alertes filtrées (severity, acknowledged, node_id)",
      response: `{ "success": true, "count": 3, "data": [{ "type": "RAIN", "severity": "critical" }] }`,
    },
    {
      method: "PATCH",
      path: "/api/alerts/:id/acknowledge",
      desc: "Acquitter une alerte",
      response: `{ "success": true, "message": "Alert acknowledged" }`,
    },
    {
      method: "GET",
      path: "/api/anomalies",
      desc: "Mesures marquées comme anomalies IA",
      response: `{ "success": true, "count": 5, "data": [{ "anomaly_score": 0.87 }] }`,
    },
    {
      method: "GET",
      path: "/api/predictions",
      desc: "Prévisions IA LSTM (3h, 6h, 12h, 24h)",
      response: `{ "success": true, "data": [{ "horizon_hours": 6, "predicted_temp": 33.8 }] }`,
    },
    {
      method: "GET",
      path: "/api/ai/metrics",
      desc: "Métriques dynamiques des modèles IA (TinyML + LSTM)",
      response: `{ "success": true, "data": { "embedded_model": { "precision": 89.1 }, "cloud_model": { "mae_temp": 1.4 } } }`,
    },
    {
      method: "GET",
      path: "/api/dashboard/summary",
      desc: "Résumé global pour le dashboard",
      response: `{ "success": true, "data": { "nodes": { "total": 3, "online": 2 }, "alerts": { "active": 3 } } }`,
    },
    {
      method: "WS",
      path: "ws://localhost:3002",
      desc: "WebSocket temps réel — événements: sensor_data, alert",
      response: `{ "event": "sensor_data", "data": { "temperature": 29.1, "is_anomaly": 0 } }`,
    },
  ];

  const methodColor = { GET: C.green, POST: C.accent, PATCH: C.orange, DELETE: C.red, WS: C.purple };

  return (
    <div>
      <div style={S.header}>
        <h1 style={S.pageTitle}>Documentation API</h1>
        <span style={S.badge(C.accent)}>REST + WebSocket</span>
      </div>

      <div style={S.card({ marginBottom: 16 })}>
        <div style={S.cardTitle}>Base URL</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, borderRadius: 8, padding: "10px 14px" }}>
          <code style={{ color: C.green, fontSize: 14, flex: 1 }}>http://localhost:3002/api</code>
          <button onClick={() => copy("http://localhost:3002/api", "base")} style={S.btn(C.accent)}>
            {copied === "base" ? "✓ Copié" : "Copier"}
          </button>
        </div>
      </div>

      {endpoints.map((ep, i) => (
        <div key={i} style={S.card({ marginBottom: 10 })}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ ...S.tag(methodColor[ep.method] || C.textMuted), minWidth: 50, textAlign: "center" }}>{ep.method}</span>
            <code style={{ fontSize: 13, color: C.text, flex: 1 }}>{ep.path}</code>
            <button onClick={() => copy(ep.response, i)} style={S.btn(C.textMuted)}>
              {copied === i ? "✓" : "{ }"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{ep.desc}</div>
          <div style={{ background: C.surface, borderRadius: 6, padding: "8px 12px" }}>
            <code style={{ fontSize: 11, color: C.green, whiteSpace: "nowrap", overflow: "hidden", display: "block", textOverflow: "ellipsis" }}>
              {ep.response}
            </code>
          </div>
        </div>
      ))}
    </div>
  );
};

async function fetchApi(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Erreur API (${response.status})`);
  }
  return payload;
}

function groupByNode(dataRows) {
  const map = {};
  dataRows
    .slice()
    .reverse()
    .forEach((row) => {
      if (!map[row.node_id]) map[row.node_id] = [];
      map[row.node_id].push(row);
    });
  return map;
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [wsStatus, setWsStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [aiMetrics, setAiMetrics] = useState(null);
  const [historyByNode, setHistoryByNode] = useState({});
  const [latestByNode, setLatestByNode] = useState({});
  const [summary, setSummary] = useState({});
  const wsRef = useRef(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [nodesRes, sensorRes, latestRes, alertsRes, predsRes, summaryRes, aiRes] = await Promise.all([
        fetchApi("/nodes"),
        fetchApi("/sensor-data?limit=1500"),
        fetchApi("/sensor-data/latest"),
        fetchApi("/alerts?limit=100"),
        fetchApi("/predictions"),
        fetchApi("/dashboard/summary"),
        fetchApi("/ai/metrics"),
      ]);

      const grouped = groupByNode(sensorRes.data || []);
      const latestMap = {};
      (latestRes.data || []).forEach((row) => {
        latestMap[row.node_id] = row;
      });

      setNodes(nodesRes.data || []);
      setHistoryByNode(grouped);
      setLatestByNode(latestMap);
      setAlerts(alertsRes.data || []);
      setPredictions(predsRes.data || []);
      setSummary(summaryRes.data || {});
      setAiMetrics(aiRes.data || null);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    const id = setInterval(loadInitialData, 60_000);
    return () => clearInterval(id);
  }, [loadInitialData]);

  useEffect(() => {
    let reconnectTimeout = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setWsStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("connected");
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === "sensor_data" && msg.data?.node_id) {
          const data = msg.data;
          setLatestByNode((prev) => ({ ...prev, [data.node_id]: data }));
          setHistoryByNode((prev) => {
            const next = prev[data.node_id] ? [...prev[data.node_id], data] : [data];
            return { ...prev, [data.node_id]: next.slice(-500) };
          });
          setSummary((prev) => ({
            ...prev,
            readings: { ...(prev.readings || {}), total: (prev.readings?.total || 0) + 1 },
          }));
        }

        if (msg.event === "alert" && msg.data?.id) {
          setAlerts((prev) => [msg.data, ...prev]);
          setSummary((prev) => ({
            ...prev,
            alerts: {
              ...(prev.alerts || {}),
              total: (prev.alerts?.total || 0) + 1,
              active: (prev.alerts?.active || 0) + 1,
            },
          }));
        }

        if (msg.event === "alert_acknowledged" && msg.data?.id) {
          setAlerts((prev) =>
            prev.map((a) => (a.id === msg.data.id ? { ...a, acknowledged: 1 } : a))
          );
          setSummary((prev) => ({
            ...prev,
            alerts: {
              ...(prev.alerts || {}),
              active: Math.max((prev.alerts?.active || 0) - 1, 0),
            },
          }));
        }

        if (msg.event === "predictions" && Array.isArray(msg.data)) {
          setPredictions(msg.data);
        }
      };

      ws.onerror = () => {
        setWsStatus("simulation");
      };

      ws.onclose = () => {
        if (stopped) return;
        setWsStatus("simulation");
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, []);



  const acknowledgeAlert = useCallback(async (id) => {
    try {
      await fetchApi(`/alerts/${id}/acknowledge`, { method: "PATCH" });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: 1 } : a)));
      setSummary((prev) => ({
        ...prev,
        alerts: {
          ...(prev.alerts || {}),
          active: Math.max((prev.alerts?.active || 0) - 1, 0),
        },
      }));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const historyMain = historyByNode["node-001"] || [];
  const liveData = latestByNode["node-001"] || historyMain[historyMain.length - 1] || null;
  const activeAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  const navItems = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "sensors", icon: "sensors", label: "Capteurs" },
    { id: "alerts", icon: "alerts", label: "Alertes" },
    { id: "ai", icon: "ai", label: "IA / ML" },
    { id: "nodes", icon: "nodes", label: "Stations" },
    { id: "api", icon: "api", label: "API Docs" },
  ];

  const pages = {
    dashboard: (
      <DashboardPage
        liveData={liveData}
        history={historyMain}
        alerts={alerts}
        summary={summary}
      />
    ),
    sensors: <SensorsPage nodes={nodes} historyByNode={historyByNode} latestByNode={latestByNode} />,
    alerts: <AlertsPage alerts={alerts} onAcknowledge={acknowledgeAlert} />,
    ai: <AIPage history={historyMain} predictions={predictions} aiMetrics={aiMetrics} />,
    nodes: <NodesPage nodes={nodes} latestByNode={latestByNode} />,
    api: <APIPage />,
  };

  if (isLoading) {
    return (
      <div
        style={{
          background: C.bg,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Space Grotesk', monospace",
          color: C.text,
          gap: 20,
        }}
      >
        <div style={{ fontSize: 32 }}>⛅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>MeteoIoT-IA</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>Connexion à la base de données…</div>
        <div
          style={{
            width: 40,
            height: 40,
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.accent}`,
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }}
        />
        {error && (
          <div
            style={{
              marginTop: 12,
              background: `${C.red}22`,
              border: `1px solid ${C.red}66`,
              color: C.red,
              fontSize: 12,
              padding: "8px 16px",
              borderRadius: 8,
            }}
          >
            Erreur : {error}
          </div>
        )}
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <div style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoTitle}>⛅ MeteoIoT-IA</div>
          <div style={S.logoSub}>PLATEFORME DE SURVEILLANCE</div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background:
                  wsStatus === "connected"
                    ? C.green
                    : wsStatus === "simulation"
                      ? C.yellow
                      : C.orange,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 10, color: C.textMuted }}>
              {wsStatus === "connected"
                ? "WebSocket actif"
                : wsStatus === "simulation"
                  ? "Mode simulation"
                  : "Connexion..."}
            </span>
          </div>
        </div>

        <nav style={S.nav}>
          <div style={{ fontSize: 10, color: C.textDim, padding: "0 20px 8px", letterSpacing: "0.1em" }}>
            NAVIGATION
          </div>
          {navItems.map((item) => (
            <div key={item.id} style={S.navItem(page === item.id)} onClick={() => setPage(item.id)}>
              <Icon name={item.icon} size={16} color={page === item.id ? C.accent : C.textMuted} />
              {item.label}
              {item.id === "alerts" && activeAlertsCount > 0 && (
                <span style={{ marginLeft: "auto", ...S.tag(C.red), fontSize: 10 }}>
                  {activeAlertsCount}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textDim }}>MeteoIoT Platform</div>
          <div style={{ fontSize: 10, color: C.textDim }}>v1.0.0 — ESP32 + TinyML</div>
        </div>
      </div>

      <main style={S.main}>
        {error && (
          <div
            style={{
              marginBottom: 12,
              background: `${C.red}22`,
              border: `1px solid ${C.red}66`,
              color: C.red,
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 8,
            }}
          >
            Erreur API: {error}
          </div>
        )}
        {pages[page]}
      </main>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 6px; background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        button { cursor: pointer; border: none; font-family: inherit; }
      `}</style>
    </div>
  );
}
