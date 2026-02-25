// ============================================================================
// ModuleLayout Component — PulseOps UI
//
// PURPOSE: Universal layout wrapper for all modules. Provides a left sidebar
// navigation and a main content area. Every module (Admin, Roster, etc.)
// renders inside this layout for visual consistency.
//
// ARCHITECTURE: Shared layout imported via '@shared'. Nav items are passed
// as props — each module defines its own nav structure. The sidebar includes
// a built-in "Settings" button at the bottom. Supports grouped nav items,
// separators, and standard items.
//
// USAGE:
//   import { ModuleLayout } from '@shared';
//   <ModuleLayout title="Roster" subtitle="Scheduling" navItems={[...]}
//     activeTab={tab} onTabChange={setTab}>
//     {children}
//   </ModuleLayout>
// ============================================================================
import React from 'react';
import { Settings } from 'lucide-react';

export default function ModuleLayout({
  title,
  subtitle,
  icon: TitleIcon,
  navItems,
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <div className="flex flex-row bg-surface-50/50 h-[calc(100vh-56px)] overflow-hidden w-full relative">

      {/* LEFT SIDEBAR */}
      <aside className="w-72 bg-white border-r border-surface-200/80 flex flex-col shrink-0 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">

        {/* Context Title Header */}
        <div className="p-6 border-b border-surface-100 bg-surface-50/30">
          <div className="flex items-center gap-3 mb-1">
            {TitleIcon ? (
              <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600 shadow-sm border border-brand-100">
                <TitleIcon size={16} />
              </div>
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]"></div>
            )}
            <h2 className="text-lg font-extrabold text-surface-800 tracking-tight">{title}</h2>
          </div>
          <p className="text-xs font-semibold text-surface-500 pl-5 uppercase tracking-widest">{subtitle}</p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item, index) => (
            item.type === 'separator' ? (
              <div key={`separator-${index}`} className="py-2">
                <div className="h-px bg-surface-200/80 w-full"></div>
              </div>
            ) : item.type === 'group' ? (
              <div key={item.id} className="pt-2">
                <div className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-surface-400 uppercase tracking-widest">
                  <item.icon size={16} className="text-surface-400" />
                  {item.label}
                </div>
                <div className="space-y-1 mt-1">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onTabChange(child.id)}
                      className={`w-full flex items-center gap-3 pl-8 pr-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                        activeTab === child.id
                          ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100/50'
                          : 'text-surface-500 hover:bg-surface-50 hover:text-surface-800'
                      }`}
                    >
                      <child.icon size={16} className={activeTab === child.id ? 'text-brand-600' : 'text-surface-400'} />
                      {child.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeTab === item.id
                    ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100/50'
                    : 'text-surface-500 hover:bg-surface-50 hover:text-surface-800'
                }`}
              >
                <item.icon size={18} className={activeTab === item.id ? 'text-brand-600' : 'text-surface-400'} />
                {item.label}
              </button>
            )
          ))}

          {/* Divider before settings */}
          <div className="pt-4 pb-2">
            <div className="h-px bg-surface-200/80 w-full"></div>
          </div>

          <button
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'settings'
                ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100/50'
                : 'text-surface-500 hover:bg-surface-50 hover:text-surface-800'
            }`}
          >
            <Settings size={18} className={activeTab === 'settings' ? 'text-brand-600' : 'text-surface-400'} />
            Settings
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-surface-50/50">
        <div className="w-full h-full flex flex-col min-h-0 p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
