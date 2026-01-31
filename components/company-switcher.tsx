"use client";

// =============================================================================
// PeopleOS PH - Company Switcher Component
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserCompanyInfo } from "@/lib/auth/types";

interface CompanySwitcherProps {
  currentCompanyId: string;
  companies: UserCompanyInfo[];
}

export function CompanySwitcher({ currentCompanyId, companies }: CompanySwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find current company
  const currentCompany = companies.find((c) => c.id === currentCompanyId);

  // Don't show switcher if user only has access to one company
  if (companies.length <= 1) {
    return (
      <span className="text-sm font-medium text-gray-700">
        {currentCompany?.name || "Unknown Company"}
      </span>
    );
  }

  const handleSwitch = async (companyId: string) => {
    if (companyId === currentCompanyId) {
      setIsOpen(false);
      return;
    }

    setError(null);

    try {
      const response = await fetch("/api/auth/switch-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to switch company");
        return;
      }

      // Refresh the page to load new company data
      startTransition(() => {
        router.refresh();
        setIsOpen(false);
      });
    } catch {
      setError("Failed to switch company");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isPending}
      >
        <span>{currentCompany?.name || "Select Company"}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 z-20 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="py-1">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Switch Company
              </div>

              {error && (
                <div className="px-4 py-2 text-sm text-red-600">{error}</div>
              )}

              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleSwitch(company.id)}
                  disabled={isPending}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                    company.id === currentCompanyId
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  <span>{company.name}</span>
                  {company.id === currentCompanyId && (
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {company.isDefault && company.id !== currentCompanyId && (
                    <span className="text-xs text-gray-400">(Default)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-md">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
