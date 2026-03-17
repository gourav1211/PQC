/**
 * Energy Estimation Component
 * ===========================
 * Estimated energy consumption comparison.
 */

import { Battery, Zap, TrendingDown, Leaf } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

// Energy constants (based on typical IoT device consumption)
const ENERGY_PER_SIGNATURE_UJ = 150; // microjoules for Dilithium sign
const ENERGY_PER_VERIFICATION_UJ = 50; // microjoules for Dilithium verify
const ENERGY_PER_KB_TRANSMITTED_UJ = 200; // microjoules per KB wireless tx

export default function EnergyEstimation({ throughputData, bandwidthData, loading = false }) {
  const energy = calculateEnergy(throughputData, bandwidthData);
  
  const pieData = [
    { name: 'Signing', value: energy.signing, color: '#6366f1' },
    { name: 'Verification', value: energy.verification, color: '#8b5cf6' },
    { name: 'Transmission', value: energy.transmission, color: '#a855f7' },
  ];

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Battery className="w-5 h-5 text-green-400" />
            Energy Estimation
          </h3>
        </div>
        <div className="card-body">
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Battery className="w-5 h-5 text-green-400" />
          Energy Estimation
        </h3>
        {energy.savings > 0 && (
          <div className="flex items-center gap-1 text-green-400 text-sm">
            <Leaf className="w-4 h-4" />
            {energy.savings}% saved
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="flex items-center gap-4">
          {/* Pie Chart */}
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  stroke="#1f2937"
                  strokeWidth={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${value.toFixed(1)} mJ`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Stats */}
          <div className="w-1/2 space-y-3">
            <EnergyRow
              icon={<Zap className="w-4 h-4 text-indigo-400" />}
              label="Signing"
              value={energy.signing}
            />
            <EnergyRow
              icon={<Zap className="w-4 h-4 text-violet-400" />}
              label="Verification"
              value={energy.verification}
            />
            <EnergyRow
              icon={<Zap className="w-4 h-4 text-purple-400" />}
              label="Transmission"
              value={energy.transmission}
            />
            <div className="border-t border-gray-700 pt-2">
              <EnergyRow
                icon={<Battery className="w-4 h-4 text-green-400" />}
                label="Total (H2A)"
                value={energy.totalH2A}
                highlight
              />
            </div>
          </div>
        </div>

        {/* Comparison bar */}
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Baseline vs H2A</span>
          </div>
          <div className="space-y-2">
            <EnergyBar label="Baseline" value={energy.totalBaseline} max={energy.totalBaseline || 1} color="bg-red-500" />
            <EnergyBar label="H2A" value={energy.totalH2A} max={energy.totalBaseline || 1} color="bg-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EnergyRow({ icon, label, value, highlight = false }) {
  return (
    <div className={`flex items-center justify-between ${highlight ? 'font-semibold' : ''}`}>
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <span className={highlight ? 'text-green-400' : 'text-white'}>
        {value.toFixed(2)} mJ
      </span>
    </div>
  );
}

function EnergyBar({ label, value, max, color }) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{value.toFixed(2)} mJ</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}

function calculateEnergy(throughputData, bandwidthData) {
  // Use correct backend data structure paths
  // throughput: { counters: { messagesReceived }, ... }
  // verification: { counters: { totalVerifications }, ... }
  const verifications = throughputData?.counters?.messagesReceived || 
                        throughputData?.totals?.verifications || 0;
  const h2aBytes = bandwidthData?.modeComparison?.h2a?.bytes || 0;
  const baselineBytes = bandwidthData?.modeComparison?.baseline?.bytes || 0;
  
  // Estimate signatures (assume 1 signature per verification)
  const signatures = verifications;
  
  // Calculate energy in millijoules
  const signing = (signatures * ENERGY_PER_SIGNATURE_UJ) / 1000;
  const verification = (verifications * ENERGY_PER_VERIFICATION_UJ) / 1000;
  const transmission = ((h2aBytes / 1024) * ENERGY_PER_KB_TRANSMITTED_UJ) / 1000;
  const transmissionBaseline = ((baselineBytes / 1024) * ENERGY_PER_KB_TRANSMITTED_UJ) / 1000;
  
  const totalH2A = signing + verification + transmission;
  const totalBaseline = signing + verification + transmissionBaseline;
  
  const savings = totalBaseline > 0 
    ? Math.round(((totalBaseline - totalH2A) / totalBaseline) * 100)
    : 0;

  return {
    signing,
    verification,
    transmission,
    totalH2A,
    totalBaseline,
    savings: Math.max(0, savings),
  };
}
