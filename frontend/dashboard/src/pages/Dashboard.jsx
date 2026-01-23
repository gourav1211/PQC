/**
 * H2A-PQC Dashboard
 * =================
 * Main dashboard page for monitoring H2A-PQC metrics.
 */

import { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, Activity, Shield, Moon, Sun } from 'lucide-react';
import {
  ModeToggle,
  DeviceList,
  LatencyChart,
  BandwidthChart,
  AggregationStats,
  EnergyEstimation,
  LiveTraffic,
  MetricsSummary,
} from '../components';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Dashboard() {
  // State
  const [mode, setMode] = useState('h2a');
  const [devices, setDevices] = useState([]);
  const [throughputData, setThroughputData] = useState(null);
  const [bandwidthData, setBandwidthData] = useState(null);
  const [aggregationData, setAggregationData] = useState(null);
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [darkMode, setDarkMode] = useState(true);

  // WebSocket connection
  const { 
    isConnected, 
    metrics: wsMetrics, 
    lastMessage 
  } = useWebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:4000');

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        modeRes,
        devicesRes,
        throughputRes,
        bandwidthRes,
        aggregationRes,
        verificationRes,
      ] = await Promise.all([
        api.getCurrentMode(),
        api.getDevices(),
        api.getThroughputMetrics(),
        api.getBandwidthMetrics(),
        api.getAggregationMetrics(),
        api.getVerificationMetrics(),
      ]);

      setMode(modeRes?.mode || modeRes?.data?.mode || 'h2a');
      setDevices(devicesRes?.devices || devicesRes?.data || []);
      setThroughputData(throughputRes?.data || throughputRes);
      setBandwidthData(bandwidthRes?.data || bandwidthRes);
      setAggregationData(aggregationRes?.data || aggregationRes);
      setVerificationData(verificationRes?.data || verificationRes);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to fetch dashboard data. Is the gateway running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update from WebSocket metrics
  useEffect(() => {
    if (wsMetrics) {
      if (wsMetrics.throughput) setThroughputData(wsMetrics.throughput);
      if (wsMetrics.bandwidth) setBandwidthData(wsMetrics.bandwidth);
      if (wsMetrics.aggregation) setAggregationData(wsMetrics.aggregation);
      if (wsMetrics.verification) setVerificationData(wsMetrics.verification);
    }
  }, [wsMetrics]);

  // Handle mode change
  const handleModeChange = async (newMode) => {
    try {
      await api.setMode(newMode);
      setMode(newMode);
      // Refresh data after mode change
      setTimeout(fetchData, 500);
    } catch (err) {
      console.error('Failed to change mode:', err);
      setError('Failed to change mode. Please try again.');
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Logo and title */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-8 h-8 text-pqc-primary" />
                  <div>
                    <h1 className="text-xl font-bold">H2A-PQC Dashboard</h1>
                    <p className="text-xs text-gray-400">
                      Hybrid Hierarchical Aggregated Post-Quantum Cryptography
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4">
                {/* Connection status */}
                <div className="flex items-center gap-2">
                  <span className={`live-indicator ${isConnected ? 'active' : ''}`}>
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>

                {/* Mode toggle */}
                <ModeToggle
                  currentMode={mode}
                  onModeChange={handleModeChange}
                  disabled={loading}
                />

                {/* Refresh button */}
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {/* Theme toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                  title="Toggle theme"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Settings */}
                <a
                  href="/settings"
                  className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="container mx-auto px-4 py-6">
          {/* Error banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-sm underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Mode indicator */}
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-gray-800 to-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-400">Current Mode:</span>
                <span className={`ml-2 text-lg font-bold ${mode === 'h2a' ? 'text-green-400' : 'text-orange-400'}`}>
                  {mode === 'h2a' ? 'H2A (Aggregation Enabled)' : 'Baseline (No Aggregation)'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="mb-6">
            <MetricsSummary
              throughput={throughputData}
              bandwidth={bandwidthData}
              verification={verificationData}
              loading={loading}
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Charts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bandwidth comparison */}
              <BandwidthChart data={bandwidthData} loading={loading} />

              {/* Latency chart */}
              <LatencyChart data={throughputData} loading={loading} />

              {/* Energy estimation */}
              <EnergyEstimation
                throughputData={throughputData}
                bandwidthData={bandwidthData}
                loading={loading}
              />
            </div>

            {/* Right column - Status */}
            <div className="space-y-6">
              {/* Live traffic */}
              <LiveTraffic wsData={lastMessage} mode={mode} />

              {/* Device list */}
              <DeviceList devices={devices} loading={loading} />

              {/* Aggregation stats (only in H2A mode) */}
              {mode === 'h2a' && (
                <AggregationStats data={aggregationData} loading={loading} />
              )}
            </div>
          </div>

          {/* Footer info */}
          <footer className="mt-8 pt-6 border-t border-gray-700/50 text-center text-sm text-gray-500">
            <p>
              H2A-PQC Research Implementation • Post-Quantum Cryptography with LLAS Aggregation
            </p>
            <p className="mt-1">
              Using Dilithium (ML-DSA) for signatures • Kyber (ML-KEM) for key encapsulation
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
