/**
 * Mode Toggle Component
 * =====================
 * Switch between Baseline and H2A modes.
 */

import { useState } from 'react';

export default function ModeToggle({ currentMode, onModeChange, disabled = false }) {
  const [isChanging, setIsChanging] = useState(false);

  const handleModeChange = async (mode) => {
    if (mode === currentMode || disabled || isChanging) return;
    
    setIsChanging(true);
    try {
      await onModeChange(mode);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="mode-toggle">
      <button
        className={`mode-toggle-btn ${currentMode === 'baseline' ? 'active' : ''}`}
        onClick={() => handleModeChange('baseline')}
        disabled={disabled || isChanging}
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400"></span>
          Baseline
        </span>
      </button>
      <button
        className={`mode-toggle-btn ${currentMode === 'h2a' ? 'active' : ''}`}
        onClick={() => handleModeChange('h2a')}
        disabled={disabled || isChanging}
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          H2A
        </span>
      </button>
    </div>
  );
}
