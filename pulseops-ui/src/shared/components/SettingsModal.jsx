// ============================================================================
// SettingsModal Component — PulseOps UI
//
// PURPOSE: Reusable modal dialog with tabbed sidebar navigation.
// Used for module-level settings (data management, configuration, etc.).
//
// ARCHITECTURE: Shared component imported via '@shared'. Uses render-prop
// pattern — passes activeTab to children so the parent controls which
// settings panel to render. Consistent with ModuleLayout sidebar styling.
//
// USAGE:
//   import { SettingsModal } from '@shared';
//   <SettingsModal isOpen={true} onClose={...} title="Settings" tabs={[...]}>
//     {(activeTab) => <SettingsPanel tab={activeTab} />}
//   </SettingsModal>
// ============================================================================
import React, { useState } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  title = 'Settings Center',
  icon: TitleIcon = SettingsIcon,
  tabs = [],
  initialTab,
  children,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || tabs[0]?.id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-surface-900/60 backdrop-blur-md p-4 transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl border border-surface-100 flex overflow-hidden h-[85vh] relative">

        {/* Sidebar Navigation */}
        <div className="w-72 bg-white/80 backdrop-blur-xl border-r border-surface-200/60 p-6 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <h2 className="text-xl font-extrabold text-surface-800 flex items-center gap-3 mb-10 tracking-tight">
            <div className="bg-brand-50 p-2 rounded-xl text-brand-600">
              <TitleIcon size={22} />
            </div>
            {title}
          </h2>

          <nav className="flex flex-col gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                      : 'text-surface-500 hover:bg-surface-100 hover:text-surface-800'
                  }`}
                >
                  <Icon size={18} /> {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-surface-50/50">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2.5 bg-white rounded-full text-surface-400 hover:text-surface-700 shadow-sm border border-surface-200 z-50 transition-transform hover:scale-105 active:scale-95"
          >
            <X size={20} />
          </button>

          <div className="flex-1 overflow-hidden">
            {typeof children === 'function' ? children(activeTab) : children}
          </div>
        </div>
      </div>
    </div>
  );
}
