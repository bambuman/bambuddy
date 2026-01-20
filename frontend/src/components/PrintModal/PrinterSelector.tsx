import { Printer as PrinterIcon, Loader2, AlertCircle, Check } from 'lucide-react';
import type { PrinterSelectorProps } from './types';

/**
 * Printer selection component with grid-based UI.
 * Supports single or multi-select modes.
 */
export function PrinterSelector({
  printers,
  selectedPrinterIds,
  onMultiSelect,
  isLoading = false,
  allowMultiple = false,
  showInactive = false,
}: PrinterSelectorProps) {
  // Filter printers based on showInactive flag
  const displayPrinters = showInactive ? printers : printers.filter((p) => p.is_active);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-bambu-green animate-spin" />
      </div>
    );
  }

  if (displayPrinters.length === 0) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
        <AlertCircle className="w-4 h-4" />
        No {showInactive ? '' : 'active '}printers available
      </div>
    );
  }

  const handlePrinterClick = (printerId: number) => {
    if (allowMultiple) {
      // Multi-select mode: toggle printer in selection
      if (selectedPrinterIds.includes(printerId)) {
        onMultiSelect(selectedPrinterIds.filter((id) => id !== printerId));
      } else {
        onMultiSelect([...selectedPrinterIds, printerId]);
      }
    } else {
      // Single-select mode: replace selection
      onMultiSelect([printerId]);
    }
  };

  const handleSelectAll = () => {
    onMultiSelect(displayPrinters.map((p) => p.id));
  };

  const handleDeselectAll = () => {
    onMultiSelect([]);
  };

  const isSelected = (printerId: number) => selectedPrinterIds.includes(printerId);

  const selectedCount = selectedPrinterIds.length;

  return (
    <div className="space-y-2 mb-6">
      {/* Multi-select header */}
      {allowMultiple && displayPrinters.length > 1 && (
        <div className="flex items-center justify-between text-xs text-bambu-gray mb-2">
          <span>
            {selectedCount === 0
              ? 'Select printers'
              : `${selectedCount} printer${selectedCount !== 1 ? 's' : ''} selected`}
          </span>
          <div className="flex gap-2">
            {selectedCount < displayPrinters.length && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-bambu-green hover:text-bambu-green/80 transition-colors"
              >
                Select all
              </button>
            )}
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-bambu-gray hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {displayPrinters.map((printer) => (
        <button
          key={printer.id}
          type="button"
          onClick={() => handlePrinterClick(printer.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
            isSelected(printer.id)
              ? 'border-bambu-green bg-bambu-green/10'
              : 'border-bambu-dark-tertiary bg-bambu-dark hover:border-bambu-gray'
          } ${!printer.is_active ? 'opacity-60' : ''}`}
        >
          <div
            className={`p-2 rounded-lg ${
              isSelected(printer.id) ? 'bg-bambu-green/20' : 'bg-bambu-dark-tertiary'
            }`}
          >
            <PrinterIcon
              className={`w-5 h-5 ${
                isSelected(printer.id) ? 'text-bambu-green' : 'text-bambu-gray'
              }`}
            />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-medium">
              {printer.name}
              {!printer.is_active && <span className="text-bambu-gray text-xs ml-2">(inactive)</span>}
            </p>
            <p className="text-xs text-bambu-gray">
              {printer.model || 'Unknown model'} • {printer.ip_address}
            </p>
          </div>
          {/* Checkbox indicator for multi-select */}
          {allowMultiple && (
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected(printer.id)
                  ? 'bg-bambu-green border-bambu-green'
                  : 'border-bambu-gray/50'
              }`}
            >
              {isSelected(printer.id) && <Check className="w-3 h-3 text-white" />}
            </div>
          )}
        </button>
      ))}

      {/* Warning when no printer selected */}
      {selectedCount === 0 && (
        <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Select at least one printer
        </p>
      )}
    </div>
  );
}
