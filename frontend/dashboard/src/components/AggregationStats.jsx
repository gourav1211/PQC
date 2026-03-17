/**
 * Aggregation Stats Component
 * ===========================
 * Real-time LLAS aggregation metrics.
 */

import { Layers, Package, GitMerge, Zap } from 'lucide-react';

export default function AggregationStats({ data, loading = false }) {
  const stats = data || {};
  
  // Map backend data structure to component expectations
  // Backend returns: { efficiency: { totalBatchesCreated, totalLogsProcessed, ... }, batchDistribution: {...}, ... }
  // Or from LLAS: { aggregatedBatches, totalLogs, avgBatchSize, merkleRoots, ... }
  const batches = Number(stats.efficiency?.totalBatchesCreated) || 
                  Number(stats.aggregatedBatches) || 
                  Number(stats.batchCount) || 0;
  const messagesAggregated = Number(stats.efficiency?.totalLogsProcessed) || 
                              Number(stats.totalLogs) || 
                              Number(stats.messagesAggregated) || 0;
  const avgBatchSize = Number(stats.efficiency?.avgLogsPerBatch) || 
                       Number(stats.avgBatchSize) || 0;
  const merkleTreeDepth = Number(stats.batchDistribution?.avg) || 
                          Number(stats.merkleRoots) || 
                          Number(stats.avgMerkleTreeDepth) || 0;

  // Store normalized stats for efficiency calculation
  const normalizedStats = { batchCount: batches, messagesAggregated };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            LLAS Aggregation
          </h3>
        </div>
        <div className="card-body">
          <div className="animate-pulse grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-700/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          LLAS Aggregation
        </h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 gap-4">
          <StatBox
            icon={<Package className="w-5 h-5" />}
            label="Total Batches"
            value={batches}
            color="text-blue-400"
          />
          <StatBox
            icon={<GitMerge className="w-5 h-5" />}
            label="Messages Aggregated"
            value={messagesAggregated}
            color="text-green-400"
          />
          <StatBox
            icon={<Zap className="w-5 h-5" />}
            label="Avg Batch Size"
            value={avgBatchSize.toFixed(1)}
            color="text-yellow-400"
          />
          <StatBox
            icon={<Layers className="w-5 h-5" />}
            label="Merkle Tree Depth"
            value={merkleTreeDepth.toFixed(1)}
            color="text-purple-400"
          />
        </div>

        {/* Aggregation efficiency */}
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Aggregation Efficiency</span>
            <span className="text-sm font-medium text-green-400">
              {calculateEfficiency(normalizedStats)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${calculateEfficiency(normalizedStats)}%` }}
            ></div>
          </div>
        </div>

        {/* Last batch info */}
        {stats.lastBatchTime && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Last batch: {formatTime(stats.lastBatchTime)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <div className="bg-gray-700/30 rounded-lg p-4 flex flex-col">
      <div className={`${color} mb-2`}>{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function calculateEfficiency(stats) {
  if (!stats.messagesAggregated || !stats.batchCount) return 0;
  // Efficiency based on compression ratio (more messages per batch = more efficient)
  const ratio = stats.messagesAggregated / stats.batchCount;
  const maxRatio = 10; // Assume max 10 messages per batch for 100% efficiency
  return Math.min(100, Math.round((ratio / maxRatio) * 100));
}

function formatTime(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleTimeString();
}
