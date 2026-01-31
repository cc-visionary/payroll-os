"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAppVersion } from "@/lib/hooks/useAppVersion";

export function UpdateAnnouncementBar() {
  const { updateInfo, isElectron, checkForUpdates } = useAppVersion();
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check for updates on mount
  useEffect(() => {
    if (!checked) {
      checkForUpdates();
      setChecked(true);
    }
  }, [checked, checkForUpdates]);

  // Don't show if dismissed, no update available, or no version info
  if (dismissed || !updateInfo?.available || !updateInfo?.version) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 bg-blue-500 rounded-full p-1">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
              />
            </svg>
          </span>
          <span className="text-sm font-medium">
            A new version (v{updateInfo.version}) is available!
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings/about"
            className="text-sm font-medium bg-white text-blue-600 px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
          >
            {isElectron ? "Update Now" : "View Details"}
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-blue-200 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
