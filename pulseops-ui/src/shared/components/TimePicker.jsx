import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function TimePicker({ value = '', onChange = () => {}, label = 'Select Time' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [startHour, setStartHour] = useState(9);
  const [startMin, setStartMin] = useState(0);
  const [endHour, setEndHour] = useState(17);
  const [endMin, setEndMin] = useState(0);

  // Parse existing value if provided
  React.useEffect(() => {
    if (value) {
      const parts = value.split('-').map(p => p.trim());
      if (parts.length === 2) {
        const [start, end] = parts;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        setStartHour(sh || 9);
        setStartMin(sm || 0);
        setEndHour(eh || 17);
        setEndMin(em || 0);
      }
    }
  }, [value]);

  const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const handleConfirm = () => {
    const timeString = `${formatTime(startHour, startMin)} - ${formatTime(endHour, endMin)}`;
    onChange(timeString);
    setIsOpen(false);
  };

  const incrementHour = (type) => {
    if (type === 'start') {
      setStartHour(prev => (prev + 1) % 24);
    } else {
      setEndHour(prev => (prev + 1) % 24);
    }
  };

  const decrementHour = (type) => {
    if (type === 'start') {
      setStartHour(prev => (prev - 1 + 24) % 24);
    } else {
      setEndHour(prev => (prev - 1 + 24) % 24);
    }
  };

  const incrementMin = (type) => {
    if (type === 'start') {
      setStartMin(prev => (prev + 15) % 60);
    } else {
      setEndMin(prev => (prev + 15) % 60);
    }
  };

  const decrementMin = (type) => {
    if (type === 'start') {
      setStartMin(prev => (prev - 15 + 60) % 60);
    } else {
      setEndMin(prev => (prev - 15 + 60) % 60);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm text-left bg-white hover:bg-surface-50 transition-colors flex items-center justify-between"
      >
        <span className={value ? 'text-surface-800' : 'text-surface-400'}>
          {value || label}
        </span>
        <ChevronDown size={18} className={`text-surface-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-surface-200 rounded-xl shadow-lg p-6 z-50">
          <div className="space-y-4">
            {/* Start Time */}
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">Start Time</label>
              <div className="flex gap-4 items-center justify-center">
                {/* Hours */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => incrementHour('start')}
                    className="p-2 hover:bg-brand-50 rounded-lg transition-colors text-brand-600"
                  >
                    <ChevronUp size={20} />
                  </button>
                  <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-brand-50 to-teal-50 rounded-xl border-2 border-brand-200 font-bold text-2xl text-brand-700">
                    {String(startHour).padStart(2, '0')}
                  </div>
                  <button
                    onClick={() => decrementHour('start')}
                    className="p-2 hover:bg-brand-50 rounded-lg transition-colors text-brand-600"
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>

                {/* Separator */}
                <div className="text-2xl font-bold text-surface-400">:</div>

                {/* Minutes */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => incrementMin('start')}
                    className="p-2 hover:bg-brand-50 rounded-lg transition-colors text-brand-600"
                  >
                    <ChevronUp size={20} />
                  </button>
                  <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-brand-50 to-teal-50 rounded-xl border-2 border-brand-200 font-bold text-2xl text-brand-700">
                    {String(startMin).padStart(2, '0')}
                  </div>
                  <button
                    onClick={() => decrementMin('start')}
                    className="p-2 hover:bg-brand-50 rounded-lg transition-colors text-brand-600"
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-300 to-transparent"></div>
              <span className="text-sm font-bold text-surface-400">to</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-300 to-transparent"></div>
            </div>

            {/* End Time */}
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">End Time</label>
              <div className="flex gap-4 items-center justify-center">
                {/* Hours */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => incrementHour('end')}
                    className="p-2 hover:bg-amber-50 rounded-lg transition-colors text-amber-600"
                  >
                    <ChevronUp size={20} />
                  </button>
                  <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 font-bold text-2xl text-amber-700">
                    {String(endHour).padStart(2, '0')}
                  </div>
                  <button
                    onClick={() => decrementHour('end')}
                    className="p-2 hover:bg-amber-50 rounded-lg transition-colors text-amber-600"
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>

                {/* Separator */}
                <div className="text-2xl font-bold text-surface-400">:</div>

                {/* Minutes */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => incrementMin('end')}
                    className="p-2 hover:bg-amber-50 rounded-lg transition-colors text-amber-600"
                  >
                    <ChevronUp size={20} />
                  </button>
                  <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 font-bold text-2xl text-amber-700">
                    {String(endMin).padStart(2, '0')}
                  </div>
                  <button
                    onClick={() => decrementMin('end')}
                    className="p-2 hover:bg-amber-50 rounded-lg transition-colors text-amber-600"
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <div className="flex gap-3 pt-4 border-t border-surface-100">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-surface-200 text-surface-700 font-semibold hover:bg-surface-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-teal-600 text-white font-semibold hover:shadow-lg transition-all text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
