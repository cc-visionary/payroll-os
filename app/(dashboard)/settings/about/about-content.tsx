"use client";

import { useAppVersion } from "@/lib/hooks/useAppVersion";
import { Button } from "@/components/ui/button";

export function AboutContent() {
  const {
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
  } = useAppVersion();

  return (
    <div className="space-y-6">
      {/* Version Info */}
      <div>
        <h3 className="text-sm font-medium text-gray-500">Current Version</h3>
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          v{currentVersion || "0.1.0"}
        </p>
      </div>

      {/* Environment Info */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isElectron ? "bg-green-500" : "bg-blue-500"}`} />
          <span className="text-sm text-gray-600">
            {isElectron ? "Desktop Application" : "Web Application"}
          </span>
        </div>
      </div>

      {/* Update Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Updates</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {!updateInfo && !isChecking && (
          <Button onClick={checkForUpdates} disabled={isChecking}>
            Check for Updates
          </Button>
        )}

        {isChecking && (
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Checking for updates...</span>
          </div>
        )}

        {updateInfo && !updateInfo.available && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>You are running the latest version</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={checkForUpdates}
            >
              Check Again
            </Button>
          </div>
        )}

        {updateInfo?.available && updateInfo.version && !isUpdateReady && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-blue-700 mb-3">
              <p className="font-medium">New version available: v{updateInfo.version}</p>
              {updateInfo.releaseNotes && (
                <p className="text-sm mt-1 text-blue-600 whitespace-pre-wrap">
                  {typeof updateInfo.releaseNotes === "string"
                    ? updateInfo.releaseNotes
                    : JSON.stringify(updateInfo.releaseNotes)}
                </p>
              )}
            </div>

            {isDownloading ? (
              <div>
                <div className="flex justify-between text-sm text-blue-600 mb-1">
                  <span>Downloading...</span>
                  <span>{downloadProgress?.percent?.toFixed(0) || 0}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${downloadProgress?.percent || 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <Button onClick={downloadUpdate}>Download Update</Button>
            )}
          </div>
        )}

        {isUpdateReady && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 font-medium mb-3">
              Update downloaded and ready to install!
            </p>
            <Button onClick={installUpdate}>
              Restart and Install
            </Button>
          </div>
        )}

        {/* Web version message */}
        {!isElectron && (
          <p className="text-sm text-gray-500 mt-4">
            To use auto-updates, download the desktop application.
          </p>
        )}
      </div>

      {/* Credits */}
      <div className="border-t pt-6 text-sm text-gray-500">
        <p>PeopleOS Payroll - Philippine Payroll System</p>
        <p className="mt-1">Built with Next.js, Prisma, and Electron</p>
      </div>
    </div>
  );
}
