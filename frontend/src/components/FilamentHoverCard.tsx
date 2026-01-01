import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Droplets } from 'lucide-react';

interface FilamentData {
  vendor: 'Bambu Lab' | 'Generic';
  profile: string;
  colorName: string;
  colorHex: string | null;
  kFactor: string;
  fillLevel: number | null; // null = unknown
}

interface FilamentHoverCardProps {
  data: FilamentData;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A hover card that displays filament details when hovering over AMS slots.
 * Replaces the basic browser tooltip with a styled popover.
 */
export function FilamentHoverCard({ data, children, disabled, className = '' }: FilamentHoverCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate position when showing
  useEffect(() => {
    if (isVisible && triggerRef.current && cardRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const cardHeight = cardRef.current.offsetHeight;
      const spaceAbove = triggerRect.top;
      const spaceBelow = window.innerHeight - triggerRect.bottom;

      // Prefer top, but flip to bottom if not enough space
      if (spaceAbove < cardHeight + 12 && spaceBelow > spaceAbove) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [isVisible]);

  const handleMouseEnter = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Small delay to prevent flicker on quick mouse movements
    timeoutRef.current = setTimeout(() => setIsVisible(true), 80);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(false), 100);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Get fill bar color based on percentage
  const getFillColor = (fill: number): string => {
    if (fill <= 15) return '#ef4444'; // red
    if (fill <= 30) return '#f97316'; // orange
    if (fill <= 50) return '#eab308'; // yellow
    return '#22c55e'; // green
  };

  // Determine if color is light (for text contrast on swatch)
  const isLightColor = (hex: string | null): boolean => {
    if (!hex) return false;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  };

  const colorHex = data.colorHex ? `#${data.colorHex.replace('#', '')}` : null;

  return (
    <div
      ref={triggerRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {/* Hover Card */}
      {isVisible && (
        <div
          ref={cardRef}
          className={`
            absolute left-1/2 -translate-x-1/2 z-50
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            animate-in fade-in-0 zoom-in-95 duration-150
          `}
          style={{
            // Ensure card doesn't go off-screen horizontally
            maxWidth: 'calc(100vw - 24px)',
          }}
        >
          {/* Card container */}
          <div className="
            w-52 bg-bambu-dark-secondary border border-bambu-dark-tertiary
            rounded-lg shadow-xl overflow-hidden
            backdrop-blur-sm
          ">
            {/* Color swatch header - the hero element */}
            <div
              className="h-12 relative overflow-hidden"
              style={{
                backgroundColor: colorHex || '#3d3d3d',
              }}
            >
              {/* Subtle gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />

              {/* Color name on swatch */}
              <div className={`
                absolute inset-0 flex items-center justify-center
                font-semibold text-sm tracking-wide
                ${isLightColor(colorHex) ? 'text-black/80' : 'text-white/90'}
              `}>
                {data.colorName}
              </div>

              {/* Vendor badge - solid background for visibility on any color */}
              <div className={`
                absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider
                ${data.vendor === 'Bambu Lab'
                  ? 'bg-black/60 text-white'
                  : 'bg-black/50 text-white/90'}
              `}>
                {data.vendor === 'Bambu Lab' ? 'BBL' : 'GEN'}
              </div>
            </div>

            {/* Details section */}
            <div className="p-3 space-y-2.5">
              {/* Profile name */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-bambu-gray font-medium">
                  Profile
                </span>
                <span className="text-xs text-white font-semibold truncate max-w-[120px]">
                  {data.profile}
                </span>
              </div>

              {/* K Factor */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-bambu-gray font-medium">
                  K Factor
                </span>
                <span className="text-xs text-bambu-green font-mono font-bold">
                  {data.kFactor}
                </span>
              </div>

              {/* Fill Level */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-bambu-gray font-medium flex items-center gap-1">
                    <Droplets className="w-3 h-3" />
                    Fill
                  </span>
                  <span className="text-xs text-white font-semibold">
                    {data.fillLevel !== null ? `${data.fillLevel}%` : '—'}
                  </span>
                </div>
                {/* Fill bar */}
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                  {data.fillLevel !== null ? (
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${data.fillLevel}%`,
                        backgroundColor: getFillColor(data.fillLevel),
                      }}
                    />
                  ) : (
                    <div className="h-full w-full bg-bambu-gray/30 rounded-full" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Arrow pointer */}
          <div
            className={`
              absolute left-1/2 -translate-x-1/2 w-0 h-0
              border-l-[6px] border-l-transparent
              border-r-[6px] border-r-transparent
              ${position === 'top'
                ? 'top-full border-t-[6px] border-t-bambu-dark-tertiary'
                : 'bottom-full border-b-[6px] border-b-bambu-dark-tertiary'}
            `}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper for empty slots - just shows "Empty" on hover
 */
export function EmptySlotHoverCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(true), 80);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(false), 100);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div className="
          absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50
          animate-in fade-in-0 zoom-in-95 duration-150
        ">
          <div className="
            px-3 py-1.5 bg-bambu-dark-secondary border border-bambu-dark-tertiary
            rounded-md shadow-lg text-xs text-bambu-gray whitespace-nowrap
          ">
            Empty slot
          </div>
          <div className="
            absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
            border-l-[5px] border-l-transparent
            border-r-[5px] border-r-transparent
            border-t-[5px] border-t-bambu-dark-tertiary
          " />
        </div>
      )}
    </div>
  );
}
