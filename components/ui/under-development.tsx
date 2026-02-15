// =============================================================================
// PeopleOS PH - Under Development Component
// =============================================================================
// Reusable placeholder for pages/features that are still being built.
// Used via layout.tsx files to block all sub-routes without modifying page code.
// =============================================================================

import Link from "next/link";
import { cn } from "@/lib/utils";

interface UnderDevelopmentProps {
  /** The name of the feature/page */
  title: string;
  /** Optional description of what the feature will do */
  description?: string;
  /** Optional icon to display above the title */
  icon?: React.ReactNode;
  /** Optional className for the outermost container */
  className?: string;
}

export function UnderDevelopment({
  title,
  description,
  icon,
  className,
}: UnderDevelopmentProps) {
  return (
    <div className={cn("flex items-center justify-center min-h-[60vh]", className)}>
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          {icon || (
            <svg
              className="h-8 w-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11.42 15.17l-5.59-5.59a8.014 8.014 0 01-.88-9.16A8.003 8.003 0 0114.33 3.6l-.81.81a6 6 0 108.49 8.49l.81-.81a8.003 8.003 0 013.18 9.38 8.014 8.014 0 01-9.16-.88l-5.59-5.59a2 2 0 010-2.83z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 9l-6 6"
              />
            </svg>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>

        {/* Badge */}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
          Under Development
        </span>

        {/* Description */}
        <p className="text-sm text-gray-500 mt-4">
          {description ||
            "This feature is currently being built. Check back soon for updates."}
        </p>

        {/* Back to Dashboard */}
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
