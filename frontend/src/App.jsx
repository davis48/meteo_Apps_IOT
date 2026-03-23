import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar      from './components/Layout/Sidebar';
import Header       from './components/Layout/Header';
import DashboardPage    from './pages/DashboardPage';
import LiveWeatherPage  from './pages/LiveWeatherPage';
import ForecastPage     from './pages/ForecastPage';
import AlertsPage       from './pages/AlertsPage';
import AirQualityPage   from './pages/AirQualityPage';
import HistoryPage      from './pages/HistoryPage';
import StationsPage     from './pages/StationsPage';
import MapPage          from './pages/MapPage';
import RegionsPage      from './pages/RegionsPage';
import ComparisonPage   from './pages/ComparisonPage';
import { fetchApi, groupByNode } from './utils/helpers';

// Apply saved theme before first paint
const savedTheme = localStorage.getItem('atmosiq-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (() => {
    const loc   = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${loc.host}/ws`;
  })();

export default function App() {
  const [page,          setPage]          = useState('dashboard');
  const [wsStatus,      setWsStatus]      = useState('connecting');
  const [error,         setError]         = useState('');
  const [isLoading,     setIsLoading]     = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [theme,         setTheme]         = useState(savedTheme);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [regionFilter,  setRegionFilter]  = useState(null);  // filtre global par région

  // Data
  const [nodes,         setNodes]         = useState([]);
  const [alerts,        setAlerts]        = useState([]);
  const [predictions,   setPredictions]   = useState([]);
  const [aiMetrics,     setAiMetrics]     = useState(null);
  const [historyByNode, setHistoryByNode] = useState({});
  const [latestByNode,  setLatestByNode]  = useState({});
  const [summary,       setSummary]       = useState({});

  const wsRef = useRef(null);

  // ── Theme toggle ─────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('atmosiq-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  // ── Data loading ──────────────────────────────────────────
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [nodesRes, sensorRes, latestRes, alertsRes, predsRes, summaryRes, aiRes] =
        await Promise.allSettled([
          fetchApi('/nodes'),
          fetchApi('/sensor-data?limit=2000'),
          fetchApi('/sensor-data/latest'),
          fetchApi('/alerts?limit=200'),
          fetchApi('/predictions'),
          fetchApi('/dashboard/summary'),
          fetchApi('/ai/metrics'),
        ]);

      if (nodesRes.status === 'fulfilled')
        setNodes(nodesRes.value.data || []);

      if (sensorRes.status === 'fulfilled') {
        const rows = sensorRes.value.data || [];
        setHistoryByNode(groupByNode(rows));
      }

      if (latestRes.status === 'fulfilled') {
        const rows = latestRes.value.data || [];
        const lmap = {};
        rows.forEach((r) => { lmap[r.node_id] = r; });
        setLatestByNode(lmap);
      }

      if (alertsRes.status === 'fulfilled')
        setAlerts(alertsRes.value.data || []);

      if (predsRes.status === 'fulfilled')
        setPredictions(predsRes.value.data || []);

      if (summaryRes.status === 'fulfilled')
        setSummary(summaryRes.value.data || {});

      if (aiRes.status === 'fulfilled')
        setAiMetrics(aiRes.value.data || null);

      setError('');
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
    const id = setInterval(() => loadAllData(true), 60_000);
    return () => clearInterval(id);
  }, [loadAllData]);

  // ── WebSocket ─────────────────────────────────────────────
  useEffect(() => {
    let reconnectTimeout = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setWsStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        ws.send(JSON.stringify({ action: 'subscribe', topics: ['*'] }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.event === 'sensor_data' && msg.data?.node_id) {
            const d = msg.data;
            setLatestByNode((prev) => ({ ...prev, [d.node_id]: d }));
            setHistoryByNode((prev) => {
              const arr = prev[d.node_id] ? [...prev[d.node_id], d] : [d];
              return { ...prev, [d.node_id]: arr.slice(-500) };
            });
          }

          if (msg.event === 'alert' && msg.data?.id) {
            setAlerts((prev) => {
              if (prev.some((a) => a.id === msg.data.id)) return prev;
              return [msg.data, ...prev];
            });
          }

          if (msg.event === 'alert_acknowledged' && msg.data?.id) {
            setAlerts((prev) =>
              prev.map((a) => (a.id === msg.data.id ? { ...a, acknowledged: 1 } : a))
            );
          }

          if (msg.event === 'alert_deleted' && msg.data?.id) {
            setAlerts((prev) => prev.filter((a) => a.id !== msg.data.id));
          }

          if (msg.event === 'predictions' && Array.isArray(msg.data)) {
            setPredictions(msg.data);
          }

          if (msg.event === 'node_updated' && msg.data?.id) {
            setNodes((prev) => prev.map((n) => (n.id === msg.data.id ? { ...n, ...msg.data } : n)));
          }

          if (msg.event === 'node_deleted' && msg.data?.id) {
            setNodes((prev) => prev.filter((n) => n.id !== msg.data.id));
          }

          if (msg.event === 'node_registered' && msg.data?.id) {
            setNodes((prev) => {
              if (prev.some((n) => n.id === msg.data.id)) return prev;
              return [...prev, msg.data];
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => setWsStatus('disconnected');

      ws.onclose = () => {
        if (stopped) return;
        setWsStatus('disconnected');
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

  // ── Actions ───────────────────────────────────────────────
  const acknowledgeAlert = useCallback(async (id) => {
    try {
      await fetchApi(`/alerts/${id}/acknowledge`, { method: 'PATCH' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: 1 } : a)));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const deleteAlert = useCallback(async (id) => {
    try {
      await fetchApi(`/alerts/${id}`, { method: 'DELETE' });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────
  const allHistory     = Object.values(historyByNode).flat();

  // Régions disponibles (liste unique triée)
  const regions = [...new Set(nodes.map((n) => n.region).filter(Boolean))].sort();

  // Nodes filtrés par la région sélectionnée
  const filteredNodes = regionFilter
    ? nodes.filter((n) => n.region === regionFilter)
    : nodes;

  // Historique filtré selon les nodes de la région
  const filteredIds = regionFilter ? new Set(filteredNodes.map((n) => n.id)) : null;
  const displayHistory = filteredIds
    ? allHistory.filter((r) => filteredIds.has(r.node_id))
    : allHistory;

  // Station principale et live data (respect du filtre régional)
  const primaryNodeId  = filteredNodes.find((n) => n.status === 'online')?.id || filteredNodes[0]?.id;
  const liveData       = primaryNodeId ? latestByNode[primaryNodeId] : null;
  const activeAlertCount = alerts.filter((a) => !a.acknowledged).length;

  // ── Loading screen ────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-page)', gap: 16,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(59,130,246,.4)',
        }}>
          <img src="/logo.png" alt="YATANAN Logo" width={100} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.3px' }}>
          YATANAN
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement de la plateforme…</div>
        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        {error && (
          <div style={{
            marginTop: 8, background: 'rgba(239,68,68,.12)',
            border: '1px solid rgba(239,68,68,.3)', color: 'var(--risk-high)',
            fontSize: 12, padding: '8px 18px', borderRadius: 10,
            maxWidth: 380, textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Page renderer ─────────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return (
          <DashboardPage
            liveData={liveData}
            history={displayHistory}
            alerts={alerts}
            summary={summary}
            nodes={filteredNodes}
            onNav={setPage}
          />
        );
      case 'live':
        return (
          <LiveWeatherPage
            nodes={filteredNodes}
            historyByNode={historyByNode}
            latestByNode={latestByNode}
            predictions={predictions}
          />
        );
      case 'forecast':
        return (
          <ForecastPage
            predictions={predictions}
            aiMetrics={aiMetrics}
            history={displayHistory}
            nodes={filteredNodes}
          />
        );
      case 'alerts':
        return (
          <AlertsPage
            alerts={alerts}
            nodes={filteredNodes}
            onAcknowledge={acknowledgeAlert}
            onDelete={deleteAlert}
            latestByNode={latestByNode}
            onNav={setPage}
          />
        );
      case 'air-quality':
        return (
          <AirQualityPage
            nodes={filteredNodes}
            historyByNode={historyByNode}
            latestByNode={latestByNode}
          />
        );
      case 'history':
        return (
          <HistoryPage
            nodes={filteredNodes}
            historyByNode={historyByNode}
            latestByNode={latestByNode}
          />
        );
      case 'map':
        return (
          <MapPage
            nodes={nodes}
            latestByNode={latestByNode}
            historyByNode={historyByNode}
            onNav={setPage}
          />
        );
      case 'regions':
        return (
          <RegionsPage
            nodes={nodes}
            latestByNode={latestByNode}
            regionFilter={regionFilter}
            onRegionChange={setRegionFilter}
          />
        );
      case 'comparison':
        return (
          <ComparisonPage
            nodes={filteredNodes}
            historyByNode={historyByNode}
            latestByNode={latestByNode}
          />
        );
      case 'stations':
        return (
          <StationsPage
            nodes={nodes}
            latestByNode={latestByNode}
            onNodeChange={() => loadAllData()}
          />
        );
      default:
        return null;
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNav={setPage}
        wsStatus={wsStatus}
        alertCount={activeAlertCount}
      />

      <div className="main-container">
        <Header
          page={page}
          onRefresh={() => loadAllData()}
          isRefreshing={isRefreshing}
          theme={theme}
          onThemeToggle={toggleTheme}
          lastUpdated={lastUpdated}
          regions={regions}
          regionFilter={regionFilter}
          onRegionChange={setRegionFilter}
        />

        <main className="page-content">
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
              color: 'var(--risk-high)', fontSize: 12, padding: '8px 14px',
              borderRadius: 10, marginBottom: 16,
            }}>
              <span>⚠</span>
              <span>Erreur API : {error}</span>
              <button
                onClick={() => setError('')}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--risk-high)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>
          )}
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
