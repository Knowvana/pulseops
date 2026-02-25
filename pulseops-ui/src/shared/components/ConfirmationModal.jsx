// ============================================================================
// ConfirmationModal Component — PulseOps UI
//
// PURPOSE: Reusable three-state confirmation dialog (confirm → processing → success).
// Used for destructive actions (delete, wipe) and async operations (load demo data).
//
// ARCHITECTURE: Shared component imported via '@shared'. Action-type-specific
// styling is driven by a config map. Uses LoadingSpinner for processing state.
// All text labels are passed via props from the calling module's messages.json.
//
// USAGE:
//   import { ConfirmationModal } from '@shared';
//   <ConfirmationModal action={confirmAction} isProcessing={...} isSuccess={...}
//     onConfirm={...} onCancel={...} onSuccessClose={...} />
// ============================================================================
import React from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import LoadingSpinner from '@shared/components/LoadingSpinner';

const ACTION_STYLES = {
  load_demo: {
    iconColor: 'bg-brand-100 text-brand-600',
    buttonColor: 'bg-brand-600 hover:bg-brand-700 shadow-brand-200',
    processingText: 'Loading demo environment...',
    successTitle: 'Load Complete!',
    successDesc: 'Demo data has been successfully loaded.',
    successButton: 'View Dashboard',
  },
  delete_all: {
    iconColor: 'bg-rose-100 text-rose-600',
    buttonColor: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200',
    processingText: 'Permanently deleting all data...',
    successTitle: 'Deletion Complete!',
    successDesc: 'All data has been permanently erased.',
    successButton: 'View Dashboard',
  },
  initialize_db: {
    iconColor: 'bg-purple-100 text-purple-600',
    buttonColor: 'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
    processingText: 'Initializing database...',
    successTitle: 'Setup Complete!',
    successDesc: 'Database initialized successfully.',
    successButton: 'View Dashboard',
  },
  default: {
    iconColor: 'bg-surface-100 text-surface-600',
    buttonColor: 'bg-surface-600 hover:bg-surface-700 shadow-surface-200',
    processingText: 'Processing your request...',
    successTitle: 'Action Complete!',
    successDesc: 'The action was completed successfully.',
    successButton: 'View Dashboard',
  },
};

const ConfirmationModal = ({ action, isProcessing, isSuccess, onConfirm, onCancel, onSuccessClose, onViewTasks }) => {
  if (!action && !isProcessing && !isSuccess) return null;

  const content = ACTION_STYLES[action?.type] || ACTION_STYLES.default;
  const successTitle = action?.successTitle || content.successTitle;
  const successDesc = action?.successDesc || content.successDesc;
  const successButton = action?.successButton || content.successButton;

  if (isProcessing && !isSuccess) {
    return <LoadingSpinner title="Processing..." subtitle={content.processingText} isOpen={true} />;
  }

  return (
    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white border border-surface-100 shadow-2xl shadow-brand-500/10 rounded-3xl p-8 max-w-sm w-full text-center ring-1 ring-surface-50 relative z-10">

        {isSuccess && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
              <CheckCircle2 size={32} strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold text-surface-800 mb-2">{successTitle}</h3>
            {successDesc && <p className="text-sm text-surface-500 mb-6">{successDesc}</p>}
            <button
              onClick={action?.type === 'clear_demo' ? onViewTasks : onSuccessClose}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              {successButton} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {action && !isProcessing && !isSuccess && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${content.iconColor}`}>
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-xl font-bold text-surface-800 mb-2">{action.title}</h3>
            <p className="text-sm text-surface-500 mb-8 leading-relaxed px-2">{action.desc}</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 px-4 py-3 border border-surface-200 rounded-xl text-surface-600 font-bold hover:bg-surface-50 transition-colors">Cancel</button>
              <button onClick={onConfirm} className={`flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-lg transition-transform active:scale-95 ${content.buttonColor}`}>
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmationModal;
