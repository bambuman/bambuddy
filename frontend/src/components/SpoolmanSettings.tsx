import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X, RefreshCw, Link2, Link2Off, Database, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import type { SpoolmanSyncResult, Printer } from '../api/client';
import { Card, CardContent, CardHeader } from './Card';
import { Button } from './Button';

interface SpoolmanSettingsData {
  spoolman_enabled: string;
  spoolman_url: string;
  spoolman_sync_mode: string;
}

async function getSpoolmanSettings(): Promise<SpoolmanSettingsData> {
  const response = await fetch('/api/v1/settings/spoolman');
  if (!response.ok) {
    throw new Error('Failed to load Spoolman settings');
  }
  return response.json();
}

async function updateSpoolmanSettings(data: Partial<SpoolmanSettingsData>): Promise<SpoolmanSettingsData> {
  const response = await fetch('/api/v1/settings/spoolman', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to save Spoolman settings');
  }
  return response.json();
}

export function SpoolmanSettings() {
  const queryClient = useQueryClient();
  const [localEnabled, setLocalEnabled] = useState(false);
  const [localUrl, setLocalUrl] = useState('');
  const [localSyncMode, setLocalSyncMode] = useState('auto');
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | 'all'>('all');

  // Fetch Spoolman settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['spoolman-settings'],
    queryFn: getSpoolmanSettings,
  });

  // Fetch Spoolman status
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['spoolman-status'],
    queryFn: api.getSpoolmanStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch printers for the dropdown
  const { data: printers } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  // Initialize local state from settings
  useEffect(() => {
    if (settings) {
      setLocalEnabled(settings.spoolman_enabled === 'true');
      setLocalUrl(settings.spoolman_url || '');
      setLocalSyncMode(settings.spoolman_sync_mode || 'auto');
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (settings) {
      const changed =
        (settings.spoolman_enabled === 'true') !== localEnabled ||
        (settings.spoolman_url || '') !== localUrl ||
        (settings.spoolman_sync_mode || 'auto') !== localSyncMode;
      setHasChanges(changed);
    }
  }, [settings, localEnabled, localUrl, localSyncMode]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      updateSpoolmanSettings({
        spoolman_enabled: localEnabled ? 'true' : 'false',
        spoolman_url: localUrl,
        spoolman_sync_mode: localSyncMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spoolman-settings'] });
      queryClient.invalidateQueries({ queryKey: ['spoolman-status'] });
      setHasChanges(false);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    },
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: api.connectSpoolman,
    onSuccess: () => {
      refetchStatus();
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: api.disconnectSpoolman,
    onSuccess: () => {
      refetchStatus();
    },
  });

  // Sync all mutation
  const syncAllMutation = useMutation({
    mutationFn: api.syncAllPrintersAms,
    onSuccess: (data: SpoolmanSyncResult) => {
      if (data.success) {
        // Show success message
      }
    },
  });

  // Sync single printer mutation
  const syncPrinterMutation = useMutation({
    mutationFn: (printerId: number) => api.syncPrinterAms(printerId),
    onSuccess: (data: SpoolmanSyncResult) => {
      if (data.success) {
        // Show success message
      }
    },
  });

  // Helper to handle sync based on selection
  const handleSync = () => {
    if (selectedPrinterId === 'all') {
      syncAllMutation.mutate();
    } else {
      syncPrinterMutation.mutate(selectedPrinterId);
    }
  };

  // Combine mutation states
  const isSyncing = syncAllMutation.isPending || syncPrinterMutation.isPending;
  const syncResult = selectedPrinterId === 'all' ? syncAllMutation.data : syncPrinterMutation.data;
  const syncSuccess = selectedPrinterId === 'all' ? syncAllMutation.isSuccess : syncPrinterMutation.isSuccess;

  if (settingsLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-bambu-green" />
            <h2 className="text-lg font-semibold text-white">Spoolman Integration</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-bambu-green animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-bambu-green" />
            <h2 className="text-lg font-semibold text-white">Spoolman Integration</h2>
          </div>
          {hasChanges && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : showSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                'Save'
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-bambu-gray">
          Connect to Spoolman for filament inventory tracking. AMS data will sync automatically.
        </p>

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Enable Spoolman</p>
            <p className="text-sm text-bambu-gray">
              Sync filament data with Spoolman server
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localEnabled}
              onChange={(e) => setLocalEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bambu-green"></div>
          </label>
        </div>

        {/* URL input */}
        <div>
          <label className="block text-sm text-bambu-gray mb-1">
            Spoolman URL
          </label>
          <input
            type="text"
            placeholder="http://192.168.1.100:7912"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            disabled={!localEnabled}
            className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray/50 focus:border-bambu-green focus:outline-none disabled:opacity-50"
          />
          <p className="text-xs text-bambu-gray mt-1">
            URL of your Spoolman server (e.g., http://localhost:7912)
          </p>
        </div>

        {/* Sync mode */}
        <div>
          <label className="block text-sm text-bambu-gray mb-1">
            Sync Mode
          </label>
          <select
            value={localSyncMode}
            onChange={(e) => setLocalSyncMode(e.target.value)}
            disabled={!localEnabled}
            className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none disabled:opacity-50"
          >
            <option value="auto">Automatic</option>
            <option value="manual">Manual Only</option>
          </select>
          <p className="text-xs text-bambu-gray mt-1">
            {localSyncMode === 'auto'
              ? 'AMS data syncs automatically when changes are detected'
              : 'Only sync when manually triggered'}
          </p>
        </div>

        {/* Connection status */}
        {localEnabled && (
          <div className="pt-2 border-t border-bambu-dark-tertiary">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-bambu-gray">Status:</span>
                {statusLoading ? (
                  <Loader2 className="w-4 h-4 text-bambu-gray animate-spin" />
                ) : status?.connected ? (
                  <span className="flex items-center gap-1 text-sm text-green-500">
                    <Check className="w-4 h-4" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-red-500">
                    <X className="w-4 h-4" />
                    Disconnected
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {status?.connected ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2Off className="w-4 h-4" />
                    )}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending || !localUrl}
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {/* Error display */}
            {connectMutation.isError && (
              <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-400">
                {(connectMutation.error as Error).message}
              </div>
            )}

            {/* Manual sync section */}
            {status?.connected && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-white">Sync AMS Data</p>
                  <p className="text-xs text-bambu-gray">
                    Manually sync printer AMS data to Spoolman
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Printer selector */}
                  <div className="relative flex-1">
                    <select
                      value={selectedPrinterId}
                      onChange={(e) => setSelectedPrinterId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="w-full px-3 py-2 pr-8 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white text-sm focus:border-bambu-green focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="all">All Printers</option>
                      {printers?.map((printer: Printer) => (
                        <option key={printer.id} value={printer.id}>
                          {printer.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-bambu-gray pointer-events-none" />
                  </div>
                  {/* Sync button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Sync
                  </Button>
                </div>
              </div>
            )}

            {/* Sync result */}
            {syncSuccess && syncResult && (
              <div
                className={`mt-2 p-2 rounded text-sm ${
                  syncResult.success
                    ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                    : 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                }`}
              >
                {syncResult.success
                  ? `Synced ${syncResult.synced_count} trays successfully`
                  : `Synced ${syncResult.synced_count} trays with ${syncResult.errors.length} errors`}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
