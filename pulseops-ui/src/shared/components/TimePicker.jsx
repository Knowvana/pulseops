import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Modal } from '@shared';

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

  const updateValue = (sh, sm, eh, em) => {
    const timeString = `${formatTime(sh, sm)} - ${formatTime(eh, em)}`;
    onChange(timeString);
  };

  const handleConfirm = () => {
    const timeString = `${formatTime(startHour, startMin)} - ${formatTime(endHour, endMin)}`;
    onChange(timeString);
    setIsOpen(false);
  };

  const incrementHour = (type) => {
    if (type === 'start') {
      const newHour = (startHour + 1) % 24;
      setStartHour(newHour);
      updateValue(newHour, startMin, endHour, endMin);
    } else {
      const newHour = (endHour + 1) % 24;
      setEndHour(newHour);
      updateValue(startHour, startMin, newHour, endMin);
    }
  };

  const decrementHour = (type) => {
    if (type === 'start') {
      const newHour = (startHour - 1 + 24) % 24;
      setStartHour(newHour);
      updateValue(newHour, startMin, endHour, endMin);
    } else {
      const newHour = (endHour - 1 + 24) % 24;
      setEndHour(newHour);
      updateValue(startHour, startMin, newHour, endMin);
    }
  };

  const incrementMin = (type) => {
    if (type === 'start') {
      const newMin = (startMin + 15) % 60;
      setStartMin(newMin);
      updateValue(startHour, newMin, endHour, endMin);
    } else {
      const newMin = (endMin + 15) % 60;
      setEndMin(newMin);
      updateValue(startHour, startMin, endHour, newMin);
    }
  };

  const decrementMin = (type) => {
    if (type === 'start') {
      const newMin = (startMin - 15 + 60) % 60;
      setStartMin(newMin);
      updateValue(startHour, newMin, endHour, endMin);
    } else {
      const newMin = (endMin - 15 + 60) % 60;
      setEndMin(newMin);
      updateValue(startHour, startMin, endHour, newMin);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm text-left bg-white hover:bg-surface-50 transition-colors flex items-center justify-between shadow-[0_0_10px_rgba(59,130,246,0.3)]"
      >
        <span className={value ? 'text-surface-800' : 'text-surface-400'}>
          {value || label}
        </span>
        <ChevronDown size={18} className={`text-surface-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Select Time"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              {/* Start Time */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-sm font-bold text-surface-500 uppercase tracking-widest">Start</div>
                <div className="flex gap-2 items-center">
                  {/* Hours */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => incrementHour('start')}
                      className="p-2 hover:bg-brand-50 rounded-lg transition-colors text-brand-600"
                    >
                      <ChevronUp size={20} />
                    </button>
                    <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-brand-50 to-teal-50 rounded-xl border-2 border-brand-200 font-bold text-lg text-brand-700">
                      {String(startHour).padStart(2, '0')}
                    </div>
                    <button
                      onClick={() => decrementHour('start')}
                      className="p-2 hover:bg-brand-50 rounded-lg transition-colors text-brand-600"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                  <div className="text-2xl font-bold text-surface-400">:</div>
                  {/* Minutes */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => incrementMin('start')}
                      className="p-2 hover:bg-brand-50 rounded-lg transition-colors text-brand-600"
                    >
                      <ChevronUp size={20} />
                    </button>
                    <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-brand-50 to-teal-50 rounded-xl border-2 border-brand-200 font-bold text-lg text-brand-700">
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
              <div className="flex flex-col items-center">
                <div className="text-sm font-bold text-surface-500 uppercase tracking-widest">To</div>
                <div className="text-2xl font-bold text-surface-400">-</div>
              </div>

              {/* End Time */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-sm font-bold text-surface-500 uppercase tracking-widest">End</div>
                <div className="flex gap-2 items-center">
                  {/* Hours */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => incrementHour('end')}
                      className="p-2 hover:bg-amber-50 rounded-lg transition-colors text-amber-600"
                    >
                      <ChevronUp size={20} />
                    </button>
                    <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 font-bold text-lg text-amber-700">
                      {String(endHour).padStart(2, '0')}
                    </div>
                    <button
                      onClick={() => decrementHour('end')}
                      className="p-2 hover:bg-amber-50 rounded-lg transition-colors text-amber-600"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                  <div className="text-2xl font-bold text-surface-400">:</div>
                  {/* Minutes */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => incrementMin('end')}
                      className="p-2 hover:bg-amber-50 rounded-lg transition-colors text-amber-600"
                    >
                      <ChevronUp size={20} />
                    </button>
                    <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 font-bold text-lg text-amber-700">
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
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
