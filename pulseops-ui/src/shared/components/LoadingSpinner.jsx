// ============================================================================
// LoadingSpinner Component — PulseOps UI
//
// PURPOSE: Reusable full-overlay loading indicator with animated spinner.
// Used during async operations (API calls, data processing).
//
// ARCHITECTURE: Shared component imported via '@shared'. Uses the brand
// color palette for consistent theming. Renders as a modal overlay.
//
// USAGE:
//   import { LoadingSpinner } from '@shared';
//   <LoadingSpinner title="Processing..." subtitle="Please wait" isOpen={true} />
// ============================================================================
import React from 'react';

const LoadingSpinner = ({ title = 'Loading...', subtitle = 'Please wait...', isOpen = true }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white border border-surface-100 shadow-2xl shadow-brand-500/10 rounded-3xl p-8 max-w-sm w-full text-center ring-1 ring-surface-50">
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
          <div className="relative mb-4">
            <div className="w-16 h-16 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-surface-800 mb-1">{title}</h3>
          <p className="text-sm text-surface-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
