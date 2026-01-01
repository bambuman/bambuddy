/**
 * Utility for opening files in Bambu Studio slicer
 *
 * The URL protocol handler is OS-specific:
 * - Windows: bambustudio://
 * - macOS/Linux: bambustudioopen://
 */

type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

/**
 * Detect the user's operating system
 */
export function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';

  if (userAgent.includes('win') || platform.includes('win')) {
    return 'windows';
  }
  if (userAgent.includes('mac') || platform.includes('mac')) {
    return 'macos';
  }
  if (userAgent.includes('linux') || platform.includes('linux')) {
    return 'linux';
  }
  return 'unknown';
}

/**
 * Get the appropriate slicer protocol for the current OS
 */
export function getSlicerProtocol(): string {
  const platform = detectPlatform();

  switch (platform) {
    case 'windows':
      return 'bambustudio://';
    case 'macos':
    case 'linux':
    default:
      return 'bambustudioopen://';
  }
}

/**
 * Open a URL in Bambu Studio slicer
 * @param downloadUrl - The URL to the file to open (will be encoded)
 */
export function openInSlicer(downloadUrl: string): void {
  const protocol = getSlicerProtocol();
  window.location.href = `${protocol}${encodeURIComponent(downloadUrl)}`;
}

/**
 * Build a full download URL for a file
 * @param path - The API path (e.g., from api.getArchiveForSlicer())
 */
export function buildDownloadUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

/**
 * Convenience function to open an archive in the slicer
 * @param path - The API path to the archive
 */
export function openArchiveInSlicer(path: string): void {
  const downloadUrl = buildDownloadUrl(path);
  openInSlicer(downloadUrl);
}
