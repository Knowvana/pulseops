// ============================================================================
// ModulesPage — PulseOps UI (Admin Module)
//
// PURPOSE: Displays all registered platform modules with their status
// (enabled/disabled, initialized/not initialized). Allows admins to
// enable modules via a StepWizard (check schema → create tables →
// optionally load demo data) and disable non-core modules.
//
// ARCHITECTURE: Fetches module list from /api/modules on mount. Uses
// the shared StepWizard component for the enable flow. Module state
// is persisted in the database (system_modules table) — survives
// Kubernetes pod restarts.
//
// USED BY:
//   - PlatformDashboard.jsx → renders when activeView === 'modules'
//
// INTEGRATION FLOW:
//   Admin navigates to Modules → GET /api/modules → renders module cards →
//   Admin clicks Enable → StepWizard → POST /initialize → POST /enable →
//   module appears in TopNav
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Calendar, CheckCircle2, XCircle, Database,
  Layers, Play, Pause, RefreshCw, Package, Search, AlertCircle,
  Loader2, Download, Trash2
} from 'lucide-react';
import { StepWizard, ModuleService } from '@shared';
import Logger from '@shared/services/logger';
import uiText from '@shared/config/uiElementsText.json';
import logsConfig from '@shared/config/logs.json';
import messagesConfig from '@shared/config/messages.json';

const txt = uiText.platformAdmin.modules || {};

const MODULE_ICONS = {
  platform_admin: Shield,
  shiftroaster: Calendar,
};

