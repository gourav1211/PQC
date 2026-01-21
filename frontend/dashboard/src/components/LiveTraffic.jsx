/**
 * Live Traffic Component
 * ======================
 * Real-time packet visualization.
 */

import { useState, useEffect, useRef } from 'react';
import { Activity, ArrowRight, Package, Shield } from 'lucide-react';

const MAX_PACKETS = 10;

export default function LiveTraffic({ wsData, mode = 'h2a' }) {
  const [packets, setPackets] = useState([]);
  const containerRef = useRef(null);

  // Add new packets from WebSocket
  useEffect(() => {
    if (wsData?.type === 'telemetry' || wsData?.type === 'batch') {
      const newPacket = {
        id: Date.now(),
        type: wsData.type,
        deviceId: wsData.deviceId || 'Gateway',
        size: wsData.size || wsData.batchSize || 0,
        timestamp: new Date(),
        verified: wsData.verified !== false,
      };

      setPackets((prev) => {
        const updated = [newPacket, ...prev];
        return updated.slice(0, MAX_PACKETS);
      });
    }
  }, [wsData]);

  // Auto-scroll to show newest
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [packets]);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          Live Traffic
        </h3>
        <span className={`live-indicator ${packets.length > 0 ? 'active' : ''}`}>
          LIVE
        </span>
      </div>
      <div className="card-body">
        {packets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Waiting for traffic...</p>
            <p className="text-xs mt-1">Packets will appear here in real-time</p>
          </div>
        ) : (
          <div ref={containerRef} className="space-y-2 max-h-80 overflow-y-auto">
            {packets.map((packet, index) => (
              <PacketRow 
                key={packet.id} 
                packet={packet} 
                isNew={index === 0}
                mode={mode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PacketRow({ packet, isNew, mode }) {
  const isBatch = packet.type === 'batch';
  
  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg transition-all duration-300
        ${isNew ? 'bg-pqc-primary/20 border border-pqc-primary/30 animate-fadeIn' : 'bg-gray-700/30'}
      `}
    >
      {/* Packet type icon */}
      <div className={`
        p-2 rounded-lg
        ${isBatch ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}
      `}>
        {isBatch ? <Package className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
      </div>

      {/* Packet info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{packet.deviceId}</span>
          <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-400">Gateway</span>
        </div>
        <div className="text-xs text-gray-500">
          {isBatch ? 'Aggregated Batch' : 'Telemetry'} • {packet.size} bytes
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`
          px-2 py-1 rounded text-xs font-medium
          ${packet.verified ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
        `}>
          {packet.verified ? '✓ Verified' : '✗ Failed'}
        </span>
        <span className="text-xs text-gray-500">
          {formatTime(packet.timestamp)}
        </span>
      </div>
    </div>
  );
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
