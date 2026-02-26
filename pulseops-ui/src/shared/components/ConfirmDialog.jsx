// ============================================================================
// ConfirmDialog Component — PulseOps UI
//
// PURPOSE: Universal reusable confirmation dialog for all destructive or
// important actions across the entire application. Accepts configurable
// icon, header text, message, footer text, button labels, button icons,
// and foreground/background colors.
//
// USAGE:
//   import { ConfirmDialog } from '@shared';
//   <ConfirmDialog
//     isOpen={true}
//     icon={AlertTriangle}
//     title="Confirm Action"
//     message="Are you sure?"
//     footerText="This action cannot be undone."
//     confirmLabel="Delete"
//     cancelLabel="Cancel"
//     confirmIcon={<Trash2 size={14} />}
//     confirmVariant="danger"
//     onConfirm={handleConfirm}
//     onCancel={handleCancel}
//     isProcessing={false}
//   />
// ============================================================================
import React from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';

const VARIANT_STYLES = {
  danger: {
    iconBg: 'bg-gradient-to-br from-rose-100 to-red-100',
    iconColor: 'text-rose-600',
    confirmBtn: 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 shadow-sm shadow-rose-200',
    headerBorder: 'border-rose-100',
    footerBg: 'bg-rose-50/50',
  },
  warning: {
    iconBg: 'bg-gradient-to-br from-amber-100 to-orange-100',
    iconColor: 'text-amber-600',
    confirmBtn: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-sm shadow-amber-200',
    headerBorder: 'border-amber-100',
    footerBg: 'bg-amber-50/50',
  },
  primary: {
    iconBg: 'bg-gradient-to-br from-brand-100 to-teal-100',
    iconColor: 'text-brand-600',
    confirmBtn: 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200',
    headerBorder: 'border-brand-100',
    footerBg: 'bg-brand-50/50',
  },
  success: {
    iconBg: 'bg-gradient-to-br from-emerald-100 to-teal-100',
    iconColor: 'text-emerald-600',
    confirmBtn: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-sm shadow-emerald-200',
    headerBorder: 'border-emerald-100',
    footerBg: 'bg-emerald-50/50',
  },
  info: {
    iconBg: 'bg-gradient-to-br from-blue-100 to-indigo-100',
    iconColor: 'text-blue-600',
    confirmBtn: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-sm shadow-blue-200',
    headerBorder: 'border-blue-100',
    footerBg: 'bg-blue-50/50',
  },
};

export default function ConfirmDialog({
  isOpen = false,
  icon: Icon = AlertTriangle,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  footerText,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmIcon,
  cancelIcon,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  isProcessing = false,
  children,
}) {
  if (!isOpen) return null;

  const styles = VARIANT_STYLES[confirmVariant] || VARIANT_STYLES.primary;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-[460px] max-w-[90vw] animate-in">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${styles.headerBorder}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${styles.iconBg}`}>
              <Icon size={18} className={styles.iconColor} />
            </div>
            <h3 className="text-base font-bold text-surface-800">{title}</h3>
          </div>
          {onCancel && !isProcessing && (
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {message && <p className="text-sm text-surface-600 leading-relaxed">{message}</p>}
          {children}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t border-surface-100 ${styles.footerBg} rounded-b-2xl`}>
          <div className="flex-1">
            {footerText && <p className="text-[10px] text-surface-400 font-medium">{footerText}</p>}
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-surface-600 bg-white border border-surface-200 rounded-lg hover:bg-surface-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelIcon}
                {cancelLabel}
              </button>
            )}
            {onConfirm && (
              <button
                onClick={onConfirm}
                disabled={isProcessing}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${styles.confirmBtn}`}
              >
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : confirmIcon}
                {isProcessing ? 'Processing...' : confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
