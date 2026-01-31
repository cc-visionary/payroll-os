"use client";

// =============================================================================
// PeopleOS PH - Generate Offer Letter Button
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateOfferLetter } from "@/app/actions/hiring";

interface OfferLetterButtonProps {
  applicantId: string;
  existingPath?: string | null;
}

export function OfferLetterButton({ applicantId, existingPath }: OfferLetterButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await generateOfferLetter(applicantId);

      if (result.success) {
        setSuccess("Offer letter generated successfully");
        router.refresh();
      } else {
        setError(result.error || "Failed to generate offer letter");
      }
    });
  };

  const handleDownload = () => {
    if (existingPath) {
      window.open(`/api/documents/download?path=${encodeURIComponent(existingPath)}`, "_blank");
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      )}
      {success && (
        <div className="p-2 bg-green-50 text-green-700 rounded text-sm">{success}</div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          loading={isPending}
          variant={existingPath ? "outline" : "primary"}
          className="flex-1"
        >
          {existingPath ? "Regenerate" : "Generate"} Offer Letter
        </Button>

        {existingPath && (
          <Button variant="outline" onClick={handleDownload}>
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
