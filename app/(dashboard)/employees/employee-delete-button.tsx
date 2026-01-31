"use client";

// =============================================================================
// PeopleOS PH - Employee Separation Button Component
// =============================================================================
// Simple component to mark employees as separated. The clearance workflow
// has been removed - separation is now a direct status change.
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { separateEmployee } from "@/app/actions/employees";

interface EmployeeDeleteButtonProps {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  variant?: "button" | "icon" | "link";
}

const SEPARATION_REASONS = [
  { value: "RESIGNED", label: "Resigned" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "END_OF_CONTRACT", label: "End of Contract" },
  { value: "AWOL", label: "AWOL (Absent Without Leave)" },
  { value: "REDUNDANCY", label: "Redundancy" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "DEATH", label: "Death" },
  { value: "OTHER", label: "Other" },
];

export function EmployeeDeleteButton({
  employeeId,
  employeeName,
  employeeNumber,
  variant = "button",
}: EmployeeDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [separationType, setSeparationType] = useState("");
  const [separationReason, setSeparationReason] = useState("");
  const [separationDate, setSeparationDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Set default separation date to today
  const today = new Date().toISOString().split("T")[0];

  const handleSeparation = async () => {
    if (!separationType) {
      setError("Please select a separation type");
      return;
    }

    if (separationType === "OTHER" && !separationReason) {
      setError("Please provide a reason for separation");
      return;
    }

    if (!separationDate) {
      setError("Please select the separation date");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await separateEmployee(employeeId, {
        separationType,
        separationReason: separationType === "OTHER" ? separationReason : separationType,
        separationDate,
      });

      if (result.success) {
        setIsModalOpen(false);
        router.push(`/employees/${employeeId}`);
        router.refresh();
      } else {
        setError(result.error || "Failed to separate employee");
      }
    });
  };

  const renderButton = () => {
    switch (variant) {
      case "icon":
        return (
          <button
            onClick={() => {
              setIsModalOpen(true);
              setSeparationDate(today);
            }}
            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
            title="Separate Employee"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        );
      case "link":
        return (
          <button
            onClick={() => {
              setIsModalOpen(true);
              setSeparationDate(today);
            }}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Separate
          </button>
        );
      default:
        return (
          <Button
            variant="danger"
            onClick={() => {
              setIsModalOpen(true);
              setSeparationDate(today);
            }}
          >
            Separate Employee
          </Button>
        );
    }
  };

  return (
    <>
      {renderButton()}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Separate Employee"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium">
              Separating <strong>{employeeName}</strong> ({employeeNumber})
            </p>
            <p className="text-sm text-yellow-700 mt-2">
              This will change the employee&apos;s status and record their separation date.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Separation Type <span className="text-red-500">*</span>
            </label>
            <select
              value={separationType}
              onChange={(e) => {
                setSeparationType(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select type...</option>
              {SEPARATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {separationType === "OTHER" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specify Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={separationReason}
                onChange={(e) => {
                  setSeparationReason(e.target.value);
                  setError(null);
                }}
                placeholder="Enter the reason for separation..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Separation Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={separationDate}
              onChange={(e) => {
                setSeparationDate(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The employee&apos;s final day of employment
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSeparation}
            loading={isPending}
            disabled={!separationType || !separationDate || (separationType === "OTHER" && !separationReason)}
          >
            Confirm Separation
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
