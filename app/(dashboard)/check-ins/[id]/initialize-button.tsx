"use client";

// =============================================================================
// PeopleOS PH - Initialize Check-Ins Button
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { initializeCheckInsForPeriod } from "@/app/actions/check-ins";

interface InitializeCheckInsButtonProps {
  periodId: string;
  periodName: string;
  variant?: "outline" | "primary";
}

export function InitializeCheckInsButton({
  periodId,
  periodName,
  variant = "outline",
}: InitializeCheckInsButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    created?: number;
    skipped?: number;
    error?: string;
  } | null>(null);

  const handleInitialize = () => {
    startTransition(async () => {
      const res = await initializeCheckInsForPeriod(periodId);
      setResult(res);
      if (res.success) {
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button variant={variant === "primary" ? "primary" : "outline"} onClick={() => setIsOpen(true)}>
        Initialize Check-Ins
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setResult(null);
        }}
        title="Initialize Check-Ins"
        size="md"
      >
        {result ? (
          <div className="space-y-4">
            {result.success ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    Check-ins initialized successfully!
                  </p>
                  <ul className="mt-2 text-sm text-green-700 space-y-1">
                    <li>Created: {result.created} new check-ins</li>
                    <li>Skipped: {result.skipped} (already existed)</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{result.error}</p>
              </div>
            )}
            <ModalFooter>
              <Button onClick={() => { setIsOpen(false); setResult(null); }}>
                Close
              </Button>
            </ModalFooter>
          </div>
        ) : (
          <>
            <p className="text-gray-600">
              This will create check-in records for all active employees in the period{" "}
              <strong>{periodName}</strong>.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Employees who already have check-ins will be skipped.
            </p>

            <ModalFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInitialize} loading={isPending}>
                Initialize
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}
