import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Calendar, CheckCircle2, XCircle, Database,
  Layers, Play, Pause, RefreshCw, Package, Search, AlertCircle,
  Loader2, Download, Trash2, Copy, Check
} from 'lucide-react';
import { StepWizard, ModuleService, ProgressModal } from '@shared';
import Logger from '@shared/services/logger';
import uiText from '@shared/config/uiElementsText.json';

const txt = uiText.platformAdmin.modules || {};

const MODULE_ICONS = {
  platform_admin: Shield,
  shiftroaster: Calendar,
};

export default function AdminModules({ onModulesChanged }) {
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
      Logger.error('AdminModules', 'Failed to fetch modules', { error: err.message });
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
      Logger.error('AdminModules', 'Failed to disable module', { error: err.message });
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
        <div className="space-y-4">
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
            <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
              <Search size={16} className="text-brand-500" />
              Schema Verification
            </h4>
            <p className="text-sm text-surface-600 mb-4">Checking if all required database tables exist for this module.</p>
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
                      {exists ? 'EXISTS' : 'MISSING'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button onClick={props.onNext} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all">
              Next — Initialize Schema
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'initialize',
      label: txt.wizardSteps?.initialize || 'Initialize',
      icon: Database,
      content: (props) => (
        <div className="space-y-4">
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
            <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
              <Database size={16} className="text-blue-500" />
              Initialize Database Schema
            </h4>
            <p className="text-sm text-surface-600 mb-3">
              Create {selectedModule?.requiredTables?.length || 0} tables for the {selectedModule?.name} module
            </p>
            <button onClick={props.onNext} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-95 transition-all">
              Next — Enable Module
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'enable',
      label: txt.wizardSteps?.enable || 'Enable',
      icon: Play,
      content: (props) => (
        <div className="space-y-4">
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
            <h4 className="font-bold text-surface-800 mb-2 flex items-center gap-2">
              <Play size={16} className="text-brand-500" />
              Activate Module
            </h4>
            <p className="text-sm text-surface-600 mb-4">
              The module schema is ready. Click below to enable <strong>{selectedModule?.name}</strong> and make it visible in the navigation.
            </p>
            <button
              onClick={handleWizardComplete}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
            >
              Done — Close Wizard
            </button>
          </div>
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
          Refresh
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
                      Core
                    </span>
                  )}
                  <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                    isEnabled
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-surface-100 text-surface-500'
                  }`}>
                    {isEnabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {isEnabled ? 'Enabled' : 'Disabled'}
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
                    {mod.schemaValid ? 'Schema Ready' : 'Schema Not Initialized'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {!isEnabled && !isCore && (
                    <button
                      onClick={() => handleEnableClick(mod)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:from-brand-700 hover:to-teal-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Play size={14} />
                      Enable Module
                    </button>
                  )}
                  {isEnabled && !isCore && (
                    <button
                      onClick={() => handleDisable(mod)}
                      disabled={isActionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-300 text-surface-700 rounded-xl text-sm font-bold hover:bg-surface-50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}
                      Disable
                    </button>
                  )}
                  {isCore && (
                    <span className="text-xs text-surface-400 italic">Core module — always active</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <StepWizard
        isOpen={wizardOpen}
        onClose={() => { setWizardOpen(false); setSelectedModule(null); }}
        title={`Enable Module: ${selectedModule?.name || ''}`}
        subtitle="Follow the steps to activate this module"
        icon={Package}
        size="lg"
        steps={enableWizardSteps}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
