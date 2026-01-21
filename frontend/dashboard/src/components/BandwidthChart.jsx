/**
 * Bandwidth Chart Component
 * =========================
 * Compare bandwidth usage: Baseline vs H2A.
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowDownUp, TrendingDown } from 'lucide-react';

export default function BandwidthChart({ data, loading = false }) {
  // Generate comparison data
  const chartData = generateComparisonData(data);
  
  const bandwidthSaved = data?.efficiency?.bandwidthSavedKB || 0;
  const reductionPercent = data?.efficiency?.bandwidthReductionPercent || 0;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ArrowDownUp className="w-5 h-5 text-pqc-accent" />
          Bandwidth Comparison
        </h3>
        {parseFloat(reductionPercent) > 0 && (
          <div className="flex items-center gap-1 text-green-400 text-sm">
            <TrendingDown className="w-4 h-4" />
            {reductionPercent}% reduction
          </div>
        )}
      </div>
      <div className="card-body">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-pqc-accent border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="h2aGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} unit=" KB" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="Baseline (KB)" 
                stroke="#ef4444" 
                fill="url(#baselineGradient)" 
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="H2A (KB)" 
                stroke="#10b981" 
                fill="url(#h2aGradient)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {data?.modeComparison?.baseline?.bytes 
                ? (data.modeComparison.baseline.bytes / 1024).toFixed(1) 
                : '0'} KB
            </div>
            <div className="text-xs text-gray-400">Baseline Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {data?.modeComparison?.h2a?.bytes 
                ? (data.modeComparison.h2a.bytes / 1024).toFixed(1) 
                : '0'} KB
            </div>
            <div className="text-xs text-gray-400">H2A Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pqc-accent">
              {bandwidthSaved} KB
            </div>
            <div className="text-xs text-gray-400">Saved</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateComparisonData(data) {
  if (!data) {
    return [
      { name: 'Start', 'Baseline (KB)': 0, 'H2A (KB)': 0 },
      { name: 'Current', 'Baseline (KB)': 0, 'H2A (KB)': 0 },
    ];
  }

  const baseline = data.modeComparison?.baseline || {};
  const h2a = data.modeComparison?.h2a || {};

  return [
    { name: 'Start', 'Baseline (KB)': 0, 'H2A (KB)': 0 },
    { 
      name: 'Current', 
      'Baseline (KB)': ((baseline.bytes || 0) / 1024).toFixed(2),
      'H2A (KB)': ((h2a.bytes || 0) / 1024).toFixed(2),
    },
  ];
}
