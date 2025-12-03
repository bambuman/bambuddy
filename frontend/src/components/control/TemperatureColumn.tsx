import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Printer, PrinterStatus } from '../../api/client';
import { AirConditionModal } from './AirConditionModal';
import { SpeedModal } from './SpeedModal';

interface Temperatures {
  bed?: number;
  bed_target?: number;
  bed_heating?: boolean;
  nozzle?: number;
  nozzle_target?: number;
  nozzle_heating?: boolean;
  nozzle_2?: number;
  nozzle_2_target?: number;
  nozzle_2_heating?: boolean;
  chamber?: number;
  chamber_target?: number;
  chamber_heating?: boolean;
}

interface TemperatureColumnProps {
  printer: Printer;
  status: PrinterStatus | null | undefined;
  disabled?: boolean;
}

type EditingField = 'nozzle' | 'nozzle_2' | 'bed' | 'chamber' | null;

export function TemperatureColumn({ printer, status, disabled = false }: TemperatureColumnProps) {
  const temps = (status?.temperatures ?? {}) as Temperatures;
  const isDualNozzle = printer.nozzle_count > 1;
  const isConnected = (status?.connected ?? false) && !disabled;

  const [editing, setEditing] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');
  const [showAirConditionModal, setShowAirConditionModal] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);

  const bedMutation = useMutation({
    mutationFn: (target: number) => api.setBedTemperature(printer.id, target),
  });

  const nozzleMutation = useMutation({
    mutationFn: ({ target, nozzle }: { target: number; nozzle: number }) =>
      api.setNozzleTemperature(printer.id, target, nozzle),
  });

  const chamberMutation = useMutation({
    mutationFn: (target: number) => api.setChamberTemperature(printer.id, target),
  });

  const lightMutation = useMutation({
    mutationFn: (on: boolean) => api.setChamberLight(printer.id, on),
  });

  const startEditing = (field: EditingField, currentValue: number) => {
    if (!isConnected) return;
    setEditing(field);
    setEditValue(String(Math.round(currentValue)));
  };

  const cancelEditing = () => {
    setEditing(null);
    setEditValue('');
  };

  const submitEdit = () => {
    const target = parseInt(editValue, 10);
    if (isNaN(target) || target < 0) {
      cancelEditing();
      return;
    }

    if (editing === 'bed') {
      bedMutation.mutate(target);
    } else if (editing === 'nozzle') {
      // nozzle field = LEFT nozzle display
      // H2D: LEFT is T1 (index 1), single nozzle: index 0
      nozzleMutation.mutate({ target, nozzle: isDualNozzle ? 1 : 0 });
    } else if (editing === 'nozzle_2') {
      // nozzle_2 field = RIGHT nozzle display
      // H2D: RIGHT is T0/default (index 0)
      nozzleMutation.mutate({ target, nozzle: 0 });
    } else if (editing === 'chamber') {
      chamberMutation.mutate(target);
    }
    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const isDisabled = !isConnected;

  // Use live heating state from MQTT
  const isNozzleHeating = temps.nozzle_heating ?? false;
  const isNozzle2Heating = temps.nozzle_2_heating ?? false;
  const isBedHeating = temps.bed_heating ?? false;
  const isChamberHeating = temps.chamber_heating ?? false;

  const renderTargetTemp = (
    field: EditingField,
    targetValue: number
  ) => {
    if (editing === field) {
      return (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={editValue}
          onChange={(e) => {
            // Only allow numeric input
            const val = e.target.value.replace(/[^0-9]/g, '');
            setEditValue(val);
          }}
          onBlur={submitEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-12 text-sm bg-bambu-dark border border-bambu-green rounded px-1 py-0.5 text-white text-center [appearance:textfield]"
        />
      );
    }
    return (
      <button
        onClick={() => startEditing(field, targetValue)}
        disabled={isDisabled}
        className="text-sm text-bambu-gray hover:text-bambu-green disabled:hover:text-bambu-gray disabled:cursor-not-allowed"
        title={isDisabled ? 'Printer not connected' : 'Click to set target temperature'}
      >
        /{Math.round(targetValue)} °C
      </button>
    );
  };

  return (
    <>
    <div className="flex flex-col justify-evenly min-w-[150px] pr-5 border-r border-bambu-dark-tertiary">
      {/* Nozzle 1 (Left) */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <img
            src="/icons/hotend.svg"
            alt=""
            className={`w-5 ${isNozzleHeating ? 'icon-heating' : 'icon-theme'}`}
          />
        </div>
        {isDualNozzle && (
          <span className="text-[11px] font-semibold text-bambu-green bg-bambu-green/20 px-1.5 py-0.5 rounded min-w-[18px] text-center flex-shrink-0">
            L
          </span>
        )}
        <span className="text-lg font-medium text-white">{Math.round(temps.nozzle ?? 0)}</span>
        {renderTargetTemp('nozzle', temps.nozzle_target ?? 0)}
      </div>

      {/* Nozzle 2 (Right) - only for dual nozzle */}
      {isDualNozzle && (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <img
              src="/icons/hotend.svg"
              alt=""
              className={`w-5 ${isNozzle2Heating ? 'icon-heating' : 'icon-theme'}`}
            />
          </div>
          <span className="text-[11px] font-semibold text-bambu-green bg-bambu-green/20 px-1.5 py-0.5 rounded min-w-[18px] text-center flex-shrink-0">
            R
          </span>
          <span className="text-lg font-medium text-white">{Math.round(temps.nozzle_2 ?? 0)}</span>
          {renderTargetTemp('nozzle_2', temps.nozzle_2_target ?? 0)}
        </div>
      )}

      {/* Bed */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <img
            src="/icons/heatbed.svg"
            alt=""
            className={`w-5 ${isBedHeating ? 'icon-heating' : 'icon-theme'}`}
          />
        </div>
        {isDualNozzle && <span className="min-w-[18px] flex-shrink-0" />}
        <span className="text-lg font-medium text-white">{Math.round(temps.bed ?? 0)}</span>
        {renderTargetTemp('bed', temps.bed_target ?? 0)}
      </div>

      {/* Chamber - editable target */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <img src="/icons/chamber.svg" alt="" className={`w-5 ${isChamberHeating ? 'icon-heating' : 'icon-theme'}`} />
        </div>
        {isDualNozzle && <span className="min-w-[18px] flex-shrink-0" />}
        <span className="text-lg font-medium text-white">{Math.round(temps.chamber ?? 0)}</span>
        {renderTargetTemp('chamber', temps.chamber_target ?? 0)}
      </div>

      {/* Air Condition - full width button with mode indicator */}
      <button
        onClick={() => setShowAirConditionModal(true)}
        disabled={isDisabled}
        className="flex items-center justify-between w-full px-3 py-4 rounded-md bg-bambu-dark-secondary hover:bg-bambu-dark-tertiary border border-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <img src="/icons/ventilation.svg" alt="" className="w-5 h-5 icon-theme" />
          <span className="text-xs text-bambu-gray">A/C</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          status?.airduct_mode === 1
            ? 'bg-orange-500/20 text-orange-400'
            : 'bg-blue-500/20 text-blue-400'
        }`}>
          {status?.airduct_mode === 1 ? 'Heat' : 'Cool'}
        </span>
      </button>

      {/* Speed & Lamp - half width each */}
      <div className="flex items-center gap-2">
        {/* Speed */}
        <button
          onClick={() => setShowSpeedModal(true)}
          disabled={isDisabled}
          className="flex-1 flex flex-col items-center py-2 rounded-md bg-bambu-dark-secondary hover:bg-bambu-dark-tertiary border border-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img src="/icons/speed.svg" alt="" className="w-5 h-5 icon-theme" />
          <span className="text-[10px] text-bambu-gray mt-0.5">
            {status?.speed_level === 1 ? '50%' : status?.speed_level === 3 ? '124%' : status?.speed_level === 4 ? '166%' : '100%'}
          </span>
        </button>

        {/* Lamp */}
        <button
          onClick={() => lightMutation.mutate(!(status?.chamber_light ?? false))}
          disabled={isDisabled || lightMutation.isPending}
          className="flex-1 flex flex-col items-center py-2 rounded-md bg-bambu-dark-secondary hover:bg-bambu-dark-tertiary border border-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img src="/icons/lamp.svg" alt="" className={`w-5 h-5 ${status?.chamber_light ? 'icon-green' : 'icon-theme'}`} />
          <span className="text-[10px] text-bambu-gray mt-0.5">Lamp</span>
        </button>
      </div>
    </div>

    {/* Air Condition Modal */}
    {showAirConditionModal && (
      <AirConditionModal
        printer={printer}
        status={status}
        onClose={() => setShowAirConditionModal(false)}
      />
    )}

    {/* Speed Modal */}
    {showSpeedModal && (
      <SpeedModal
        printer={printer}
        status={status}
        onClose={() => setShowSpeedModal(false)}
      />
    )}
    </>
  );
}
