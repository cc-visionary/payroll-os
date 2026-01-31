"use client";

// =============================================================================
// PeopleOS PH - Add Event Modal
// =============================================================================

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { createCalendarEvent } from "@/app/actions/calendar";

interface AddEventModalProps {
  calendarId: string;
  year: number;
}

const DAY_TYPE_OPTIONS = [
  { value: "REGULAR_HOLIDAY", label: "Regular Holiday (200%)" },
  { value: "SPECIAL_HOLIDAY", label: "Special Holiday (130%)" },
  { value: "SPECIAL_WORKING", label: "Special Working Day" },
];

export function AddEventModal({ calendarId, year }: AddEventModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const date = formData.get("date") as string;
    const name = formData.get("name") as string;
    const dayType = formData.get("dayType") as "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | "SPECIAL_WORKING";
    const isNational = formData.get("isNational") === "on";

    if (!date || !name || !dayType) {
      setError("All fields are required");
      return;
    }

    startTransition(async () => {
      const result = await createCalendarEvent({
        calendarId,
        date,
        name,
        dayType,
        isNational,
      });

      if (result.success) {
        setIsOpen(false);
      } else {
        setError(result.error || "Failed to create event");
      }
    });
  };

  // Default date range for the calendar year
  const minDate = `${year}-01-01`;
  const maxDate = `${year}-12-31`;

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Add Event</Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add Calendar Event"
      >
        <form action={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Date"
              name="date"
              type="date"
              min={minDate}
              max={maxDate}
              required
            />

            <Input
              label="Event Name"
              name="name"
              placeholder="e.g., New Year's Day"
              required
            />

            <Select
              label="Day Type"
              name="dayType"
              options={DAY_TYPE_OPTIONS}
              required
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isNational"
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">National Holiday</span>
            </label>
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
              Add Event
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
