// =============================================================================
// PeopleOS PH - Electron Preload Script
// =============================================================================
// Exposes a safe API to the renderer process via contextBridge.
// This is the only way renderer can communicate with main process.
// =============================================================================

import { contextBridge, ipcRenderer } from "electron";

// Define the API that will be exposed to the renderer
const electronAPI = {
  // ==========================================================================
  // Version & Updates
  // ==========================================================================

  /**
   * Get the current app version from Electron
   */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke("get-app-version");
  },

  /**
   * Check for available updates
   */
  checkForUpdates: (): Promise<{
    available: boolean;
    version?: string;
    releaseNotes?: string;
    releaseDate?: string;
    error?: string;
  }> => {
    return ipcRenderer.invoke("check-for-updates");
  },

  /**
   * Download the available update
   */
  downloadUpdate: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("download-update");
  },

  /**
   * Install the downloaded update and restart
   */
  installUpdate: (): void => {
    ipcRenderer.invoke("install-update");
  },

  // ==========================================================================
  // External Links
  // ==========================================================================

  /**
   * Open a URL in the default browser
   */
  openExternal: (url: string): Promise<void> => {
    return ipcRenderer.invoke("open-external", url);
  },

  // ==========================================================================
  // Update Event Listeners
  // ==========================================================================

  /**
   * Listen for update available event
   */
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string; releaseDate?: string }) => void): void => {
    ipcRenderer.on("update-available", (_, info) => callback(info));
  },

  /**
   * Listen for update downloaded event
   */
  onUpdateDownloaded: (callback: (info: { version: string; releaseNotes?: string }) => void): void => {
    ipcRenderer.on("update-downloaded", (_, info) => callback(info));
  },

  /**
   * Listen for download progress updates
   */
  onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void): void => {
    ipcRenderer.on("download-progress", (_, progress) => callback(progress));
  },

  /**
   * Listen for update errors
   */
  onUpdateError: (callback: (error: string) => void): void => {
    ipcRenderer.on("update-error", (_, error) => callback(error));
  },

  /**
   * Remove all listeners for a specific channel
   */
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electron", electronAPI);

// Type export for use in renderer
export type ElectronAPI = typeof electronAPI;
