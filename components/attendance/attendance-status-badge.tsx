"use client";

import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus, HolidayType } from "./types";

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
  holidayName?: string;
  holidayType?: HolidayType;
  leaveTypeName?: string;
}

const statusConfig: Record<AttendanceStatus, { label: string; variant: "success" | "danger" | "warning" | "default" }> = {
  PRESENT: { label: "Present", variant: "success" },
  HALF_DAY: { label: "Half Day", variant: "warning" },
  ABSENT: { label: "Absent", variant: "danger" },
  REST_DAY: { label: "Rest Day", variant: "default" },
  ON_LEAVE: { label: "On Leave", variant: "warning" },
  REGULAR_HOLIDAY: { label: "Regular Holiday", variant: "default" },
  SPECIAL_HOLIDAY: { label: "Special Holiday", variant: "default" },
  NO_DATA: { label: "No Data", variant: "default" },
};

export function AttendanceStatusBadge({ status, holidayName, holidayType, leaveTypeName }: AttendanceStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "default" as const };
  const { label, variant } = config;

  // Worked on a holiday - show both Present badge and holiday info
  if ((status === "PRESENT" || status === "HALF_DAY") && holidayType && holidayName) {
    const holidayLabel = holidayType === "REGULAR_HOLIDAY" ? "Regular Holiday" : "Special Holiday";
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex gap-1">
          <Badge variant={variant}>{label}</Badge>
          <Badge variant="warning">{holidayLabel}</Badge>
        </div>
        <span className="text-xs text-gray-500">{holidayName}</span>
      </div>
    );
  }

  // Holiday without working - show holiday name
  if ((status === "REGULAR_HOLIDAY" || status === "SPECIAL_HOLIDAY") && holidayName) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-xs text-gray-500">{holidayName}</span>
      </div>
    );
  }

  // On Leave - show leave type name
  if (status === "ON_LEAVE" && leaveTypeName) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-xs text-gray-500">{leaveTypeName}</span>
      </div>
    );
  }

  return <Badge variant={variant}>{label}</Badge>;
}
