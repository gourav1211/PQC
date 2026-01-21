/**
 * Settings Page
 * =============
 * Configuration settings for H2A-PQC dashboard.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw, Shield, Server, Cpu, Bell } from 'lucide-react';
import { api } from '../services/api';

export default function Settings() {
  const [settings, setSettings] = useState({
    gatewayUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:4000',
    refreshInterval: 10,
    showNotifications: true,
    darkMode: true,
    autoReconnect: true,
  });
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState(null);

  // Check gateway health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.healthCheck();
        setHealth(res.data);
      } catch (err) {
        setHealth({ status: 'error', message: err.message });
      }
    };
    checkHealth();
  }, []);

  const handleSave = () => {
    localStorage.setItem('h2a-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaults = {
      gatewayUrl: 'http://localhost:4000',
      wsUrl: 'ws://localhost:4000',
      refreshInterval: 10,
      showNotifications: true,
      darkMode: true,
      autoReconnect: true,
    };
    setSettings(defaults);
    localStorage.removeItem('h2a-settings');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-sm text-gray-400">Configure dashboard preferences</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Gateway Status */}
        <section className="card mb-6">
          <div className="card-header">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Server className="w-5 h-5 text-pqc-primary" />
              Gateway Status
            </h2>
          </div>
          <div className="card-body">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Connection Status</span>
              <span className={`px-3 py-1 rounded-full text-sm ${
                health?.status === 'healthy' || health?.status === 'ok'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {health?.status || 'Unknown'}
              </span>
            </div>
            {health?.version && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-400">Version</span>
                <span className="text-white">{health.version}</span>
              </div>
            )}
            {health?.uptime && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-400">Uptime</span>
                <span className="text-white">{Math.floor(health.uptime)}s</span>
              </div>
            )}
          </div>
        </section>

        {/* Connection Settings */}
        <section className="card mb-6">
          <div className="card-header">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Cpu className="w-5 h-5 text-pqc-accent" />
              Connection
            </h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Gateway URL</label>
              <input
                type="text"
                value={settings.gatewayUrl}
                onChange={(e) => setSettings({ ...settings, gatewayUrl: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-pqc-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">WebSocket URL</label>
              <input
                type="text"
                value={settings.wsUrl}
                onChange={(e) => setSettings({ ...settings, wsUrl: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-pqc-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Refresh Interval (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.refreshInterval}
                onChange={(e) => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-pqc-primary"
              />
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="card mb-6">
          <div className="card-header">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-pqc-warning" />
              Preferences
            </h2>
          </div>
          <div className="card-body space-y-4">
            <ToggleSetting
              label="Show Notifications"
              description="Display alerts for important events"
              checked={settings.showNotifications}
              onChange={(v) => setSettings({ ...settings, showNotifications: v })}
            />
            <ToggleSetting
              label="Auto Reconnect"
              description="Automatically reconnect on connection loss"
              checked={settings.autoReconnect}
              onChange={(v) => setSettings({ ...settings, autoReconnect: v })}
            />
            <ToggleSetting
              label="Dark Mode"
              description="Use dark theme for dashboard"
              checked={settings.darkMode}
              onChange={(v) => setSettings({ ...settings, darkMode: v })}
            />
          </div>
        </section>

        {/* PQC Info */}
        <section className="card mb-6">
          <div className="card-header">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              PQC Algorithms
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <h3 className="font-semibold text-pqc-primary">Dilithium (ML-DSA)</h3>
                <p className="text-sm text-gray-400 mt-1">Digital signatures</p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Level 3 (128-bit security)</li>
                  <li>• NIST standardized</li>
                  <li>• Lattice-based</li>
                </ul>
              </div>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <h3 className="font-semibold text-pqc-accent">Kyber (ML-KEM)</h3>
                <p className="text-sm text-gray-400 mt-1">Key encapsulation</p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Level 3 (128-bit security)</li>
                  <li>• NIST standardized</li>
                  <li>• Lattice-based</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-pqc-primary hover:bg-pqc-primary/80 text-white'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </main>
    </div>
  );
}

function ToggleSetting({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-pqc-primary' : 'bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'left-7' : 'left-1'
          }`}
        ></span>
      </button>
    </div>
  );
}
