/**
 * Device List Component
 * =====================
 * Display registered devices with status.
 */

import { Activity, Cpu, Wifi, WifiOff } from 'lucide-react';

export default function DeviceList({ devices = [], loading = false }) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Cpu className="w-5 h-5 text-pqc-accent" />
            Connected Devices
          </h3>
        </div>
        <div className="card-body">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-700/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Cpu className="w-5 h-5 text-pqc-accent" />
          Connected Devices
        </h3>
        <span className="text-sm text-gray-400">{devices.length} devices</span>
      </div>
      <div className="card-body max-h-80 overflow-y-auto">
        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <WifiOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No devices connected</p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <DeviceRow key={device.deviceId} device={device} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceRow({ device }) {
  const isActive = device.status === 'active';
  const tierClass = `tier-${device.tier?.replace('tier', '')}`;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`status-dot ${isActive ? 'status-active' : 'status-inactive'}`}></div>
        <div>
          <div className="font-medium text-sm">{device.deviceId}</div>
          <div className="text-xs text-gray-400">
            Last seen: {formatLastSeen(device.lastSeen)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`tier-badge ${tierClass}`}>
          {device.tier?.toUpperCase()}
        </span>
        {isActive && (
          <Activity className="w-4 h-4 text-green-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}

function formatLastSeen(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString();
}
