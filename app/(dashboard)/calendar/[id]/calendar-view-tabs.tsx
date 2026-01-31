"use client";

// =============================================================================
// PeopleOS PH - Calendar View Tabs Component
// =============================================================================
// Tabbed interface to switch between grid view and list view of calendar events.
// =============================================================================

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarGridView } from "./calendar-grid-view";
import { CalendarEventList } from "./calendar-event-list";

interface CalendarEvent {
  id: string;
  date: Date;
  name: string;
  dayType: string;
  isNational: boolean;
}

interface CalendarViewTabsProps {
  calendarId: string;
  year: number;
  events: CalendarEvent[];
  eventsByMonth: Record<string, CalendarEvent[]>;
  restDays: number[];
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
}

export function CalendarViewTabs({
  calendarId,
  year,
  events,
  eventsByMonth,
  restDays,
}: CalendarViewTabsProps) {
  const [activeView, setActiveView] = useState<"grid" | "list">("grid");

  return (
    <div>
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Calendar Events</h2>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView("grid")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeView === "grid"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <GridIcon className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setActiveView("list")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeView === "list"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <ListIcon className="w-4 h-4" />
            List
          </button>
        </div>
      </div>

      {/* Grid View */}
      {activeView === "grid" && (
        <CalendarGridView
          calendarId={calendarId}
          year={year}
          events={events}
          restDays={restDays}
        />
      )}

      {/* List View */}
      {activeView === "list" && (
        <Card>
          <CardContent className="pt-6">
            {events.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No events in this calendar.</p>
                <p className="text-sm mt-1">
                  Click on any day in the grid view to add events, or use the
                  Add Event button above.
                </p>
              </div>
            ) : (
              <CalendarEventList
                events={events}
                eventsByMonth={eventsByMonth}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
