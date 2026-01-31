import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plug, Power, PowerOff, Loader2, Wifi, WifiOff, Zap, Play } from 'lucide-react';
import { api } from '../api/client';
import type { SmartPlug } from '../api/client';
import { ConfirmModal } from './ConfirmModal';

interface SwitchbarPopoverProps {
  onClose: () => void;
}

function SwitchItem({ plug }: { plug: SmartPlug }) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<'on' | 'off' | null>(null);

  // Fetch current status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['smart-plug-status', plug.id],
    queryFn: () => api.getSmartPlugStatus(plug.id),
    refetchInterval: 10000, // Refresh every 10 seconds when popover is open
  });

  // Control mutation
  const controlMutation = useMutation({
    mutationFn: (action: 'on' | 'off') => api.controlSmartPlug(plug.id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-plug-status', plug.id] });
    },
  });

  const isOn = status?.state === 'ON';
  const isReachable = status?.reachable ?? false;
  const isPending = controlMutation.isPending;

  // Check if this is a HA script entity
  const isScript = plug.plug_type === 'homeassistant' && plug.ha_entity_id?.startsWith('script.');

  const handleConfirm = () => {
    if (confirmAction) {
      controlMutation.mutate(confirmAction);
      setConfirmAction(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-2 px-3 hover:bg-bambu-dark-tertiary rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${isReachable ? ((isOn || isScript) ? 'bg-bambu-green/20' : 'bg-bambu-dark') : 'bg-red-500/20'}`}>
            {isScript ? (
              <Play className={`w-4 h-4 ${isReachable ? 'text-bambu-green' : 'text-red-400'}`} />
            ) : (
              <Plug className={`w-4 h-4 ${isReachable ? (isOn ? 'text-bambu-green' : 'text-bambu-gray') : 'text-red-400'}`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-white font-medium">{plug.name}</p>
              {isScript && (
                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded-full">Script</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {statusLoading ? (
                <Loader2 className="w-3 h-3 text-bambu-gray animate-spin" />
              ) : isScript ? (
                <span className={isReachable ? 'text-status-ok' : 'text-status-error'}>
                  {isReachable ? 'Ready' : 'Offline'}
                </span>
              ) : isReachable ? (
                <>
                  <Wifi className="w-3 h-3 text-status-ok" />
                  <span className={isOn ? 'text-status-ok' : 'text-bambu-gray'}>
                    {status?.state || 'Unknown'}
                  </span>
                  {status?.energy?.power !== null && status?.energy?.power !== undefined && (
                    <>
                      <span className="text-bambu-gray mx-1">|</span>
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-yellow-400">{Math.round(status.energy.power)}W</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-status-error" />
                  <span className="text-status-error">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          {isScript ? (
            /* Script: single Run button */
            <button
              onClick={() => setConfirmAction('on')}
              disabled={!isReachable || isPending}
              className="p-1.5 rounded transition-colors bg-bambu-green text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Run Script"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </button>
          ) : (
            /* Regular: On/Off buttons */
            <>
              <button
                onClick={() => setConfirmAction('on')}
                disabled={!isReachable || isPending}
                className={`p-1.5 rounded transition-colors ${
                  isOn
                    ? 'bg-bambu-green text-white'
                    : 'bg-bambu-dark text-bambu-gray hover:text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Turn On"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setConfirmAction('off')}
                disabled={!isReachable || isPending}
                className={`p-1.5 rounded transition-colors ${
                  !isOn && isReachable
                    ? 'bg-bambu-dark-tertiary text-white'
                    : 'bg-bambu-dark text-bambu-gray hover:text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Turn Off"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {confirmAction && (
        <ConfirmModal
          title={isScript && confirmAction === 'on'
            ? 'Run Script'
            : `Turn ${confirmAction === 'on' ? 'On' : 'Off'} Smart Plug`}
          message={isScript && confirmAction === 'on'
            ? `Are you sure you want to run the script "${plug.name}"?`
            : `Are you sure you want to turn ${confirmAction === 'on' ? 'on' : 'off'} "${plug.name}"?`}
          confirmText={isScript && confirmAction === 'on' ? 'Run' : (confirmAction === 'on' ? 'Turn On' : 'Turn Off')}
          variant={confirmAction === 'off' ? 'warning' : 'default'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}

export function SwitchbarPopover({ onClose }: SwitchbarPopoverProps) {
  // Fetch all smart plugs
  const { data: plugs, isLoading } = useQuery({
    queryKey: ['smart-plugs'],
    queryFn: api.getSmartPlugs,
  });

  // Filter to only show plugs with show_in_switchbar enabled
  const switchbarPlugs = plugs?.filter(p => p.show_in_switchbar) || [];

  return (
    <div
      className="absolute bottom-full left-0 mb-2 w-72 bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-xl shadow-xl z-50"
      onMouseLeave={onClose}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-bambu-dark-tertiary">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Plug className="w-4 h-4 text-bambu-green" />
          Smart Switches
        </h3>
      </div>

      {/* Content */}
      <div className="p-2 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-bambu-gray animate-spin" />
          </div>
        ) : switchbarPlugs.length === 0 ? (
          <div className="text-center py-6 px-4">
            <Plug className="w-8 h-8 text-bambu-gray mx-auto mb-2" />
            <p className="text-sm text-bambu-gray">No switches in switchbar</p>
            <p className="text-xs text-bambu-gray mt-1">
              Enable "Show in Switchbar" in Settings &gt; Smart Plugs
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {switchbarPlugs.map(plug => (
              <SwitchItem key={plug.id} plug={plug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
