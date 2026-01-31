"use client";

// =============================================================================
// PeopleOS PH - Create Calendar Modal
// =============================================================================

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { createHolidayCalendar } from "@/app/actions/calendar";

interface CreateCalendarModalProps {
  currentYear: number;
}

export function CreateCalendarModal({ currentYear }: CreateCalendarModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const year = parseInt(formData.get("year") as string, 10);
    const name = formData.get("name") as string;

    startTransition(async () => {
      const result = await createHolidayCalendar({ year, name });

      if (result.success) {
        setIsOpen(false);
      } else {
        setError(result.error || "Failed to create calendar");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create Calendar</Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Holiday Calendar">
        <form action={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
          )}

          <div className="space-y-4">
            <Input
              label="Year"
              name="year"
              type="number"
              min={currentYear - 1}
              max={currentYear + 5}
              defaultValue={currentYear}
              required
            />

            <Input
              label="Calendar Name"
              name="name"
              placeholder={`${currentYear} Holiday Calendar`}
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Create Calendar
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
