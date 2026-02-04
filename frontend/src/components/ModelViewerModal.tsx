import { useState, useEffect } from 'react';
import { X, ExternalLink, Box, Code2, Loader2, Layers, Check } from 'lucide-react';
import { ModelViewer } from './ModelViewer';
import { GcodeViewer } from './GcodeViewer';
import { Button } from './Button';
import { api } from '../api/client';
import { openInSlicer } from '../utils/slicer';
import type { ArchivePlatesResponse, LibraryFilePlatesResponse, PlateMetadata } from '../types/plates';

type ViewTab = '3d' | 'gcode';

interface ModelViewerModalProps {
  archiveId?: number;
  libraryFileId?: number;
  title: string;
  fileType?: string;
  onClose: () => void;
}

interface Capabilities {
  has_model: boolean;
  has_gcode: boolean;
  has_source: boolean;
  build_volume: { x: number; y: number; z: number };
  filament_colors: string[];
}

export function ModelViewerModal({ archiveId, libraryFileId, title, fileType, onClose }: ModelViewerModalProps) {
  const isLibrary = libraryFileId != null;
  const [activeTab, setActiveTab] = useState<ViewTab | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [platesData, setPlatesData] = useState<ArchivePlatesResponse | LibraryFilePlatesResponse | null>(null);
  const [platesLoading, setPlatesLoading] = useState(false);
  const [selectedPlateId, setSelectedPlateId] = useState<number | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);

    if (isLibrary) {
      const normalizedType = (fileType || '').toLowerCase();
      const hasModel = normalizedType === '3mf' || normalizedType === 'stl';
      const hasGcode = normalizedType === 'gcode' || normalizedType === '3mf';
      setCapabilities({
        has_model: hasModel,
        has_gcode: hasGcode,
        has_source: false,
        build_volume: { x: 256, y: 256, z: 256 },
        filament_colors: [],
      });
      setActiveTab(hasModel ? '3d' : hasGcode ? 'gcode' : null);
      setLoading(false);
      return;
    }

    if (!archiveId) {
      setCapabilities(null);
      setActiveTab(null);
      setLoading(false);
      return;
    }

    api.getArchiveCapabilities(archiveId)
      .then(caps => {
        setCapabilities(caps);
        // Auto-select the first available tab
        if (caps.has_model) {
          setActiveTab('3d');
        } else if (caps.has_gcode) {
          setActiveTab('gcode');
        }
        setLoading(false);
      })
      .catch(() => {
        // Fallback to 3D model tab if capabilities check fails
        setCapabilities({ has_model: true, has_gcode: false, has_source: false, build_volume: { x: 256, y: 256, z: 256 }, filament_colors: [] });
        setActiveTab('3d');
        setLoading(false);
      });
  }, [archiveId, fileType, isLibrary]);

  useEffect(() => {
    setPlatesLoading(true);
    setSelectedPlateId(null);

    if (isLibrary) {
      const normalizedType = (fileType || '').toLowerCase();
      if (!libraryFileId || normalizedType !== '3mf') {
        setPlatesData(null);
        setPlatesLoading(false);
        return;
      }
      api.getLibraryFilePlates(libraryFileId)
        .then((data) => setPlatesData(data))
        .catch(() => setPlatesData(null))
        .finally(() => setPlatesLoading(false));
      return;
    }

    if (!archiveId) {
      setPlatesData(null);
      setPlatesLoading(false);
      return;
    }

    api.getArchivePlates(archiveId)
      .then((data) => setPlatesData(data))
      .catch(() => setPlatesData(null))
      .finally(() => setPlatesLoading(false));
  }, [archiveId, fileType, isLibrary, libraryFileId]);

  const plates = platesData?.plates ?? [];
  const hasMultiplePlates = (platesData?.is_multi_plate ?? false) && plates.length > 1;
  const selectedPlate: PlateMetadata | null = selectedPlateId == null
    ? null
    : plates.find((plate) => plate.index === selectedPlateId) ?? null;

  const canOpenInSlicer = isLibrary ? (fileType || '').toLowerCase() === '3mf' : true;

  const handleOpenInSlicer = () => {
    if (!canOpenInSlicer) return;
    // URL must include .3mf filename for Bambu Studio to recognize the format
    const filename = title || 'model';
    if (isLibrary) {
      const downloadUrl = `${window.location.origin}${api.getLibraryFileDownloadUrl(libraryFileId!)}`;
      openInSlicer(downloadUrl);
      return;
    }
    const downloadUrl = `${window.location.origin}${api.getArchiveForSlicer(archiveId!, filename)}`;
    openInSlicer(downloadUrl);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div
        className="bg-bambu-dark-secondary rounded-xl border border-bambu-dark-tertiary w-full max-w-4xl h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bambu-dark-tertiary">
          <h2 className="text-lg font-semibold text-white truncate flex-1 mr-4">{title}</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleOpenInSlicer} disabled={!canOpenInSlicer}>
              <ExternalLink className="w-4 h-4" />
              Open in Slicer
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs - only show if we have capabilities */}
        {capabilities && (
          <div className="flex border-b border-bambu-dark-tertiary">
            <button
              onClick={() => capabilities.has_model && setActiveTab('3d')}
              disabled={!capabilities.has_model}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === '3d'
                  ? 'text-bambu-green border-b-2 border-bambu-green'
                  : capabilities.has_model
                    ? 'text-bambu-gray hover:text-white'
                    : 'text-bambu-gray/30 cursor-not-allowed'
              }`}
            >
              <Box className="w-4 h-4" />
              3D Model
              {!capabilities.has_model && <span className="text-xs">(not available)</span>}
            </button>
            <button
              onClick={() => capabilities.has_gcode && setActiveTab('gcode')}
              disabled={!capabilities.has_gcode}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'gcode'
                  ? 'text-bambu-green border-b-2 border-bambu-green'
                  : capabilities.has_gcode
                    ? 'text-bambu-gray hover:text-white'
                    : 'text-bambu-gray/30 cursor-not-allowed'
              }`}
            >
              <Code2 className="w-4 h-4" />
              G-code Preview
              {!capabilities.has_gcode && <span className="text-xs">(not sliced)</span>}
            </button>
          </div>
        )}

        {/* Viewer */}
        <div className="flex-1 overflow-hidden p-4">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-bambu-green" />
            </div>
          ) : activeTab === '3d' && capabilities ? (
            <div className="w-full h-full flex flex-col gap-3">
              {hasMultiplePlates && (
                <div className="rounded-lg border border-bambu-dark-tertiary bg-bambu-dark p-3">
                  <div className="flex items-center gap-2 text-sm text-bambu-gray mb-2">
                    <Layers className="w-4 h-4" />
                    Plates
                    {platesLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlateId(null)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                        selectedPlateId == null
                          ? 'border-bambu-green bg-bambu-green/10'
                          : 'border-bambu-dark-tertiary bg-bambu-dark-secondary hover:border-bambu-gray'
                      }`}
                    >
                      <div className="w-10 h-10 rounded bg-bambu-dark-tertiary flex items-center justify-center">
                        <Layers className="w-5 h-5 text-bambu-gray" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">All Plates</p>
                        <p className="text-xs text-bambu-gray truncate">
                          {plates.length} plate{plates.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {selectedPlateId == null && (
                        <Check className="w-4 h-4 text-bambu-green flex-shrink-0" />
                      )}
                    </button>
                    {plates.map((plate) => (
                      <button
                        key={plate.index}
                        type="button"
                        onClick={() => setSelectedPlateId(plate.index)}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                          selectedPlateId === plate.index
                            ? 'border-bambu-green bg-bambu-green/10'
                            : 'border-bambu-dark-tertiary bg-bambu-dark-secondary hover:border-bambu-gray'
                        }`}
                      >
                        {plate.has_thumbnail && plate.thumbnail_url ? (
                          <img
                            src={plate.thumbnail_url}
                            alt={`Plate ${plate.index}`}
                            className="w-10 h-10 rounded object-cover bg-bambu-dark-tertiary"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-bambu-dark-tertiary flex items-center justify-center">
                            <Layers className="w-5 h-5 text-bambu-gray" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white font-medium truncate">
                            {plate.name || `Plate ${plate.index}`}
                          </p>
                          <p className="text-xs text-bambu-gray truncate">
                            {plate.objects.length > 0
                              ? plate.objects.slice(0, 2).join(', ') + (plate.objects.length > 2 ? '…' : '')
                              : `${plate.filaments.length} filament${plate.filaments.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        {selectedPlateId === plate.index && (
                          <Check className="w-4 h-4 text-bambu-green flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedPlate && (
                    <div className="mt-3 text-xs text-bambu-gray flex flex-wrap gap-x-4 gap-y-1">
                      <span>Plate {selectedPlate.index}</span>
                      {selectedPlate.print_time_seconds != null && (
                        <span>ETA {Math.round(selectedPlate.print_time_seconds / 60)} min</span>
                      )}
                      {selectedPlate.filament_used_grams != null && (
                        <span>{selectedPlate.filament_used_grams.toFixed(1)} g</span>
                      )}
                      {selectedPlate.filaments.length > 0 && (
                        <span>{selectedPlate.filaments.length} filament{selectedPlate.filaments.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1">
                  <ModelViewer
                    url={isLibrary
                      ? api.getLibraryFileDownloadUrl(libraryFileId!)
                      : (capabilities.has_source
                        ? api.getSource3mfDownloadUrl(archiveId!)
                        : api.getArchiveDownload(archiveId!))}
                    fileType={fileType}
                    buildVolume={capabilities.build_volume}
                    filamentColors={capabilities.filament_colors}
                    selectedPlateId={selectedPlateId}
                    className="w-full h-full"
                  />
              </div>
            </div>
          ) : activeTab === 'gcode' && capabilities ? (
            <GcodeViewer
              gcodeUrl={isLibrary ? api.getLibraryFileGcodeUrl(libraryFileId!) : api.getArchiveGcode(archiveId!)}
              filamentColors={capabilities.filament_colors}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-bambu-gray">
              No preview available for this file
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
