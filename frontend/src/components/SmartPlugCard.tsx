import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Plug, Power, PowerOff, Loader2, Trash2, Settings2, Thermometer, Clock, Wifi, WifiOff, Edit2, Bell, Calendar, LayoutGrid, ExternalLink, Home, Play, Eye } from 'lucide-react';
import { api } from '../api/client';
import type { SmartPlug, SmartPlugUpdate } from '../api/client';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../contexts/ToastContext';

interface SmartPlugCardProps {
  plug: SmartPlug;
  onEdit: (plug: SmartPlug) => void;
}

export function SmartPlugCard({ plug, onEdit }: SmartPlugCardProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPowerOnConfirm, setShowPowerOnConfirm] = useState(false);
  const [showPowerOffConfirm, setShowPowerOffConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch current status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['smart-plug-status', plug.id],
    queryFn: () => api.getSmartPlugStatus(plug.id),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch printers for linking
  const { data: printers } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  const linkedPrinter = printers?.find(p => p.id === plug.printer_id);

  // Control mutation with optimistic updates
  const controlMutation = useMutation({
    mutationFn: (action: 'on' | 'off' | 'toggle') => api.controlSmartPlug(plug.id, action),
    onMutate: async (action) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['smart-plug-status', plug.id] });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData(['smart-plug-status', plug.id]);

      // Optimistically update to the new value
      const newState = action === 'on' ? 'ON' : action === 'off' ? 'OFF' : (status?.state === 'ON' ? 'OFF' : 'ON');
      queryClient.setQueryData(['smart-plug-status', plug.id], (old: typeof status) => ({
        ...old,
        state: newState,
      }));

      return { previousStatus };
    },
    onSuccess: (_data, action) => {
      // Show toast for script triggers
      const isScriptPlug = plug.plug_type === 'homeassistant' && plug.ha_entity_id?.startsWith('script.');
      if (isScriptPlug && action === 'on') {
        showToast(`Script "${plug.name}" triggered`, 'success');
      }
    },
    onError: (_err, action, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(['smart-plug-status', plug.id], context.previousStatus);
      }
      const isScriptPlug = plug.plug_type === 'homeassistant' && plug.ha_entity_id?.startsWith('script.');
      if (isScriptPlug) {
        showToast(`Failed to trigger script "${plug.name}"`, 'error');
      } else {
        showToast(`Failed to turn ${action} "${plug.name}"`, 'error');
      }
    },
    onSettled: () => {
      // Refetch after a short delay to get actual state
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['smart-plug-status', plug.id] });
        queryClient.invalidateQueries({ queryKey: ['smart-plugs'] });
      }, 1000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: SmartPlugUpdate) => api.updateSmartPlug(plug.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-plugs'] });
      // Also invalidate printer-specific smart plug queries to keep PrintersPage in sync
      if (plug.printer_id) {
        queryClient.invalidateQueries({ queryKey: ['smartPlugByPrinter', plug.printer_id] });
      }
      // Invalidate script plugs queries for printer cards
      queryClient.invalidateQueries({ predicate: (query) =>
        Array.isArray(query.queryKey) && query.queryKey[0] === 'scriptPlugsByPrinter'
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSmartPlug(plug.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-plugs'] });
      // Also invalidate script plugs queries for printer cards
      queryClient.invalidateQueries({ predicate: (query) =>
        Array.isArray(query.queryKey) && query.queryKey[0] === 'scriptPlugsByPrinter'
      });
    },
  });

  const isOn = status?.state === 'ON';
  const isReachable = status?.reachable ?? false;
  const isPending = controlMutation.isPending;

  // Check if this is a HA script entity (scripts can only be triggered, not toggled)
  const isScript = plug.plug_type === 'homeassistant' && plug.ha_entity_id?.startsWith('script.');

  // Generate admin URL with auto-login credentials (Tasmota only)
  const getAdminUrl = () => {
    if (plug.plug_type !== 'tasmota' || !plug.ip_address) return null;
    const ip = plug.ip_address;
    if (plug.username && plug.password) {
      // Use HTTP Basic Auth in URL for auto-login
      return `http://${encodeURIComponent(plug.username)}:${encodeURIComponent(plug.password)}@${ip}/`;
    }
    return `http://${ip}/`;
  };

  const adminUrl = getAdminUrl();

  return (
    <>
      <Card className="relative">
        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`p-2 rounded-lg flex-shrink-0 ${isReachable ? ((isOn || isScript) ? 'bg-bambu-green/20' : 'bg-bambu-dark') : 'bg-red-500/20'}`}>
                {isScript ? (
                  <Play className={`w-5 h-5 ${isReachable ? 'text-bambu-green' : 'text-red-400'}`} />
                ) : plug.plug_type === 'homeassistant' ? (
                  <Home className={`w-5 h-5 ${isReachable ? (isOn ? 'text-bambu-green' : 'text-bambu-gray') : 'text-red-400'}`} />
                ) : (
                  <Plug className={`w-5 h-5 ${isReachable ? (isOn ? 'text-bambu-green' : 'text-bambu-gray') : 'text-red-400'}`} />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-white truncate" title={plug.name}>{plug.name}</h3>
                <p className="text-sm text-bambu-gray truncate" title={plug.plug_type === 'homeassistant' ? plug.ha_entity_id ?? undefined : plug.ip_address ?? undefined}>
                  {plug.plug_type === 'homeassistant' ? plug.ha_entity_id : plug.ip_address}
                </p>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {statusLoading ? (
                <Loader2 className="w-4 h-4 text-bambu-gray animate-spin" />
              ) : isScript ? (
                /* Script entities: show badge and Ready status stacked */
                <div className="flex flex-col items-end gap-1">
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                    <Play className="w-3 h-3" />
                    Script
                  </span>
                  <span className={`text-sm ${isReachable ? 'text-status-ok' : 'text-status-error'}`}>
                    {isReachable ? 'Ready' : 'Offline'}
                  </span>
                </div>
              ) : isReachable ? (
                <div className="flex items-center gap-1 text-sm">
                  <Wifi className="w-4 h-4 text-status-ok" />
                  <span className={isOn ? 'text-status-ok' : 'text-bambu-gray'}>
                    {status?.state || 'Unknown'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm text-status-error">
                  <WifiOff className="w-4 h-4" />
                  <span>Offline</span>
                </div>
              )}
              {/* Admin page link - only for Tasmota */}
              {adminUrl && (
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 bg-bambu-dark hover:bg-bambu-dark-tertiary text-bambu-gray hover:text-white text-xs rounded-full transition-colors"
                  title="Open plug admin page"
                >
                  <ExternalLink className="w-3 h-3" />
                  Admin
                </a>
              )}
            </div>
          </div>

          {/* Linked Printer */}
          {linkedPrinter && (
            <div className="mb-3 px-2 py-1.5 bg-bambu-dark rounded-lg">
              <span className="text-xs text-bambu-gray">Linked to: </span>
              <span className="text-sm text-white">{linkedPrinter.name}</span>
            </div>
          )}

          {/* Feature Badges */}
          {(plug.power_alert_enabled || plug.schedule_enabled) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {plug.power_alert_enabled && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                  <Bell className="w-3 h-3" />
                  Alerts
                </span>
              )}
              {plug.schedule_enabled && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                  <Calendar className="w-3 h-3" />
                  {plug.schedule_on_time && plug.schedule_off_time
                    ? `${plug.schedule_on_time} - ${plug.schedule_off_time}`
                    : plug.schedule_on_time
                      ? `On ${plug.schedule_on_time}`
                      : `Off ${plug.schedule_off_time}`}
                </span>
              )}
            </div>
          )}

          {/* Quick Controls */}
          <div className="flex gap-2 mb-3">
            {isScript ? (
              /* Script entities: single "Run" button */
              <Button
                size="sm"
                variant="primary"
                disabled={!isReachable || isPending}
                onClick={() => setShowPowerOnConfirm(true)}
                className="flex-1"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Script
              </Button>
            ) : (
              /* Regular entities: On/Off buttons */
              <>
                <Button
                  size="sm"
                  variant={isOn ? 'primary' : 'secondary'}
                  disabled={!isReachable || isPending}
                  onClick={() => setShowPowerOnConfirm(true)}
                  className="flex-1"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  On
                </Button>
                <Button
                  size="sm"
                  variant={!isOn ? 'primary' : 'secondary'}
                  disabled={!isReachable || isPending}
                  onClick={() => setShowPowerOffConfirm(true)}
                  className="flex-1"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                  Off
                </Button>
              </>
            )}
          </div>

          {/* Toggle Settings Panel */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between py-2 text-sm text-bambu-gray hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Automation Settings
            </span>
            <span>{isExpanded ? '-' : '+'}</span>
          </button>

          {/* Expanded Settings */}
          {isExpanded && (
            <div className="pt-3 border-t border-bambu-dark-tertiary space-y-4">
              {/* Show on Printer Card Toggle - only for scripts */}
              {isScript && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-bambu-green" />
                    <div>
                      <p className="text-sm text-white">Show on Printer Card</p>
                      <p className="text-xs text-bambu-gray">Display script button on printer card</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plug.show_on_printer_card}
                      onChange={(e) => updateMutation.mutate({ show_on_printer_card: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-bambu-green"></div>
                  </label>
                </div>
              )}

              {/* Show in Switchbar Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-bambu-green" />
                  <div>
                    <p className="text-sm text-white">Show in Switchbar</p>
                    <p className="text-xs text-bambu-gray">Quick access from sidebar</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plug.show_in_switchbar}
                    onChange={(e) => updateMutation.mutate({ show_in_switchbar: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Enabled</p>
                  <p className="text-xs text-bambu-gray">Enable automation for this plug</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plug.enabled}
                    onChange={(e) => updateMutation.mutate({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>

              {/* Auto On / Run when printer turns on */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{isScript ? 'Run when printer turns on' : 'Auto On'}</p>
                  <p className="text-xs text-bambu-gray">
                    {isScript ? 'Execute script when main plug is switched on' : 'Turn on when print starts'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plug.auto_on}
                    onChange={(e) => updateMutation.mutate({ auto_on: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>

              {/* Auto Off / Run when printer turns off */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{isScript ? 'Run when printer turns off' : 'Auto Off'}</p>
                  <p className="text-xs text-bambu-gray">
                    {isScript ? 'Execute script when main plug is switched off' : 'Turn off when print completes (one-shot)'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plug.auto_off}
                    onChange={(e) => updateMutation.mutate({ auto_off: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>

              {/* Delay Mode - hidden for script entities */}
              {plug.auto_off && !isScript && (
                <div className="space-y-3 pl-4 border-l-2 border-bambu-dark-tertiary">
                  <div>
                    <p className="text-sm text-white mb-2">Turn Off Delay Mode</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateMutation.mutate({ off_delay_mode: 'time' })}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          plug.off_delay_mode === 'time'
                            ? 'bg-bambu-green text-white'
                            : 'bg-bambu-dark text-bambu-gray hover:text-white'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        Time
                      </button>
                      <button
                        onClick={() => updateMutation.mutate({ off_delay_mode: 'temperature' })}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          plug.off_delay_mode === 'temperature'
                            ? 'bg-bambu-green text-white'
                            : 'bg-bambu-dark text-bambu-gray hover:text-white'
                        }`}
                      >
                        <Thermometer className="w-4 h-4" />
                        Temp
                      </button>
                    </div>
                  </div>

                  {plug.off_delay_mode === 'time' ? (
                    <div>
                      <label className="block text-xs text-bambu-gray mb-1">Delay (minutes)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={plug.off_delay_minutes}
                        onChange={(e) => updateMutation.mutate({ off_delay_minutes: parseInt(e.target.value) || 5 })}
                        className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white text-sm focus:border-bambu-green focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-bambu-gray mb-1">Temperature threshold (C)</label>
                      <input
                        type="number"
                        min="30"
                        max="100"
                        value={plug.off_temp_threshold}
                        onChange={(e) => updateMutation.mutate({ off_temp_threshold: parseInt(e.target.value) || 70 })}
                        className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white text-sm focus:border-bambu-green focus:outline-none"
                      />
                      <p className="text-xs text-bambu-gray mt-1">Turns off when nozzle cools below this temperature</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEdit(plug)}
                  className="flex-1"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Smart Plug"
          message={`Are you sure you want to delete "${plug.name}"? This cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={() => {
            deleteMutation.mutate();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Power On / Run Script Confirmation */}
      {showPowerOnConfirm && (
        <ConfirmModal
          title={isScript ? "Run Script" : "Turn On Smart Plug"}
          message={isScript
            ? `Are you sure you want to run the script "${plug.name}"?`
            : `Are you sure you want to turn on "${plug.name}"?`}
          confirmText={isScript ? "Run" : "Turn On"}
          variant="default"
          onConfirm={() => {
            controlMutation.mutate('on');
            setShowPowerOnConfirm(false);
          }}
          onCancel={() => setShowPowerOnConfirm(false)}
        />
      )}

      {/* Power Off Confirmation */}
      {showPowerOffConfirm && (
        <ConfirmModal
          title="Turn Off Smart Plug"
          message={`Are you sure you want to turn off "${plug.name}"? This will cut power to the connected device.`}
          confirmText="Turn Off"
          variant="danger"
          onConfirm={() => {
            controlMutation.mutate('off');
            setShowPowerOffConfirm(false);
          }}
          onCancel={() => setShowPowerOffConfirm(false)}
        />
      )}
    </>
  );
}
