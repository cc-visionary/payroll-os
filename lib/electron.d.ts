// =============================================================================
// PeopleOS PH - Electron API Type Definitions
// =============================================================================
// Type definitions for the window.electron API exposed by preload script.
// =============================================================================

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

interface ElectronAPI {
  // Version & Updates
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{
    available: boolean;
    version?: string;
    releaseNotes?: string;
    releaseDate?: string;
    error?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;

  // External links
  openExternal: (url: string) => Promise<void>;

  // Update event listeners
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export type { ElectronAPI, UpdateInfo, DownloadProgress };
