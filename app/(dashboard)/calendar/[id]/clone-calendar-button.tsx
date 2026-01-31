"use client";

// =============================================================================
// PeopleOS PH - Clone Calendar Button
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { cloneCalendarToYear } from "@/app/actions/calendar";

interface CloneCalendarButtonProps {
  calendarId: string;
  currentYear: number;
}

export function CloneCalendarButton({
  calendarId,
  currentYear,
}: CloneCalendarButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const targetYear = parseInt(formData.get("targetYear") as string, 10);

    if (targetYear === currentYear) {
      setError("Target year must be different from current year");
      return;
    }

    startTransition(async () => {
      const result = await cloneCalendarToYear(calendarId, targetYear);

      if (result.success && result.calendarId) {
        router.push(`/calendar/${result.calendarId}`);
      } else {
        setError(result.error || "Failed to clone calendar");
      }
    });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Clone to Year
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Clone Calendar to Another Year"
      >
        <form action={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will create a new calendar for the target year with all
              events copied. Dates will be adjusted to the same day/month in the
              new year.
            </p>

            <Input
              label="Target Year"
              name="targetYear"
              type="number"
              min={currentYear}
              max={currentYear + 5}
              defaultValue={currentYear + 1}
              required
            />

            <div className="p-3 bg-yellow-50 rounded-md text-sm text-yellow-800">
              <strong>Note:</strong> Some holidays (like Easter) have variable
              dates. You may need to adjust these manually after cloning.
            </div>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Clone Calendar
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
