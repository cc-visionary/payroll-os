"use client";

// =============================================================================
// PeopleOS PH - Hiring Action Bar
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApplicantImportModal } from "./applicant-import-modal";

interface HiringActionBarProps {
  canCreate: boolean;
}

export function HiringActionBar({ canCreate }: HiringActionBarProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canCreate && (
          <>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
              Import
            </Button>
            <Link href="/hiring/new">
              <Button>Add Applicant</Button>
            </Link>
          </>
        )}
      </div>

      <ApplicantImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </>
  );
}
