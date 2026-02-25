import React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export default function StatusTile({
  label,
  status = 'neutral',
  statusText,
  message,
  meta,
}) {
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const containerClasses = isSuccess
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : isError
      ? 'bg-rose-50 border-rose-200 text-rose-700'
      : 'bg-surface-50 border-surface-200 text-surface-600';

  const icon = isSuccess ? (
    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
  ) : isError ? (
    <XCircle size={16} className="text-rose-600 flex-shrink-0" />
  ) : (
    <Info size={16} className="text-surface-400 flex-shrink-0" />
  );

  return (
    <div className="py-2 mb-4 space-y-2">
      {label && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-surface-600">
            {label}
          </span>
          {statusText && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                isSuccess
                  ? 'text-emerald-600'
                  : isError
                    ? 'text-rose-600'
                    : 'text-surface-400'
              }`}
            >
              {statusText}
            </span>
          )}
        </div>
      )}

      {message && (
        <div
          className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${containerClasses}`}
        >
          <div className="pt-0.5">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-relaxed">
              {message}
            </p>
            {meta && (
              <p className="text-[10px] opacity-75 mt-1">
                {meta}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
