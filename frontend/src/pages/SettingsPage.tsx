import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Check, Plus, Plug, AlertTriangle, RotateCcw, Bell, Download, RefreshCw, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import type { AppSettings, SmartPlug, NotificationProvider, UpdateStatus } from '../api/client';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { SmartPlugCard } from '../components/SmartPlugCard';
import { AddSmartPlugModal } from '../components/AddSmartPlugModal';
import { NotificationProviderCard } from '../components/NotificationProviderCard';
import { AddNotificationModal } from '../components/AddNotificationModal';
import { SpoolmanSettings } from '../components/SpoolmanSettings';
import { defaultNavItems, getDefaultView, setDefaultView } from '../components/Layout';
import { useState, useEffect } from 'react';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showPlugModal, setShowPlugModal] = useState(false);
  const [editingPlug, setEditingPlug] = useState<SmartPlug | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<NotificationProvider | null>(null);
  const [defaultView, setDefaultViewState] = useState<string>(getDefaultView());

  const handleDefaultViewChange = (path: string) => {
    setDefaultViewState(path);
    setDefaultView(path);
  };

  const handleResetSidebarOrder = () => {
    localStorage.removeItem('sidebarOrder');
    window.location.reload();
  };

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const { data: smartPlugs, isLoading: plugsLoading } = useQuery({
    queryKey: ['smart-plugs'],
    queryFn: api.getSmartPlugs,
  });

  const { data: notificationProviders, isLoading: providersLoading } = useQuery({
    queryKey: ['notification-providers'],
    queryFn: api.getNotificationProviders,
  });

  const { data: ffmpegStatus } = useQuery({
    queryKey: ['ffmpeg-status'],
    queryFn: api.checkFfmpeg,
  });

  const { data: versionInfo } = useQuery({
    queryKey: ['version'],
    queryFn: api.getVersion,
  });

  const { data: updateCheck, refetch: refetchUpdateCheck, isRefetching: isCheckingUpdate } = useQuery({
    queryKey: ['updateCheck'],
    queryFn: api.checkForUpdates,
    staleTime: 5 * 60 * 1000,
  });

  const { data: updateStatus, refetch: refetchUpdateStatus } = useQuery({
    queryKey: ['updateStatus'],
    queryFn: api.getUpdateStatus,
    refetchInterval: (query) => {
      const status = query.state.data as UpdateStatus | undefined;
      // Poll while update is in progress
      if (status?.status === 'downloading' || status?.status === 'installing') {
        return 1000;
      }
      return false;
    },
  });

  const applyUpdateMutation = useMutation({
    mutationFn: api.applyUpdate,
    onSuccess: () => {
      refetchUpdateStatus();
    },
  });

  // Sync local state when settings load
  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings);
    }
  }, [settings, localSettings]);

  // Track changes
  useEffect(() => {
    if (settings && localSettings) {
      const changed =
        settings.auto_archive !== localSettings.auto_archive ||
        settings.save_thumbnails !== localSettings.save_thumbnails ||
        settings.capture_finish_photo !== localSettings.capture_finish_photo ||
        settings.default_filament_cost !== localSettings.default_filament_cost ||
        settings.currency !== localSettings.currency ||
        settings.energy_cost_per_kwh !== localSettings.energy_cost_per_kwh ||
        settings.energy_tracking_mode !== localSettings.energy_tracking_mode ||
        settings.check_updates !== localSettings.check_updates;
      setHasChanges(changed);
    }
  }, [settings, localSettings]);

  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      setLocalSettings(data);
      setHasChanges(false);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
      // Invalidate archive stats to reflect energy tracking mode change
      queryClient.invalidateQueries({ queryKey: ['archiveStats'] });
    },
  });

  const handleSave = () => {
    if (localSettings) {
      updateMutation.mutate(localSettings);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [key]: value });
    }
  };

  if (isLoading || !localSettings) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-bambu-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-bambu-gray">Configure Bambusy</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showSaved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {showSaved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      {updateMutation.isError && (
        <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
          Failed to save settings: {(updateMutation.error as Error).message}
        </div>
      )}

      <div className="flex gap-8">
        {/* Left Column - General Settings */}
        <div className="space-y-6 flex-1 max-w-xl">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Archive Settings</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Auto-archive prints</p>
                  <p className="text-sm text-bambu-gray">
                    Automatically save 3MF files when prints complete
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.auto_archive}
                    onChange={(e) => updateSetting('auto_archive', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Save thumbnails</p>
                  <p className="text-sm text-bambu-gray">
                    Extract and save preview images from 3MF files
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.save_thumbnails}
                    onChange={(e) => updateSetting('save_thumbnails', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Capture finish photo</p>
                  <p className="text-sm text-bambu-gray">
                    Take a photo from printer camera when print completes
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.capture_finish_photo}
                    onChange={(e) => updateSetting('capture_finish_photo', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>
              {localSettings.capture_finish_photo && ffmpegStatus && !ffmpegStatus.installed && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-yellow-500 font-medium">ffmpeg not installed</p>
                    <p className="text-bambu-gray mt-1">
                      Camera capture requires ffmpeg. Install it via{' '}
                      <code className="bg-bambu-dark-tertiary px-1 rounded">brew install ffmpeg</code> (macOS) or{' '}
                      <code className="bg-bambu-dark-tertiary px-1 rounded">apt install ffmpeg</code> (Linux).
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Cost Tracking</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm text-bambu-gray mb-1">
                  Default filament cost (per kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={localSettings.default_filament_cost}
                  onChange={(e) =>
                    updateSetting('default_filament_cost', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-bambu-gray mb-1">Currency</label>
                <select
                  value={localSettings.currency}
                  onChange={(e) => updateSetting('currency', e.target.value)}
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CHF">CHF (Fr.)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CNY">CNY (¥)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-bambu-gray mb-1">
                  Electricity cost per kWh
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={localSettings.energy_cost_per_kwh}
                  onChange={(e) =>
                    updateSetting('energy_cost_per_kwh', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-bambu-gray mb-1">
                  Energy display mode
                </label>
                <select
                  value={localSettings.energy_tracking_mode || 'total'}
                  onChange={(e) => updateSetting('energy_tracking_mode', e.target.value as 'print' | 'total')}
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none"
                >
                  <option value="print">Prints Only</option>
                  <option value="total">Total Consumption</option>
                </select>
                <p className="text-xs text-bambu-gray mt-1">
                  {localSettings.energy_tracking_mode === 'print'
                    ? 'Dashboard shows sum of energy used during prints'
                    : 'Dashboard shows lifetime energy from smart plugs'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Interface</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm text-bambu-gray mb-1">
                  Default view on startup
                </label>
                <select
                  value={defaultView}
                  onChange={(e) => handleDefaultViewChange(e.target.value)}
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none"
                >
                  {defaultNavItems.map((item) => (
                    <option key={item.id} value={item.to}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-bambu-gray mt-1">
                  Page to show when opening the app
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Sidebar order</p>
                  <p className="text-sm text-bambu-gray">
                    Drag items in the sidebar to reorder. Reset to default order here.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetSidebarOrder}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Column - Spoolman & Updates */}
        <div className="space-y-6 flex-1 max-w-md">
          <SpoolmanSettings />

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Updates</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Check for updates</p>
                  <p className="text-sm text-bambu-gray">
                    Automatically check for new versions on startup
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.check_updates}
                    onChange={(e) => updateSetting('check_updates', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bambu-green"></div>
                </label>
              </div>

              <div className="border-t border-bambu-dark-tertiary pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white">Current version</p>
                    <p className="text-sm text-bambu-gray">v{versionInfo?.version || '...'}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => refetchUpdateCheck()}
                    disabled={isCheckingUpdate}
                  >
                    {isCheckingUpdate ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Check now
                  </Button>
                </div>

                {updateCheck?.update_available ? (
                  <div className="mt-4 p-3 bg-bambu-green/10 border border-bambu-green/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-bambu-green font-medium">
                          Update available: v{updateCheck.latest_version}
                        </p>
                        {updateCheck.release_name && updateCheck.release_name !== updateCheck.latest_version && (
                          <p className="text-sm text-bambu-gray mt-1">{updateCheck.release_name}</p>
                        )}
                        {updateCheck.release_notes && (
                          <p className="text-sm text-bambu-gray mt-2 whitespace-pre-line line-clamp-3">
                            {updateCheck.release_notes}
                          </p>
                        )}
                      </div>
                      {updateCheck.release_url && (
                        <a
                          href={updateCheck.release_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-bambu-gray hover:text-white transition-colors"
                          title="View release on GitHub"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {updateStatus?.status === 'downloading' || updateStatus?.status === 'installing' ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm text-bambu-gray">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{updateStatus.message}</span>
                        </div>
                        <div className="mt-2 w-full bg-bambu-dark-tertiary rounded-full h-2">
                          <div
                            className="bg-bambu-green h-2 rounded-full transition-all duration-300"
                            style={{ width: `${updateStatus.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : updateStatus?.status === 'complete' ? (
                      <div className="mt-3 p-2 bg-bambu-green/20 rounded text-sm text-bambu-green">
                        {updateStatus.message}
                      </div>
                    ) : updateStatus?.status === 'error' ? (
                      <div className="mt-3 p-2 bg-red-500/20 rounded text-sm text-red-400">
                        {updateStatus.error || updateStatus.message}
                      </div>
                    ) : (
                      <Button
                        className="mt-3"
                        onClick={() => applyUpdateMutation.mutate()}
                        disabled={applyUpdateMutation.isPending}
                      >
                        {applyUpdateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Install Update
                      </Button>
                    )}
                  </div>
                ) : updateCheck?.error ? (
                  <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                    Failed to check for updates: {updateCheck.error}
                  </div>
                ) : updateCheck && !updateCheck.update_available ? (
                  <p className="mt-2 text-sm text-bambu-gray">
                    You're running the latest version
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Third Column - Smart Plugs */}
        <div className="w-80 flex-shrink-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plug className="w-5 h-5 text-bambu-green" />
                  <h2 className="text-lg font-semibold text-white">Smart Plugs</h2>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingPlug(null);
                    setShowPlugModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-bambu-gray mb-4">
                Connect Tasmota-based smart plugs to automate power control for your printers.
              </p>
              {plugsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-bambu-green animate-spin" />
                </div>
              ) : smartPlugs && smartPlugs.length > 0 ? (
                <div className="space-y-4">
                  {smartPlugs.map((plug) => (
                    <SmartPlugCard
                      key={plug.id}
                      plug={plug}
                      onEdit={(p) => {
                        setEditingPlug(p);
                        setShowPlugModal(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-bambu-gray">
                  <Plug className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No smart plugs configured</p>
                  <p className="text-sm mt-1">Add a Tasmota plug to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fourth Column - Notifications */}
        <div className="w-80 flex-shrink-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-bambu-green" />
                  <h2 className="text-lg font-semibold text-white">Notifications</h2>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingProvider(null);
                    setShowNotificationModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-bambu-gray mb-4">
                Get notified about print events via WhatsApp, Telegram, Email, and more.
              </p>
              {providersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-bambu-green animate-spin" />
                </div>
              ) : notificationProviders && notificationProviders.length > 0 ? (
                <div className="space-y-4">
                  {notificationProviders.map((provider) => (
                    <NotificationProviderCard
                      key={provider.id}
                      provider={provider}
                      onEdit={(p) => {
                        setEditingProvider(p);
                        setShowNotificationModal(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-bambu-gray">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No notification providers configured</p>
                  <p className="text-sm mt-1">Add a provider to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Smart Plug Modal */}
      {showPlugModal && (
        <AddSmartPlugModal
          plug={editingPlug}
          onClose={() => {
            setShowPlugModal(false);
            setEditingPlug(null);
          }}
        />
      )}

      {/* Notification Modal */}
      {showNotificationModal && (
        <AddNotificationModal
          provider={editingProvider}
          onClose={() => {
            setShowNotificationModal(false);
            setEditingProvider(null);
          }}
        />
      )}
    </div>
  );
}
