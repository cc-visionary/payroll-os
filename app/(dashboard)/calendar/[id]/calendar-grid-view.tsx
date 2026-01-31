"use client";

// =============================================================================
// PeopleOS PH - Visual Calendar Grid Component
// =============================================================================
// Interactive calendar grid view showing all days with events and allowing
// click-to-add/edit functionality for holidays and company rest days.
// =============================================================================

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DayEventModal } from "./day-event-modal";

interface CalendarEvent {
  id: string;
  date: Date;
  name: string;
  dayType: string;
  isNational: boolean;
}

interface CalendarGridViewProps {
  calendarId: string;
  year: number;
  events: CalendarEvent[];
  restDays: number[]; // Array of day-of-week numbers (0=Sunday, 6=Saturday)
}

const DAY_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  REGULAR_HOLIDAY: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  SPECIAL_HOLIDAY: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  SPECIAL_WORKING: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  REST_DAY: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  COMPANY_EVENT: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
};

/**
 * Format a Date to YYYY-MM-DD string using local date components.
 * For dates created from new Date(year, month, day), use local components.
 */
function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Format a Date to YYYY-MM-DD string using UTC components.
 * For dates from database (@db.Date), use UTC since they come as midnight UTC.
 */
function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayInfo {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isRestDay: boolean;
  events: CalendarEvent[];
}

function getMonthDays(year: number, month: number, events: CalendarEvent[], restDays: number[]): DayInfo[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days: DayInfo[] = [];

  // Add padding days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date,
      day: prevMonthLastDay - i,
      isCurrentMonth: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isRestDay: restDays.includes(date.getDay()),
      events: [],
    });
  }

  // Add days of current month
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    // Use local date for the grid (created locally) and UTC for event dates (from DB)
    const dateStr = formatLocalDate(date);
    const dayEvents = events.filter(
      (e) => formatUtcDate(e.date) === dateStr
    );

    days.push({
      date,
      day: d,
      isCurrentMonth: true,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isRestDay: restDays.includes(date.getDay()),
      events: dayEvents,
    });
  }

  // Add padding days for next month to complete the grid
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let d = 1; d <= remainingDays; d++) {
    const date = new Date(year, month + 1, d);
    days.push({
      date,
      day: d,
      isCurrentMonth: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isRestDay: restDays.includes(date.getDay()),
      events: [],
    });
  }

  return days;
}

function MonthGrid({
  month,
  year,
  events,
  restDays,
  onDayClick,
}: {
  month: number;
  year: number;
  events: CalendarEvent[];
  restDays: number[];
  onDayClick: (date: Date, events: CalendarEvent[]) => void;
}) {
  const days = useMemo(
    () => getMonthDays(year, month, events, restDays),
    [year, month, events, restDays]
  );

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-900">{MONTH_NAMES[month]}</h3>
      </div>
      <div className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((dayInfo, idx) => {
            const hasEvent = dayInfo.events.length > 0;
            const eventType = hasEvent ? dayInfo.events[0].dayType : null;
            const colors = eventType ? DAY_TYPE_COLORS[eventType] : null;

            return (
              <button
                key={idx}
                onClick={() => onDayClick(dayInfo.date, dayInfo.events)}
                disabled={!dayInfo.isCurrentMonth}
                className={cn(
                  "relative aspect-square flex flex-col items-center justify-center text-sm rounded transition-all",
                  dayInfo.isCurrentMonth
                    ? "hover:bg-gray-100 cursor-pointer"
                    : "opacity-30 cursor-default",
                  hasEvent && colors && colors.bg,
                  !hasEvent && dayInfo.isRestDay && dayInfo.isCurrentMonth && "bg-gray-100",
                  !hasEvent && dayInfo.isWeekend && dayInfo.isCurrentMonth && !dayInfo.isRestDay && "bg-gray-50"
                )}
              >
                <span
                  className={cn(
                    "font-medium",
                    hasEvent && colors ? colors.text : "",
                    dayInfo.isWeekend && !hasEvent && "text-gray-400"
                  )}
                >
                  {dayInfo.day}
                </span>
                {hasEvent && (
                  <span
                    className={cn(
                      "absolute bottom-1 w-1.5 h-1.5 rounded-full",
                      colors?.dot || "bg-gray-400"
                    )}
                  />
                )}
                {dayInfo.events.length > 1 && (
                  <span className="absolute top-0.5 right-0.5 text-[10px] bg-gray-700 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    {dayInfo.events.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarGridView({
  calendarId,
  year,
  events,
  restDays,
}: CalendarGridViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);

  const handleDayClick = (date: Date, dayEvents: CalendarEvent[]) => {
    setSelectedDate(date);
    setSelectedEvents(dayEvents);
  };

  const handleClose = () => {
    setSelectedDate(null);
    setSelectedEvents([]);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, month) => (
          <MonthGrid
            key={month}
            month={month}
            year={year}
            events={events}
            restDays={restDays}
            onDayClick={handleDayClick}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-white rounded-lg shadow border">
        <h4 className="font-medium text-gray-900 mb-3">Legend</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Regular Holiday (200%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-gray-600">Special Holiday (130%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-gray-600">Company Rest Day (130%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-600">Special Working Day</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">Company Event</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-gray-100 border" />
            <span className="text-gray-600">Weekly Rest Day</span>
          </div>
        </div>
      </div>

      {/* Day Event Modal */}
      {selectedDate && (
        <DayEventModal
          calendarId={calendarId}
          date={selectedDate}
          events={selectedEvents}
          onClose={handleClose}
        />
      )}
    </>
  );
}
