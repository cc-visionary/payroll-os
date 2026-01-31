// =============================================================================
// PeopleOS PH - Auth Refresh Provider
// =============================================================================
// Client-side component that proactively refreshes the access token before
// it expires. This runs in the background and prevents session interruptions.
// =============================================================================

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Refresh the token 2 minutes before it expires (token expires in 15 min)
const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes

// Also refresh on user activity if token is getting stale
const ACTIVITY_REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export function AuthRefreshProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(Date.now());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Function to refresh the token
    const refreshToken = async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (response.ok) {
          lastRefreshRef.current = Date.now();
        } else if (response.status === 401) {
          // Refresh failed - session expired, redirect to login
          router.push("/login");
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
      }
    };

    // Schedule periodic refresh
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        refreshToken();
        scheduleRefresh(); // Schedule next refresh
      }, REFRESH_INTERVAL_MS);
    };

    // Refresh on user activity if token is getting stale
    const handleActivity = () => {
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (timeSinceLastRefresh >= ACTIVITY_REFRESH_THRESHOLD_MS) {
        refreshToken();
      }
    };

    // Start periodic refresh
    scheduleRefresh();

    // Listen for user activity
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Refresh when tab becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
        if (timeSinceLastRefresh >= ACTIVITY_REFRESH_THRESHOLD_MS) {
          refreshToken();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return <>{children}</>;
}
