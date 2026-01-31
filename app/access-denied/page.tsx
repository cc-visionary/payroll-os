// =============================================================================
// PeopleOS PH - Access Denied Page
// =============================================================================

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

export default async function AccessDeniedPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You don&apos;t have permission to access this page. Contact your administrator if you
          believe this is an error.
        </p>

        {/* Debug Info (dev only) */}
        {process.env.NODE_ENV === "development" && session && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg text-left text-xs">
            <p className="font-semibold mb-2">Debug Info:</p>
            <p><strong>User:</strong> {session.user.email}</p>
            <p><strong>Roles:</strong> {session.user.roles.join(", ")}</p>
            <p><strong>Permissions ({session.user.permissions.length}):</strong></p>
            <div className="max-h-32 overflow-y-auto mt-1">
              {session.user.permissions.map((p) => (
                <span key={p} className="inline-block bg-gray-200 px-1 mr-1 mb-1 rounded">{p}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button>Go to Home</Button>
          </Link>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
