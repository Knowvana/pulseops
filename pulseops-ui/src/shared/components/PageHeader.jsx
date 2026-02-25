import React from 'react';

export default function PageHeader({ title, subtitle, icon: Icon, actions }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200/50">
            <Icon size={20} className="text-brand-600" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-extrabold text-surface-800 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
