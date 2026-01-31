"use client";

// =============================================================================
// PeopleOS PH - Day Event Modal
// =============================================================================
// Modal for viewing, adding, and editing calendar events for a specific day.
// Supports holidays, company rest days (e.g., company outings), and other events.
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/app/actions/calendar";

interface CalendarEvent {
  id: string;
  date: Date;
  name: string;
  dayType: string;
  isNational: boolean;
}

interface DayEventModalProps {
  calendarId: string;
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
}

const DAY_TYPE_OPTIONS = [
  {
    value: "REGULAR_HOLIDAY",
    label: "Regular Holiday",
    description: "200% pay for work. Paid even if not worked.",
    color: "bg-red-100 text-red-800",
  },
  {
    value: "SPECIAL_HOLIDAY",
    label: "Special Holiday",
    description: "130% pay for work. No pay if not worked.",
    color: "bg-orange-100 text-orange-800",
  },
  {
    value: "REST_DAY",
    label: "Company Rest Day",
    description: "Company outing, team building, etc. 130% if work required.",
    color: "bg-purple-100 text-purple-800",
  },
  {
    value: "SPECIAL_WORKING",
    label: "Special Working Day",
    description: "Regular pay. A swapped holiday becomes a working day.",
    color: "bg-blue-100 text-blue-800",
  },
];

const DAY_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  REGULAR_HOLIDAY: { label: "Regular Holiday", color: "bg-red-100 text-red-800" },
  SPECIAL_HOLIDAY: { label: "Special Holiday", color: "bg-orange-100 text-orange-800" },
  REST_DAY: { label: "Company Rest Day", color: "bg-purple-100 text-purple-800" },
  SPECIAL_WORKING: { label: "Special Working Day", color: "bg-blue-100 text-blue-800" },
  COMPANY_EVENT: { label: "Company Event", color: "bg-green-100 text-green-800" },
};

export function DayEventModal({
  calendarId,
  date,
  events,
  onClose,
}: DayEventModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Only allow add mode if no events exist (one event per day limit)
  const [mode, setMode] = useState<"view" | "add" | "edit">(
    events.length === 0 ? "add" : "view"
  );

  // Only one event per day is allowed
  const hasEvent = events.length > 0;
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    dayType: "SPECIAL_HOLIDAY",
    isNational: false,
  });

  const formattedDate = date.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Use local date components to avoid timezone issues
  // date.toISOString() converts to UTC which can shift the date by a day
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const resetForm = () => {
    setFormData({ name: "", dayType: "SPECIAL_HOLIDAY", isNational: false });
    setError(null);
    setSuccess(null);
  };

  const handleAdd = () => {
    resetForm();
    setMode("add");
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      dayType: event.dayType,
      isNational: event.isNational,
    });
    setError(null);
    setSuccess(null);
    setMode("edit");
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      setError("Event name is required");
      return;
    }

    setError(null);
    startTransition(async () => {
      if (mode === "add") {
        const result = await createCalendarEvent({
          calendarId,
          date: dateString,
          name: formData.name.trim(),
          dayType: formData.dayType as any,
          isNational: formData.isNational,
        });

        if (result.success) {
          setSuccess(result.warning || "Event created successfully");
          router.refresh();
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError(result.error || "Failed to create event");
        }
      } else if (mode === "edit" && editingEvent) {
        const result = await updateCalendarEvent(editingEvent.id, {
          name: formData.name.trim(),
          dayType: formData.dayType as any,
          isNational: formData.isNational,
        });

        if (result.success) {
          setSuccess("Event updated successfully");
          router.refresh();
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError(result.error || "Failed to update event");
        }
      }
    });
  };

  const handleDelete = (event: CalendarEvent) => {
    if (!confirm(`Delete "${event.name}"? This may affect attendance calculations.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCalendarEvent(event.id);
      if (result.success) {
        router.refresh();
        if (events.length === 1) {
          onClose();
        }
      } else {
        setError(result.error || "Failed to delete event");
      }
    });
  };

  return (
    <Modal isOpen onClose={onClose} title={formattedDate} size="md">
      {mode === "view" && (
        <>
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No events on this day.
              </p>
            ) : (
              events.map((event) => {
                const config = DAY_TYPE_CONFIG[event.dayType] || {
                  label: event.dayType,
                  color: "bg-gray-100 text-gray-800",
                };

                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{event.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={config.color}>{config.label}</Badge>
                        {event.isNational && (
                          <Badge variant="default">National</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(event)}
                        disabled={isPending}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(event)}
                        disabled={isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {hasEvent ? (
              <span className="text-sm text-gray-500 italic">
                Only one event per day allowed
              </span>
            ) : (
              <Button onClick={handleAdd}>Add Event</Button>
            )}
          </ModalFooter>
        </>
      )}

      {(mode === "add" || mode === "edit") && (
        <>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Event Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Company Outing, New Year's Day"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Type
              </label>
              <div className="space-y-2">
                {DAY_TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.dayType === option.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="dayType"
                      value={option.value}
                      checked={formData.dayType === option.value}
                      onChange={(e) =>
                        setFormData({ ...formData, dayType: e.target.value })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {option.label}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${option.color}`}
                        >
                          {option.value === "REGULAR_HOLIDAY" && "200%"}
                          {option.value === "SPECIAL_HOLIDAY" && "130%"}
                          {option.value === "REST_DAY" && "130%"}
                          {option.value === "SPECIAL_WORKING" && "100%"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isNational}
                onChange={(e) =>
                  setFormData({ ...formData, isNational: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm text-gray-700">
                National Holiday (applies to all companies)
              </span>
            </label>
          </div>

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (events.length > 0) {
                  setMode("view");
                  setEditingEvent(null);
                  resetForm();
                } else {
                  onClose();
                }
              }}
            >
              {events.length > 0 ? "Back" : "Cancel"}
            </Button>
            <Button onClick={handleSave} loading={isPending} disabled={!formData.name.trim()}>
              {mode === "add" ? "Add Event" : "Save Changes"}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
