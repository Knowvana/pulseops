// ============================================================================
// StepWizard — PulseOps UI
//
// PURPOSE: Reusable multi-step wizard component. Used for module
// enablement flows (check schema → create tables → load demo data),
// database setup, user registration, and any multi-step process.
//
// ARCHITECTURE: The ONE wizard component for the platform. All multi-step
// flows compose on top of this. The caller provides steps[] with id,
// label, icon, and content (render function). The wizard manages step
// navigation internally.
//
// USED BY:
//   - Admin Modules Page → Enable module flow
//   - Admin Settings     → Database setup wizard
//   - Any module needing a multi-step setup
//
// USAGE:
//   import { StepWizard } from '@shared';
//   <StepWizard
//     isOpen={show}
//     onClose={close}
//     title="Enable Module"
//     steps={[
//       { id: 'check', label: 'Check', icon: Search, content: (props) => <CheckStep {...props} /> },
//       { id: 'create', label: 'Create', icon: Database, content: (props) => <CreateStep {...props} /> },
//     ]}
//     onComplete={handleDone}
//   />
//
// INTEGRATION FLOW:
//   Modules Page → clicks Enable → StepWizard opens → steps execute →
//   onComplete fires → module enabled in database → TopNav updated
// ============================================================================
import React, { useState, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Modal from '@shared/components/Modal';

export default function StepWizard({
  isOpen,
  onClose,
  title = 'Setup Wizard',
  subtitle,
  icon,
  size = 'lg',
  steps = [],
  onComplete,
  completedSteps: externalCompleted,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [internalCompleted, setInternalCompleted] = useState(new Set());

  const completedSteps = externalCompleted || internalCompleted;

  const goNext = useCallback(() => {
    setInternalCompleted((prev) => new Set([...prev, currentStep]));
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, steps.length]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((idx) => {
    if (idx >= 0 && idx < steps.length) {
      setCurrentStep(idx);
    }
  }, [steps.length]);

  const handleComplete = useCallback(() => {
    setInternalCompleted((prev) => new Set([...prev, currentStep]));
    onComplete?.();
  }, [currentStep, onComplete]);

  const handleClose = useCallback(() => {
    setCurrentStep(0);
    setInternalCompleted(new Set());
    onClose?.();
  }, [onClose]);

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      size={size}
    >
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, idx) => {
          const StepIcon = s.icon;
          const isActive = idx === currentStep;
          const isComplete = completedSteps.has?.(idx) || (externalCompleted && externalCompleted.has?.(idx));
          return (
            <React.Fragment key={s.id}>
              {idx > 0 && (
                <div className={`w-10 h-0.5 rounded ${isComplete ? 'bg-brand-400' : 'bg-surface-200'}`} />
              )}
              <button
                onClick={() => goToStep(idx)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                  transition-all duration-300 cursor-pointer
                  ${isActive ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : ''}
                  ${isComplete && !isActive ? 'bg-emerald-50 text-emerald-700' : ''}
                  ${!isActive && !isComplete ? 'text-surface-400 hover:text-surface-600' : ''}
                `}
              >
                {isComplete && !isActive ? <CheckCircle2 size={13} /> : StepIcon && <StepIcon size={13} />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      {step.content({
        onNext: goNext,
        onBack: goBack,
        onComplete: handleComplete,
        onClose: handleClose,
        goToStep,
        isFirstStep,
        isLastStep,
        currentStep,
        totalSteps: steps.length,
      })}
    </Modal>
  );
}
