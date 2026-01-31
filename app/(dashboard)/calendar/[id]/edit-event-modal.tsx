"use client";

// =============================================================================
// PeopleOS PH - Edit Event Modal
// =============================================================================

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { updateCalendarEvent } from "@/app/actions/calendar";

interface CalendarEvent {
  id: string;
  date: Date;
  name: string;
  dayType: string;
}

interface EditEventModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

const DAY_TYPE_OPTIONS = [
  { value: "REGULAR_HOLIDAY", label: "Regular Holiday (200%)" },
  { value: "SPECIAL_HOLIDAY", label: "Special Holiday (130%)" },
  { value: "SPECIAL_WORKING", label: "Special Working Day" },
];

export function EditEventModal({ event, onClose }: EditEventModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const name = formData.get("name") as string;
    const dayType = formData.get("dayType") as "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | "SPECIAL_WORKING" | undefined;

    if (!name || !dayType) {
      setError("All fields are required");
      return;
    }

    startTransition(async () => {
      const result = await updateCalendarEvent(event.id, {
        name,
        dayType,
      });

      if (result.success) {
        onClose();
      } else {
        setError(result.error || "Failed to update event");
      }
    });
  };

  // Format date for input default value
  const dateValue = event.date.toISOString().split("T")[0];
  const year = event.date.getFullYear();
  const minDate = `${year}-01-01`;
  const maxDate = `${year}-12-31`;

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Calendar Event">
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
            defaultValue={dateValue}
            required
          />

          <Input
            label="Event Name"
            name="name"
            defaultValue={event.name}
            required
          />

          <Select
            label="Day Type"
            name="dayType"
            options={DAY_TYPE_OPTIONS}
            defaultValue={event.dayType}
            required
          />
        </div>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            Save Changes
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
