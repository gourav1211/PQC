/**
 * Latency Chart Component
 * =======================
 * Bar chart comparing cryptographic latency across tiers.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock } from 'lucide-react';

export default function LatencyChart({ data, loading = false }) {
  const chartData = data ? [
    {
      name: 'Signature',
      'Avg (ms)': parseFloat(data.latency?.avg) || 0,
      'P95 (ms)': parseFloat(data.latency?.p95) || 0,
      'P99 (ms)': parseFloat(data.latency?.p99) || 0,
    },
  ] : [];

  // Add algorithm breakdown if available
  if (data?.byAlgorithm) {
    Object.entries(data.byAlgorithm).forEach(([alg, stats]) => {
      chartData.push({
        name: alg.replace('dilithium', 'Dil').replace('kyber', 'Kyb'),
        'Avg (ms)': parseFloat(stats.avgTimeMs) || 0,
      });
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-pqc-warning" />
          Verification Latency
        </h3>
      </div>
      <div className="card-body">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-pqc-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} unit="ms" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="Avg (ms)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="P95 (ms)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="P99 (ms)" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        
        {/* Stats summary */}
        {data?.latency && (
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700/50">
            <StatItem label="Min" value={`${data.latency.min}ms`} />
            <StatItem label="Avg" value={`${data.latency.avg}ms`} />
            <StatItem label="P95" value={`${data.latency.p95}ms`} />
            <StatItem label="Max" value={`${data.latency.max}ms`} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
