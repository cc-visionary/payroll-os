// =============================================================================
// PeopleOS PH - Universal Progress Loader Component
// =============================================================================

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ProgressState {
  isActive: boolean;
  title: string;
  message?: string;
  current?: number;
  total?: number;
  percentage?: number;
}

interface ProgressLoaderProps {
  state: ProgressState;
  className?: string;
}

export function ProgressLoader({ state, className }: ProgressLoaderProps) {
  if (!state.isActive) return null;

  const hasProgress = state.total !== undefined && state.current !== undefined;
  const percentage = state.percentage ?? (hasProgress ? Math.round((state.current! / state.total!) * 100) : undefined);

  return (
    <div className={cn("fixed inset-0 bg-black/50 flex items-center justify-center z-50", className)}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        {/* Spinner */}
        <div className="flex justify-center mb-4">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
          {state.title}
        </h3>

        {/* Message */}
        {state.message && (
          <p className="text-sm text-gray-600 text-center mb-3">
            {state.message}
          </p>
        )}

        {/* Progress bar */}
        {percentage !== undefined && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>
                {hasProgress ? `${state.current}/${state.total}` : `${percentage}%`}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing progress state
export function useProgressLoader(initialTitle = "Loading...") {
  const [state, setState] = useState<ProgressState>({
    isActive: false,
    title: initialTitle,
  });

  const start = (title: string, message?: string) => {
    setState({
      isActive: true,
      title,
      message,
      current: undefined,
      total: undefined,
      percentage: undefined,
    });
  };

  const updateProgress = (current: number, total: number, message?: string) => {
    setState((prev) => ({
      ...prev,
      current,
      total,
      message: message ?? prev.message,
    }));
  };

  const updateMessage = (message: string) => {
    setState((prev) => ({
      ...prev,
      message,
    }));
  };

  const finish = () => {
    setState((prev) => ({
      ...prev,
      isActive: false,
    }));
  };

  return {
    state,
    start,
    updateProgress,
    updateMessage,
    finish,
  };
}
