import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  isOffline: boolean;
  pendingCount: number;
  onSyncNow?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline,
  pendingCount,
  onSyncNow,
}) => {
  if (!isOffline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-md"
    >
      <WifiOff className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
      <span>
        {isOffline
          ? `Mode Offline — Perubahan disimpan ke antrean lokal (${pendingCount} menunggu).`
          : `${pendingCount} data antrean offline siap disinkronkan.`}
      </span>
      {!isOffline && pendingCount > 0 && onSyncNow && (
        <button
          type="button"
          onClick={onSyncNow}
          className="inline-flex items-center gap-1 rounded bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-800 whitespace-nowrap"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Sinkronkan
        </button>
      )}
    </div>
  );
};
