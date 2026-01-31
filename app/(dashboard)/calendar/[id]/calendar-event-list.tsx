"use client";

// =============================================================================
// PeopleOS PH - Calendar Event List Component
// =============================================================================

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteCalendarEvent } from "@/app/actions/calendar";
import { EditEventModal } from "./edit-event-modal";

interface CalendarEvent {
  id: string;
  date: Date;
  name: string;
  dayType: string;
}

interface CalendarEventListProps {
  events: CalendarEvent[];
  eventsByMonth: Record<string, CalendarEvent[]>;
}

const DAY_TYPE_CONFIG: Record<
  string,
  { label: string; variant: "danger" | "warning" | "info" | "default" }
> = {
  REGULAR_HOLIDAY: { label: "Regular Holiday", variant: "danger" },
  SPECIAL_HOLIDAY: { label: "Special Holiday", variant: "warning" },
  SPECIAL_WORKING: { label: "Special Working Day", variant: "info" },
};

export function CalendarEventList({
  events,
  eventsByMonth,
}: CalendarEventListProps) {
  const [isPending, startTransition] = useTransition();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const handleDelete = (eventId: string, eventName: string) => {
    if (
      !confirm(
        `Delete "${eventName}"? This may affect attendance calculations for unlocked records.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCalendarEvent(eventId);
      if (!result.success) {
        alert(result.error || "Failed to delete event");
      }
    });
  };

  const months = Object.keys(eventsByMonth);

  return (
    <>
      <div className="space-y-6">
        {months.map((month) => (
          <div key={month}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 sticky top-0 bg-white py-2 border-b">
              {month}
            </h3>
            <div className="space-y-2">
              {eventsByMonth[month].map((event) => {
                const config = DAY_TYPE_CONFIG[event.dayType] || {
                  label: event.dayType,
                  variant: "default" as const,
                };

                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {event.date.getDate()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {event.date.toLocaleDateString("en-US", {
                            weekday: "short",
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {event.name}
                        </div>
                        <Badge variant={config.variant} className="mt-1">
                          {config.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingEvent(event)}
                        disabled={isPending}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(event.id, event.name)}
                        disabled={isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </>
  );
}