export default function ModulesPage({ onModulesChanged }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [schemaStatus, setSchemaStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ModuleService.getAll();
      setModules(data);
    } catch (err) {
      Logger.error('ModulesPage', logsConfig.messages.common.actionFailed, { error: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const handleEnableClick = async (mod) => {
    setSelectedModule(mod);
    const status = await ModuleService.checkStatus(mod.moduleId);
    setSchemaStatus(status);
    setWizardOpen(true);
  };

  const handleDisable = async (mod) => {
    setActionLoading(mod.moduleId);
    try {
      await ModuleService.disable(mod.moduleId);
      await fetchModules();
      onModulesChanged?.();
    } catch (err) {
      Logger.error('ModulesPage', logsConfig.messages.common.actionFailed, { error: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleWizardComplete = async () => {
    setWizardOpen(false);
    setSelectedModule(null);
    setSchemaStatus(null);
    await fetchModules();
    onModulesChanged?.();
  };

  const getModuleIcon = (moduleId) => MODULE_ICONS[moduleId] || Package;

  const enableWizardSteps = [
    {
      id: 'check',
      label: txt.wizardSteps?.check || 'Check Schema',
      icon: Search,
      content: (props) => (
        <SchemaCheckStep
          module={selectedModule}
          schemaStatus={schemaStatus}
          onRefresh={async () => {
            const status = await ModuleService.checkStatus(selectedModule.moduleId);
            setSchemaStatus(status);
          }}
          {...props}
        />
      ),
    },
    {
      id: 'initialize',
      label: txt.wizardSteps?.initialize || 'Initialize',
      icon: Database,
      content: (props) => (
        <SchemaInitStep
          module={selectedModule}
          schemaStatus={schemaStatus}
          onStatusChange={setSchemaStatus}
          {...props}
        />
      ),
    },
    {
      id: 'demo',
      label: txt.wizardSteps?.demoData || 'Demo Data',
      icon: Download,
      content: (props) => (
        <DemoDataStep
          module={selectedModule}
          {...props}
        />
      ),
    },
    {
      id: 'enable',
      label: txt.wizardSteps?.enable || 'Enable',
      icon: Play,
      content: (props) => (
        <EnableStep
          module={selectedModule}
          onComplete={handleWizardComplete}
          {...props}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{txt.pageTitle || 'Platform Modules'}</h1>
          <p className="text-sm text-surface-500 mt-1">{txt.subtitle || 'Manage and configure platform modules'}</p>
        </div>
        <button
          onClick={fetchModules}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-200 rounded-xl text-sm font-semibold text-surface-600 hover:bg-surface-50 transition-colors shadow-sm"
        >
          <RefreshCw size={14} />
          {uiText.common.refresh}
        </button>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modules.map((mod) => {
          const Icon = getModuleIcon(mod.moduleId);
          const isEnabled = mod.enabled;
          const isInitialized = mod.initialized;
          const isCore = mod.isCore;
          const isActionLoading = actionLoading === mod.moduleId;

          return (
            <div
              key={mod.moduleId}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${
                isEnabled ? 'border-emerald-200' : 'border-surface-200'
              }`}
            >
              {/* Module Header */}
              <div className={`px-6 py-4 flex items-center justify-between ${
                isEnabled
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50'
                  : 'bg-gradient-to-r from-surface-50 to-surface-100'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    isEnabled
                      ? 'bg-gradient-to-br from-emerald-100 to-teal-100'
                      : 'bg-surface-200'
                  }`}>
                    <Icon size={20} className={isEnabled ? 'text-emerald-600' : 'text-surface-500'} />
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-900">{mod.name}</h3>
                    <p className="text-xs text-surface-500 mt-0.5">v{mod.version}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCore && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-700 px-2 py-0.5 rounded-md">
                      {txt.coreBadge || 'Core'}
                    </span>
                  )}
                  <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                    isEnabled
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-surface-100 text-surface-500'
                  }`}>
                    {isEnabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {isEnabled ? uiText.common.enabled : uiText.common.disabled}
                  </span>
                </div>
              </div>

              {/* Module Body */}
              <div className="px-6 py-4">
                <p className="text-sm text-surface-600 mb-4">{mod.description}</p>

                {/* Status Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${
                    isInitialized
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    <Database size={10} className="inline mr-1" />
                    {isInitialized ? (txt.schemaReady || 'Schema Ready') : (txt.schemaNotReady || 'Schema Not Initialized')}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-surface-50 text-surface-600 border border-surface-200">
                    <Layers size={10} className="inline mr-1" />
                    {(mod.requiredTables || []).length} {txt.tables || 'tables'}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-surface-50 text-surface-600 border border-surface-200">
                    {(mod.roles || []).join(', ')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  {!isEnabled && !isCore && (
                    <button
                      onClick={() => handleEnableClick(mod)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:from-brand-700 hover:to-teal-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Play size={14} />
                      {txt.enableButton || 'Enable Module'}
                    </button>
                  )}
                  {isEnabled && !isCore && (
                    <button
                      onClick={() => handleDisable(mod)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-300 text-surface-700 rounded-xl text-sm font-bold hover:bg-surface-50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}
                      {txt.disableButton || 'Disable'}
                    </button>
                  )}
                  {isCore && (
                    <span className="text-xs text-surface-400 italic">{txt.coreMessage || 'Core module — always active'}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enable Module Wizard */}
      <StepWizard
        isOpen={wizardOpen}
        onClose={() => { setWizardOpen(false); setSelectedModule(null); }}
        title={`${txt.enableWizardTitle || 'Enable Module'}: ${selectedModule?.name || ''}`}
        subtitle={txt.enableWizardSubtitle || 'Follow the steps to activate this module'}
        icon={Package}
        size="lg"
        steps={enableWizardSteps}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}

// ─── Wizard Step Components ─────────────────────────────────────────────────

function SchemaCheckStep({ module, schemaStatus, onRefresh, onNext }) {
  const status = schemaStatus || {};
  const allReady = status.initialized;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
        <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
          <Search size={16} className="text-brand-500" />
          {uiText.platformAdmin.modules?.checkTitle || 'Schema Verification'}
        </h4>
        <p className="text-sm text-surface-600 mb-4">
          {uiText.platformAdmin.modules?.checkDescription || 'Checking if all required database tables exist for this module.'}
        </p>

        {/* Table Status List */}
        <div className="space-y-2">
          {(module?.requiredTables || []).map((table) => {
            const exists = (status.existing || []).includes(table);
            return (
              <div key={table} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-surface-100">
                {exists
                  ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  : <XCircle size={14} className="text-amber-500 shrink-0" />
                }
                <span className="text-sm font-mono text-surface-700">{table}</span>
                <span className={`ml-auto text-[10px] font-bold uppercase ${exists ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {exists ? 'EXISTS' : 'MISSING'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-surface-600 hover:text-surface-800 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all"
        >
          {allReady ? 'Skip — Already Initialized' : 'Next — Initialize Schema'}
        </button>
      </div>
    </div>
  );
}

function SchemaInitStep({ module, schemaStatus, onStatusChange, onNext, onBack }) {
  const [initializing, setInitializing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isAlreadyInitialized = schemaStatus?.initialized;

  const handleInitialize = async () => {
    setInitializing(true);
    setError(null);
    try {
      const res = await ModuleService.initializeSchema(module.moduleId);
      setResult(res);
      const newStatus = await ModuleService.checkStatus(module.moduleId);
      onStatusChange?.(newStatus);
    } catch (err) {
      setError(err.message || 'Failed to initialize schema');
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
        <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
          <Database size={16} className="text-brand-500" />
          {uiText.platformAdmin.modules?.initTitle || 'Initialize Database Schema'}
        </h4>

        {isAlreadyInitialized ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-800 text-sm">Schema Already Initialized</p>
              <p className="text-xs text-emerald-600 mt-0.5">All required tables exist. You can proceed to the next step.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-surface-600 mb-4">
              This will create {(module?.requiredTables || []).length} database tables required by the {module?.name} module.
            </p>
            {!result && !error && (
              <button
                onClick={handleInitialize}
                disabled={initializing}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:from-brand-700 hover:to-teal-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {initializing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {initializing ? 'Creating tables...' : 'Create Schema Now'}
              </button>
            )}
            {result && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <p className="font-bold text-emerald-800 text-sm">Schema created successfully!</p>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-lg border border-rose-200">
                <AlertCircle size={20} className="text-rose-600" />
                <p className="font-bold text-rose-800 text-sm">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm font-semibold text-surface-600 hover:text-surface-800">
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!isAlreadyInitialized && !result}
          className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Next — Demo Data
        </button>
      </div>
    </div>
  );
}

function DemoDataStep({ module, onNext, onBack }) {
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [error, setError] = useState(null);

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    setError(null);
    try {
      const res = await ModuleService.loadDemoData(module.moduleId);
      setDemoResult(res);
    } catch (err) {
      setError(err.message || 'Failed to load demo data');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
        <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
          <Download size={16} className="text-brand-500" />
          {uiText.platformAdmin.modules?.demoTitle || 'Load Demo Data (Optional)'}
        </h4>
        <p className="text-sm text-surface-600 mb-4">
          Load sample data to explore the module features. You can skip this step if you prefer to start with a clean slate.
        </p>

        {!demoResult && !error && (
          <div className="flex gap-3">
            <button
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:from-brand-700 hover:to-teal-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingDemo ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {loadingDemo ? 'Loading...' : 'Load Demo Data'}
            </button>
          </div>
        )}

        {demoResult && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-800 text-sm">Demo data loaded successfully!</p>
              {demoResult.counts && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  {demoResult.counts.shifts} shifts, {demoResult.counts.employees} employees, {demoResult.counts.leaves} leaves
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-lg border border-rose-200">
            <AlertCircle size={20} className="text-rose-600" />
            <p className="font-bold text-rose-800 text-sm">{error}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm font-semibold text-surface-600 hover:text-surface-800">
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all"
        >
          Next — Enable Module
        </button>
      </div>
    </div>
  );
}

function EnableStep({ module, onComplete, onBack }) {
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(null);

  const handleEnable = async () => {
    setEnabling(true);
    setError(null);
    try {
      await ModuleService.enable(module.moduleId);
      setEnabled(true);
    } catch (err) {
      setError(err.message || 'Failed to enable module');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
        <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
          <Play size={16} className="text-brand-500" />
          {uiText.platformAdmin.modules?.enableTitle || 'Activate Module'}
        </h4>

        {!enabled ? (
          <>
            <p className="text-sm text-surface-600 mb-4">
              The module schema is ready. Click below to enable <strong>{module?.name}</strong> and make it visible in the navigation.
            </p>
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {enabling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {enabling ? 'Enabling...' : 'Enable Module Now'}
            </button>
            {error && (
              <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-lg border border-rose-200 mt-3">
                <AlertCircle size={20} className="text-rose-600" />
                <p className="font-bold text-rose-800 text-sm">{error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 mb-1">{module?.name} is now active!</h3>
            <p className="text-sm text-surface-500 mb-6">The module is now visible in the top navigation bar.</p>
            <button
              onClick={onComplete}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all"
            >
              Done — Close Wizard
            </button>
          </div>
        )}
      </div>

      {!enabled && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={onBack} className="px-4 py-2 text-sm font-semibold text-surface-600 hover:text-surface-800">
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
