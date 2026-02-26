// ============================================================================
// Shared Module — Barrel Export (PulseOps UI)
//
// PURPOSE: SINGLE entry point for all shared components, layouts, hooks,
// services, and utilities. Every module imports from '@shared' — never
// from deep relative paths.
//
// WHY: If you move a component file, you update ONE line here instead of
// updating every import across the entire codebase.
// ============================================================================

// --- Components (Design System) ---
export { default as Card } from '@shared/components/Card';
export { default as Button } from '@shared/components/Button';
export { default as PageHeader } from '@shared/components/PageHeader';
export { default as ProgressModal } from '@shared/components/ProgressModal';
export { default as ActionModal } from '@shared/components/ActionModal';
export { default as ProgressBar } from '@shared/components/ProgressBar';
export { default as EmptyState } from '@shared/components/EmptyState';
export { default as ConfirmationModal } from '@shared/components/ConfirmationModal';
export { default as LoadingSpinner } from '@shared/components/LoadingSpinner';
export { default as SettingsModal } from '@shared/components/SettingsModal';
export { default as LoginForm } from '@shared/components/LoginForm';
export { default as StatusTile } from '@shared/components/StatusTile';
export { default as Modal } from '@shared/components/Modal';
export { default as SettingsConfig } from '@shared/components/SettingsConfig';
export { default as ConfirmDialog } from '@shared/components/ConfirmDialog';
export { default as TimePicker } from '@shared/components/TimePicker';

// --- Wizards ---
export { default as StepWizard } from '@shared/components/wizards/StepWizard';

// --- Layouts ---
export { default as ModuleLayout } from '@shared/components/layouts/ModuleLayout';
export { default as TopNav } from '@shared/components/layouts/TopNav';
export { default as SideNav } from '@shared/components/layouts/SideNav';
export { default as RightPanel } from '@shared/components/layouts/RightPanel';

// --- Services ---
export { default as Logger } from '@shared/services/logger';
export { default as ApiClient } from '@shared/services/apiClient';
export { default as AuthService } from '@shared/services/authService';
export { default as ModuleService } from '@shared/services/moduleService';

// --- Demo Data ---
export { loadRosterDemo } from '@shared/services/demoDataService';
