import React from 'react';
import { X, Loader2 } from 'lucide-react';
import Button from '@shared/components/Button';

export default function ActionModal({
  isOpen,
  title,
  icon: Icon,
  size = 'md',
  variant = 'info',
  children,
  onClose,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  isProcessing = false,
}) {
  if (!isOpen) return null;

  const widths = { sm: 'w-[400px]', md: 'w-[500px]', lg: 'w-[640px]' };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl border border-surface-200 ${widths[size] || widths.md} animate-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon size={18} className="text-brand-500" />}
            <h3 className="text-base font-bold text-surface-800">{title}</h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
        {(variant === 'confirm' || variant === 'form') && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-surface-100 bg-surface-50/50 rounded-b-2xl">
            {onCancel && (
              <Button variant="secondary" size="sm" onClick={onCancel} disabled={isProcessing}>
                {cancelLabel}
              </Button>
            )}
            {onConfirm && (
              <Button variant={confirmVariant} size="sm" onClick={onConfirm} isLoading={isProcessing}>
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : null}
                {confirmLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
