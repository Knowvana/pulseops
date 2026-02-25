import React, { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import ActionModal from '@shared/components/ActionModal';
import ApiClient from '@shared/services/apiClient';
import Logger from '@shared/services/logger';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';

const txt = uiText.platformAdmin.settings.authentication;

export default function SettingsAuth() {
  const [authMethod, setAuthMethod] = useState('json');
  const [dbReady, setDbReady] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const checkStatus = useCallback(async () => {
    try {
      const [configRes, schemaRes] = await Promise.all([
        ApiClient.get('/config/auth').catch(() => null),
        ApiClient.get('/database/schema-status').catch(() => null),
      ]);

      if (configRes?.success && configRes?.data) {
        setAuthMethod(configRes.data.method || 'json');
      }

      if (schemaRes?.success && schemaRes?.data) {
        setDbReady(true);
        setDbInitialized(schemaRes.data.initialized !== false && schemaRes.data.hasDefaultData !== false);
      }
    } catch (err) {
      Logger.warn('Settings - Auth', 'Failed to check auth status', { error: err.message });
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const handleSwitchAuth = useCallback(async () => {
    setShowConfirm(false);
    setIsSwitching(true);
    try {
      const newMethod = authMethod === 'json' ? 'database' : 'json';
      const result = await ApiClient.post('/config/auth', { method: newMethod });

      if (result?.success) {
        setAuthMethod(newMethod);
        setShowSuccess(true);
        Logger.info('Settings - Auth', messages.success.authSwitched, { method: newMethod });
      } else {
        throw new Error(result?.error?.message || messages.errors.authSwitchFailed);
      }
    } catch (err) {
      setErrorMessage(err.message);
      setShowError(true);
      Logger.error('Settings - Auth', messages.errors.authSwitchFailed, { error: err.message });
    } finally {
      setIsSwitching(false);
    }
  }, [authMethod]);

  const canSwitchToDb = dbReady && dbInitialized;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

      {/* Current Method */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-4">{txt.currentMethod}</h4>

        <div className="space-y-3">
          {/* JSON Auth */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            authMethod === 'json'
              ? 'border-brand-300 bg-brand-50/30 shadow-sm'
              : 'border-surface-200 bg-white hover:border-surface-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield size={16} className={authMethod === 'json' ? 'text-brand-600' : 'text-surface-400'} />
                <span className="text-sm font-bold text-surface-800">{txt.methods.json}</span>
              </div>
              {authMethod === 'json' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">{txt.currentBadge}</span>
              )}
            </div>
            <p className="text-xs text-surface-500">{txt.jsonDescription}</p>
          </div>

          {/* Database Auth */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            authMethod === 'database'
              ? 'border-brand-300 bg-brand-50/30 shadow-sm'
              : 'border-surface-200 bg-white hover:border-surface-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield size={16} className={authMethod === 'database' ? 'text-brand-600' : 'text-surface-400'} />
                <span className="text-sm font-bold text-surface-800">{txt.methods.database}</span>
              </div>
              {authMethod === 'database' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">{txt.currentBadge}</span>
              )}
            </div>
            <p className="text-xs text-surface-500">{txt.databaseDescription}</p>
          </div>
        </div>
      </Card>

      {/* Switch Auth */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.switchLabel}</h4>

        {authMethod === 'json' && !canSwitchToDb && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-3">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">{txt.dbNotReady}</p>
          </div>
        )}

        {authMethod === 'json' ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Shield size={14} />}
            onClick={() => setShowConfirm(true)}
            disabled={!canSwitchToDb || isSwitching}
            isLoading={isSwitching}
          >
            {isSwitching ? txt.switchingButton : txt.switchButton}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            icon={<Shield size={14} />}
            onClick={() => setShowConfirm(true)}
            disabled={isSwitching}
            isLoading={isSwitching}
          >
            Switch to JSON Auth
          </Button>
        )}
      </Card>

      <ActionModal
        isOpen={showConfirm}
        title="Switch Authentication"
        icon={AlertTriangle}
        size="sm"
        variant="confirm"
        confirmLabel="Switch"
        confirmVariant={authMethod === 'json' ? 'primary' : 'danger'}
        onConfirm={handleSwitchAuth}
        onCancel={() => setShowConfirm(false)}
        isProcessing={isSwitching}
      >
        <p className="text-sm text-surface-600">{messages.confirm.switchAuthToDb}</p>
      </ActionModal>

      <ActionModal isOpen={showSuccess} title={messages.success.authSwitched} icon={CheckCircle2} size="sm" variant="info" onClose={() => setShowSuccess(false)}>
        <p className="text-sm text-surface-600">{messages.success.authSwitched}</p>
      </ActionModal>

      <ActionModal isOpen={showError} title="Error" icon={XCircle} size="sm" variant="info" onClose={() => setShowError(false)}>
        <p className="text-sm text-rose-600">{errorMessage}</p>
      </ActionModal>
    </div>
  );
}
