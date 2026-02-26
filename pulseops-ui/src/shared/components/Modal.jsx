// ============================================================================
// Modal — PulseOps UI
//
// PURPOSE: The ONE overlay dialog component for the entire platform. All
// dialogs (settings, confirm, wizard, forms) compose on top of this.
// Never create a separate modal from scratch.
//
// ARCHITECTURE: Shared design system component. Locks body scroll when open,
// closes on Escape key, supports backdrop click dismiss. Sizes from sm to full.
//
// USED BY:
//   - StepWizard.jsx        — Multi-step wizard flows
//   - SettingsModal.jsx      — Module settings dialogs
//   - ConfirmationModal.jsx  — Confirm/cancel dialogs
//   - Any component needing a modal overlay
//
// USAGE:
//   import { Modal } from '@shared';
//   <Modal isOpen={show} onClose={close} title="Edit User">
//     <form>...</form>
//   </Modal>
// ============================================================================
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  size = 'md',
  className = '',
  autoFit = false,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const SIZES = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className={`
        relative w-full ${SIZES[size] || SIZES.md} mx-4
        bg-white rounded-2xl shadow-2xl shadow-surface-900/10
        border border-surface-200/50
        animate-fade-in
        ${className}
      `}>
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2 rounded-lg bg-gradient-to-br from-brand-50 to-teal-50">
                  <Icon size={18} className="text-brand-600" />
                </div>
              )}
              <div>
                {title && <h2 className="text-lg font-bold text-surface-800">{title}</h2>}
                {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className={`px-6 py-5 ${autoFit ? '' : 'max-h-[70vh] overflow-y-auto'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
