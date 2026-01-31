"use client";

import { useState, useEffect, useCallback } from "react";
import type { DownloadProgress } from "@/lib/electron.d";

interface UpdateInfo {
  available: boolean;
  version?: string;
  releaseNotes?: string;
  releaseDate?: string;
  error?: string;
}

export function useAppVersion() {
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isElectron = typeof window !== "undefined" && !!window.electron;

  useEffect(() => {
    if (!isElectron) {
      // Fallback for web: read from env
      setCurrentVersion(process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0");
      return;
    }

    // Get current version from Electron
    window.electron!.getAppVersion().then(setCurrentVersion);

    // Set up update listeners
    window.electron!.onUpdateAvailable((info) => {
      setUpdateInfo({ available: true, ...info });
    });

    window.electron!.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    window.electron!.onUpdateDownloaded(() => {
      setIsDownloading(false);
      setIsUpdateReady(true);
    });

    window.electron!.onUpdateError((err) => {
      setError(err);
      setIsChecking(false);
      setIsDownloading(false);
    });

    // Cleanup
    return () => {
      if (window.electron) {
        window.electron.removeAllListeners("update-available");
        window.electron.removeAllListeners("download-progress");
        window.electron.removeAllListeners("update-downloaded");
        window.electron.removeAllListeners("update-error");
      }
    };
  }, [isElectron]);

  const checkForUpdates = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    if (!isElectron) {
      // Web fallback: check via API
      try {
        const response = await fetch("/api/version/check");
        const data = await response.json();
        setUpdateInfo(data);
      } catch (err) {
        setError("Failed to check for updates");
      } finally {
        setIsChecking(false);
      }
      return;
    }

    try {
      const result = await window.electron!.checkForUpdates();
      setUpdateInfo(result);
    } catch (err) {
      setError("Failed to check for updates");
    } finally {
      setIsChecking(false);
    }
  }, [isElectron]);

  const downloadUpdate = useCallback(async () => {
    if (!isElectron || !updateInfo?.available) return;

    setIsDownloading(true);
    setDownloadProgress(null);
    try {
      await window.electron!.downloadUpdate();
    } catch (err) {
      setError("Failed to download update");
      setIsDownloading(false);
    }
  }, [isElectron, updateInfo]);

  const installUpdate = useCallback(() => {
    if (!isElectron || !isUpdateReady) return;
    window.electron!.installUpdate();
  }, [isElectron, isUpdateReady]);

  return {
    currentVersion,
    updateInfo,
    isChecking,
    isDownloading,
    downloadProgress,
    isUpdateReady,
    error,
    isElectron,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
