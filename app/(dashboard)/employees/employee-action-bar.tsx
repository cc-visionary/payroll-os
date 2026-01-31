"use client";

// =============================================================================
// PeopleOS PH - Employee Action Bar
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmployeeImportModal } from "./employee-import-modal";

interface EmployeeActionBarProps {
  canCreate: boolean;
}

export function EmployeeActionBar({ canCreate }: EmployeeActionBarProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canCreate && (
          <>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
              Import
            </Button>
            <Link href="/employees/new">
              <Button>Add Employee</Button>
            </Link>
          </>
        )}
      </div>

      <EmployeeImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </>
  );
}
