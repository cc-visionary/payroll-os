// =============================================================================
// PeopleOS PH - Dashboard Layout
// =============================================================================

import { requireAuth } from "@/lib/auth";
import Link from "next/link";
import { CompanySwitcher } from "@/components/company-switcher";
import { Navbar, MobileNav } from "@/components/navbar";
import { UpdateAnnouncementBar } from "@/components/update-announcement-bar";
import { AuthRefreshProvider } from "@/components/auth-refresh-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <AuthRefreshProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Update Announcement Bar */}
        <UpdateAnnouncementBar />

        {/* Top Navigation */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-4">
                {/* Logo */}
                <Link href="/dashboard" className="text-xl font-bold text-blue-600">
                  PeopleOS
                </Link>

                {/* Main Navigation */}
                <Navbar />

                {/* Mobile Navigation */}
                <MobileNav />
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-4">
                {/* Company Switcher */}
                <CompanySwitcher
                  currentCompanyId={session.user.companyId}
                  companies={session.user.companies}
                />

                {/* Divider */}
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />

                <span className="text-sm text-gray-500 hidden md:inline">{session.user.email}</span>
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Logout
                  </button>
                </form>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AuthRefreshProvider>
  );
}
