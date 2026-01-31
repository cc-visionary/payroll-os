// =============================================================================
// PeopleOS PH - Version Check API
// =============================================================================
// API endpoint to check for app updates via GitHub releases.
// Used as fallback when not running in Electron.
// =============================================================================

import { NextResponse } from "next/server";

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";

// Configure your GitHub repo here
const GITHUB_OWNER = process.env.GITHUB_OWNER || "YOUR_GITHUB_USERNAME";
const GITHUB_REPO = process.env.GITHUB_REPO || "payrollos";

export async function GET() {
  try {
    // Check GitHub releases for latest version
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          // Add authorization for private repos
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
          }),
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      // No releases found or repo not accessible
      return NextResponse.json({
        available: false,
        currentVersion: CURRENT_VERSION,
        message: "Could not fetch release information",
      });
    }

    const release = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, "");

    const isNewer = compareVersions(latestVersion, CURRENT_VERSION) > 0;

    return NextResponse.json({
      available: isNewer,
      currentVersion: CURRENT_VERSION,
      version: latestVersion,
      releaseNotes: release.body,
      releaseDate: release.published_at,
      downloadUrl: release.html_url,
    });
  } catch (error) {
    console.error("Version check failed:", error);
    return NextResponse.json({
      available: false,
      currentVersion: CURRENT_VERSION,
      error: "Failed to check for updates",
    });
  }
}

/**
 * Compare two semantic version strings.
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}
