// ============================================================================
// ProgressBar Component — PulseOps UI
//
// PURPOSE: Reusable animated progress bar for multi-step operations.
// Shows a visual indicator of completion percentage with smooth transitions.
//
// ARCHITECTURE: Shared component imported via '@shared'. Uses brand colors.
//
// USAGE:
//   import { ProgressBar } from '@shared';
//   <ProgressBar progress={75} />
// ============================================================================
import React from 'react';

const ProgressBar = ({ progress = 0, className = '' }) => {
  return (
    <div className={`w-full bg-surface-100 rounded-full h-2 overflow-hidden ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
};

export default ProgressBar;
