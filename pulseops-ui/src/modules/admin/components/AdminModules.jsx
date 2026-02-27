import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Calendar, Headset, CheckCircle2, XCircle, Database,
  Layers, Play, Pause, RefreshCw, Package, Search, AlertCircle,
  Loader2, Trash2, Copy, Check, ArrowLeft, ArrowRight
} from 'lucide-react';
import { StepWizard, ModuleService, ProgressModal } from '@shared';
import Logger from '@shared/services/logger';
import uiText from '@shared/config/uiElementsText.json';

const txt = uiText.platformAdmin.modules || {};

const MODULE_ICONS = {
  platform_admin: Shield,
  shiftroaster: Calendar,
  servicenow: Headset,
};

export default function AdminModules({ onModulesChanged }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [schemaStatus, setSchemaStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Wizard step state
  const [initLoading, setInitLoading] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const [enableLoading, setEnableLoading] = useState(false);
  const [enableResult, setEnableResult] = useState(null);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ModuleService.getAll();
      setModules(data);
    } catch (err) {
      Logger.error('AdminModules', 'Failed to fetch modules', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const resetWizardState = useCallback(() => {
    setInitLoading(false);
    setInitResult(null);
    setEnableLoading(false);
    setEnableResult(null);
  }, []);

  const handleEnableClick = async (mod) => {
    resetWizardState();
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
      Logger.error('AdminModules', 'Failed to disable module', { error: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleWizardClose = useCallback(() => {
    setWizardOpen(false);
    setSelectedModule(null);
    setSchemaStatus(null);
    resetWizardState();
  }, [resetWizardState]);

  const handleWizardComplete = useCallback(async () => {
    handleWizardClose();
    await fetchModules();
    onModulesChanged?.();
  }, [handleWizardClose, fetchModules, onModulesChanged]);

  // --- Step 2: Initialize Schema ---
  const handleInitializeSchema = useCallback(async () => {
    if (!selectedModule) return;
    setInitLoading(true);
    setInitResult(null);
    try {
      const result = await ModuleService.initializeSchema(selectedModule.moduleId);
      setInitResult({ success: true, data: result });
      Logger.info('AdminModules', 'Schema initialized', { moduleId: selectedModule.moduleId });
    } catch (err) {
      setInitResult({ success: false, error: err.message });
      Logger.error('AdminModules', 'Schema init failed', { error: err.message });
    } finally {
      setInitLoading(false);
    }
  }, [selectedModule]);

  // --- Step 3: Enable Module ---
  const handleEnableModule = useCallback(async () => {
    if (!selectedModule) return;
    setEnableLoading(true);
    setEnableResult(null);
    try {
      await ModuleService.enable(selectedModule.moduleId);
      setEnableResult({ success: true });
      Logger.info('AdminModules', 'Module enabled', { moduleId: selectedModule.moduleId });
    } catch (err) {
      setEnableResult({ success: false, error: err.message });
      Logger.error('AdminModules', 'Module enable failed', { error: err.message });
    } finally {
      setEnableLoading(false);
    }
  }, [selectedModule]);

  const getModuleIcon = (moduleId) => MODULE_ICONS[moduleId] || Package;

  const enableWizardSteps = [
    // ─── Step 1: Check Schema ─────────────────────────────────────────
    {
      id: 'check',
      label: txt.wizardSteps?.check || 'Check Schema',
      icon: Search,
      content: (props) => {
        const allExist = (selectedModule?.requiredTables || []).every(t => (schemaStatus?.existing || []).includes(t));
        return (
          <div className="space-y-4">
            <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
              <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
                <Search size={16} className="text-brand-500" />
                {txt.checkTitle}
              </h4>
              <p className="text-sm text-surface-600 mb-4">{txt.checkDescription}</p>
              <div className="space-y-2">
                {(selectedModule?.requiredTables || []).map((table) => {
                  const exists = (schemaStatus?.existing || []).includes(table);
                  return (
                    <div key={table} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-surface-100">
                      {exists
                        ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        : <XCircle size={14} className="text-amber-500 shrink-0" />
                      }
                      <span className="text-sm font-mono text-surface-700">{table}</span>
                      <span className={`ml-auto text-[10px] font-bold uppercase ${exists ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {exists ? (txt.exists || 'EXISTS') : (txt.missing || 'MISSING')}
                      </span>
                    </div>
                  );
                })}
              </div>
              {allExist && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  All tables already exist. You can skip initialization.
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={props.onClose}
                className="px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors"
              >
                {uiText.common.cancel}
              </button>
              <button
                onClick={props.onNext}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all"
              >
                {txt.checkNext || 'Next — Initialize Schema'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        );
      },
    },
    // ─── Step 2: Initialize Schema ────────────────────────────────────
    {
      id: 'initialize',
      label: txt.wizardSteps?.initialize || 'Initialize',
      icon: Database,
      content: (props) => (
        <div className="space-y-4">
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
            <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
              <Database size={16} className="text-blue-500" />
              {txt.initTitle}
            </h4>
            <p className="text-sm text-surface-600 mb-4">
              {(txt.initDescription || 'Create {count} tables for the {module} module')
                .replace('{count}', selectedModule?.requiredTables?.length || 0)
                .replace('{module}', selectedModule?.name || '')}
            </p>

            {/* Progress/Status */}
            {initLoading && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{txt.initializingMessage}</span>
              </div>
            )}
            {initResult?.success && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-3">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">
                  {(txt.initSuccess || 'Schema created successfully! All {count} tables are ready.')
                    .replace('{count}', selectedModule?.requiredTables?.length || 0)}
                </span>
              </div>
            )}
            {initResult?.success === false && (
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                <XCircle size={16} className="text-red-600" />
                <span className="text-sm font-medium text-red-700">{txt.initFailed}: {initResult.error}</span>
              </div>
            )}

            {/* Schema Detail Summary */}
            {initResult?.success && initResult.data?.tables && (
              <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                {initResult.data.tables.map((tbl) => (
                  <div key={tbl.name} className="p-3 bg-white border border-surface-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Database size={12} className="text-brand-500" />
                      <span className="text-xs font-bold font-mono text-surface-800">{tbl.name}</span>
                      <span className="ml-auto text-[10px] font-semibold text-surface-400">{tbl.columnCount || tbl.columns?.length || 0} columns</span>
                    </div>
                    {tbl.columns && (
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(tbl.columns) ? tbl.columns : []).map((col) => {
                          const colName = typeof col === 'string' ? col : col.name;
                          return (
                            <span key={colName} className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-100 text-surface-600 rounded">
                              {colName}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Initialize Button */}
            {!initResult?.success && (
              <button
                onClick={() => handleInitializeSchema()}
                disabled={initLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {initLoading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {initLoading ? txt.initializingMessage : (txt.initButton || 'Initialize Schema')}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={props.onBack}
              disabled={initLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors disabled:opacity-50"
            >
              <ArrowLeft size={14} />
              {txt.backButton || 'Back'}
            </button>
            {initResult?.success && (
              <button
                onClick={props.onNext}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all"
              >
                {txt.initNext || 'Next — Enable Module'}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      ),
    },
    // ─── Step 3: Enable Module ────────────────────────────────────────
    {
      id: 'enable',
      label: txt.wizardSteps?.enable || 'Enable',
      icon: Play,
      content: (props) => (
        <div className="space-y-4">
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
            <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
              {enableResult?.success
                ? <CheckCircle2 size={16} className="text-emerald-500" />
                : <Play size={16} className="text-brand-500" />
              }
              {txt.enableTitle}
            </h4>

            {/* Before enable */}
            {!enableResult?.success && !enableLoading && (
              <p className="text-sm text-surface-600 mb-4">
                {(txt.enableDescription || 'The module schema is ready. Click below to enable {module} and make it visible in the navigation.')
                  .replace('{module}', selectedModule?.name || '')}
              </p>
            )}

            {/* Loading */}
            {enableLoading && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{txt.enablingMessage}</span>
              </div>
            )}

            {/* Success Summary */}
            {enableResult?.success && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">
                      {(txt.enableSuccess || '{module} has been enabled successfully!')
                        .replace('{module}', selectedModule?.name || '')}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-white border border-surface-200 rounded-lg">
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Summary</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-surface-700">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      Schema initialized ({initResult?.data?.tableCount || selectedModule?.requiredTables?.length || 0} tables)
                    </div>
                    {initResult?.data?.tables && (
                      <div className="ml-4 mt-1 space-y-1">
                        {initResult.data.tables.map((tbl) => (
                          <div key={tbl.name} className="flex items-center gap-2 text-xs text-surface-500">
                            <Database size={10} className="text-brand-400" />
                            <span className="font-mono">{tbl.name}</span>
                            <span className="text-surface-300">({tbl.columnCount || tbl.columns?.length || 0} cols)</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-surface-700">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      Module enabled and visible in navigation
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {enableResult?.success === false && (
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                <XCircle size={16} className="text-red-600" />
                <span className="text-sm font-medium text-red-700">{txt.enableFailed}: {enableResult.error}</span>
              </div>
            )}

            {/* Action Buttons */}
            {!enableResult?.success && !enableLoading && (
              <button
                onClick={handleEnableModule}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <Play size={14} />
                {txt.wizardEnableButton || 'Enable Module'}
              </button>
            )}
            {enableResult?.success && (
              <button
                onClick={handleWizardComplete}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all mt-3"
              >
                <CheckCircle2 size={14} />
                {txt.doneButton || 'Done — Close Wizard'}
              </button>
            )}
          </div>
          {!enableResult?.success && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={props.onBack}
                disabled={enableLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                {txt.backButton || 'Back'}
              </button>
            </div>
          )}
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modules.map((mod) => {
          const Icon = getModuleIcon(mod.moduleId);
          const isEnabled = mod.enabled;
          const isCore = mod.isCore;
          const isActionLoading = actionLoading === mod.moduleId;

          return (
            <div
              key={mod.moduleId}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${
                isEnabled ? 'border-emerald-200' : 'border-surface-200'
              }`}
            >
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

              <div className="px-6 py-4">
                <p className="text-sm text-surface-600 mb-4">{mod.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${
                    mod.schemaValid
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    <Database size={10} className="inline mr-1" />
                    {mod.schemaValid ? (txt.schemaReady || 'Schema Ready') : (txt.schemaNotReady || 'Schema Not Initialized')}
                  </span>
                  {mod.requiredTables && (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-surface-50 text-surface-600 border border-surface-200">
                      {mod.requiredTables.length} {txt.tables || 'tables'}
                    </span>
                  )}
                </div>

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

      <StepWizard
        isOpen={wizardOpen}
        onClose={handleWizardClose}
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
