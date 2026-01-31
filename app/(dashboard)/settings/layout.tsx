// =============================================================================
// PeopleOS PH - Settings Layout
// =============================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsNavItems = [
  {
    href: "/settings/departments",
    label: "Departments",
    description: "Manage company departments",
  },
  {
    href: "/settings/leave-types",
    label: "Leave Types",
    description: "Configure leave entitlements",
  },
  {
    href: "/settings/shift-templates",
    label: "Shift Templates",
    description: "Define work schedules",
  },
  {
    href: "/settings/company",
    label: "Company Info",
    description: "Company details and branding",
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your company configuration and preferences
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <nav className="w-64 flex-shrink-0">
          <ul className="space-y-1">
            {settingsNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block px-4 py-3 rounded-lg transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <div className="font-medium">{item.label}</div>
                    <div
                      className={cn(
                        "text-sm mt-0.5",
                        isActive ? "text-blue-600" : "text-gray-500"
                      )}
                    >
                      {item.description}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
