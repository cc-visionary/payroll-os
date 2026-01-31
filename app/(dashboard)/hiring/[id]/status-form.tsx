"use client";

// =============================================================================
// PeopleOS PH - Applicant Status Update Form
// =============================================================================

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { updateApplicantStatus } from "@/app/actions/hiring";

interface StatusUpdateFormProps {
  applicantId: string;
  currentStatus: string;
}

const statusOptions = [
  { value: "NEW", label: "New" },
  { value: "SCREENING", label: "Screening" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "OFFER", label: "Offer Extended" },
  { value: "OFFER_ACCEPTED", label: "Offer Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

export function StatusUpdateForm({ applicantId, currentStatus }: StatusUpdateFormProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const needsReason = selectedStatus === "REJECTED" || selectedStatus === "WITHDRAWN";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedStatus === currentStatus) {
      return;
    }

    startTransition(async () => {
      const result = await updateApplicantStatus(applicantId, {
        status: selectedStatus,
        rejectionReason: selectedStatus === "REJECTED" ? reason : undefined,
        withdrawalReason: selectedStatus === "WITHDRAWN" ? reason : undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to update status");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <Select
        label="Status"
        name="status"
        options={statusOptions}
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
      />

      {needsReason && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {selectedStatus === "REJECTED" ? "Rejection Reason" : "Withdrawal Reason"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Enter ${selectedStatus === "REJECTED" ? "rejection" : "withdrawal"} reason...`}
          />
        </div>
      )}

      <Button
        type="submit"
        loading={isPending}
        disabled={selectedStatus === currentStatus}
        className="w-full"
      >
        Update Status
      </Button>
    </form>
  );
}
