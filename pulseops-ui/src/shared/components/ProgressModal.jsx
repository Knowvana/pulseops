import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ProgressModal({ isOpen, title, message, progress = 0 }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 p-8 w-[400px] animate-in">
        <div className="flex flex-col items-center text-center">
          <Loader2 size={32} className="text-brand-500 animate-spin mb-4" />
          <h3 className="text-lg font-bold text-surface-800 mb-1">{title}</h3>
          <p className="text-sm text-surface-500 mb-6">{message}</p>
          <div className="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="text-xs text-surface-400 mt-2">{Math.round(progress)}%</p>
        </div>
      </div>
    </div>
  );
}
