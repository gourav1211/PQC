/**
 * Metrics Summary Component
 * =========================
 * Top-level metrics cards.
 */

import { Activity, Shield, Package, Clock, TrendingUp, TrendingDown } from 'lucide-react';

export default function MetricsSummary({ throughput, bandwidth, verification, loading = false }) {
  // Extract values from correct backend data structures
  // throughput: { counters: { messagesReceived }, throughput: { messagesPerSecond }, latency: { avg, ... } }
  // verification: { counters: { totalVerifications }, rate: { verificationsPerSecond } }
  const totalVerifications = verification?.counters?.totalVerifications || 
                             throughput?.counters?.messagesReceived || 0;
  const verificationsPerSec = parseFloat(verification?.rate?.verificationsPerSecond) || 
                              parseFloat(throughput?.throughput?.messagesPerSecond) || 0;
  const avgLatency = throughput?.latency?.avg || 0;
  const bandwidthSaved = bandwidth?.efficiency?.bandwidthReductionPercent || 0;

  const metrics = [
    {
      id: 'verifications',
      label: 'Total Verifications',
      value: totalVerifications,
      icon: Shield,
      color: 'text-pqc-primary',
      bgColor: 'bg-pqc-primary/10',
      trend: calculateTrend(verificationsPerSec),
    },
    {
      id: 'throughput',
      label: 'Throughput',
      value: `${verificationsPerSec.toFixed(1)}/s`,
      icon: Activity,
      color: 'text-pqc-accent',
      bgColor: 'bg-pqc-accent/10',
    },
    {
      id: 'bandwidth',
      label: 'Bandwidth Saved',
      value: `${bandwidthSaved}%`,
      icon: TrendingDown,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      highlight: true,
    },
    {
      id: 'avgLatency',
      label: 'Avg Latency',
      value: `${avgLatency}ms`,
      icon: Clock,
      color: 'text-pqc-warning',
      bgColor: 'bg-pqc-warning/10',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} {...metric} />
      ))}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, bgColor, trend, highlight }) {
  return (
    <div className={`metric-card ${highlight ? 'border border-green-500/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>
          {value}
        </span>
        {trend !== undefined && (
          <TrendIndicator value={trend} />
        )}
      </div>
    </div>
  );
}

function TrendIndicator({ value }) {
  if (value === 0) return null;
  
  const isUp = value > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const color = isUp ? 'text-green-400' : 'text-red-400';
  
  return (
    <div className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      <span>{Math.abs(value).toFixed(1)}</span>
    </div>
  );
}

function calculateTrend(ratePerSecond) {
  // This would compare with previous values in a real implementation
  return ratePerSecond || 0;
}
