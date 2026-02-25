// ============================================================================
// EmptyState Component — PulseOps UI
//
// PURPOSE: Reusable empty-state placeholder for modules with no data.
// Displays module-specific icon, title, description, and action buttons.
// Configurable per module via a config map or custom props.
//
// ARCHITECTURE: Shared component imported via '@shared'. Module configs
// define icon, colors, button labels. All text can be overridden via
// customConfig prop for full flexibility.
//
// USAGE:
//   import { EmptyState } from '@shared';
//   <EmptyState module="roster_planner" onPrimaryAction={...} onSecondaryAction={...} />
// ============================================================================
import React from 'react';
import { Upload, Database, LayoutTemplate, Calendar, Activity, Users, ShieldCheck } from 'lucide-react';

const MODULE_CONFIGS = {
  admin: {
    icon: ShieldCheck,
    iconColor: 'text-purple-600',
    iconBgGlow: 'bg-purple-100',
    title: 'Initialize Platform?',
    description: 'Your platform database is currently empty. Initialize the database schema and create your first admin account to get started.',
    primaryButton: { label: 'Initialize Database', icon: Database, show: true },
    secondaryButton: { label: 'Documentation', icon: LayoutTemplate, show: false },
    footer: 'PulseOps Admin v1.0',
  },
  roster_planner: {
    icon: Calendar,
    iconColor: 'text-brand-600',
    iconBgGlow: 'bg-brand-100',
    title: 'Ready to Schedule?',
    description: 'Your roster is currently empty. Configure your workforce and shifts, then generate your schedule or load demo data to get started.',
    primaryButton: { label: 'Configure Workforce', icon: Users, show: true },
    secondaryButton: { label: 'Load Demo Data', icon: Database, show: true },
    footer: 'PulseOps Roster v1.0',
  },
  default: {
    icon: LayoutTemplate,
    iconColor: 'text-surface-600',
    iconBgGlow: 'bg-surface-100',
    title: 'Ready to Begin?',
    description: 'Get started by importing data or loading demo content to explore the features.',
    primaryButton: { label: 'Get Started', icon: Upload, show: true },
    secondaryButton: { label: 'Load Demo', icon: Database, show: true },
    footer: 'PulseOps Enterprise v1.0',
  },
};

const EmptyState = ({ module = 'default', onPrimaryAction, onSecondaryAction, customConfig = null }) => {
  const config = customConfig || MODULE_CONFIGS[module] || MODULE_CONFIGS.default;
  const IconComponent = config.icon;
  const PrimaryIcon = config.primaryButton.icon;
  const SecondaryIcon = config.secondaryButton.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in duration-700">
      <div className="relative mb-8 group">
        <div className={`absolute inset-0 ${config.iconBgGlow} rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-500`}></div>
        <div className="relative bg-white p-6 rounded-3xl shadow-sm border border-surface-100 ring-1 ring-surface-50">
          <IconComponent size={48} className={config.iconColor} strokeWidth={1.5} />
        </div>
      </div>

      <h2 className="text-3xl font-light text-surface-800 tracking-tight mb-3">{config.title}</h2>
      <p className="text-surface-500 max-w-md mb-10 leading-relaxed font-light">{config.description}</p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        {config.primaryButton.show && onPrimaryAction && (
          <button onClick={onPrimaryAction} className="flex-1 group relative overflow-hidden rounded-xl bg-surface-900 p-px shadow-lg shadow-surface-900/10 transition-transform active:scale-[0.98] hover:shadow-xl">
            <div className="relative flex items-center justify-center gap-2 bg-surface-900 px-6 py-4 rounded-xl text-white transition-colors group-hover:bg-surface-800">
              <PrimaryIcon size={18} />
              <span className="font-medium">{config.primaryButton.label}</span>
            </div>
          </button>
        )}
        {config.secondaryButton.show && onSecondaryAction && (
          <button onClick={onSecondaryAction} className="flex-1 group relative overflow-hidden rounded-xl bg-white border border-surface-200 p-px shadow-sm transition-transform active:scale-[0.98] hover:border-brand-200 hover:shadow-md">
            <div className="relative flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-surface-600 transition-colors group-hover:text-brand-600">
              <SecondaryIcon size={18} />
              <span className="font-medium">{config.secondaryButton.label}</span>
            </div>
          </button>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-surface-400 font-medium tracking-wide uppercase">
        <div className="h-px w-8 bg-surface-200"></div>
        <span>{config.footer}</span>
        <div className="h-px w-8 bg-surface-200"></div>
      </div>
    </div>
  );
};

export default EmptyState;
