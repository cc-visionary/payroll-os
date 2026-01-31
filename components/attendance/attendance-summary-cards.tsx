"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceSummary } from "./types";

interface SummaryCardProps {
  label: string;
  value: number;
  total?: number;
  suffix?: string;
  color: "green" | "red" | "purple" | "blue" | "yellow";
}

const colorClasses = {
  green: "text-green-600",
  red: "text-red-600",
  purple: "text-purple-600",
  blue: "text-blue-600",
  yellow: "text-yellow-600",
};

export function SummaryCard({ label, value, total, suffix, color }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className={`text-2xl font-bold ${colorClasses[color]}`}>
          {value}
          {suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
          {total !== undefined && (
            <span className="text-sm font-normal text-gray-500">/{total}</span>
          )}
        </div>
        <div className="text-sm text-gray-500">{label}</div>
      </CardContent>
    </Card>
  );
}

// Compact version for payslip view
export function CompactSummaryCard({ label, value, total, suffix, color }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className={`text-lg font-bold ${colorClasses[color]}`}>
        {value}
        {suffix && <span className="text-xs font-normal ml-0.5">{suffix}</span>}
        {total !== undefined && (
          <span className="text-xs font-normal text-gray-500">/{total}</span>
        )}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

interface AttendanceSummaryCardsProps {
  summary: AttendanceSummary;
  variant?: "default" | "compact" | "payslip";
}

export function AttendanceSummaryCards({ summary, variant = "default" }: AttendanceSummaryCardsProps) {
  const CardComponent = variant === "compact" || variant === "payslip" ? CompactSummaryCard : SummaryCard;

  if (variant === "payslip") {
    // Payslip-style with more details
    return (
      <div className="grid grid-cols-4 md:grid-cols-9 gap-3">
        <CardComponent
          label="Work Days"
          value={summary.workingDays}
          suffix="days"
          color="blue"
        />
        <CardComponent
          label="Present"
          value={summary.presentDays}
          total={summary.workingDays}
          color="green"
        />
        <CardComponent
          label="Absent"
          value={summary.absentDays}
          total={summary.workingDays}
          color="red"
        />
        <CardComponent
          label="Rest Days"
          value={summary.restDays}
          suffix={summary.restDaysWorked && summary.restDaysWorked > 0 ? ` (${summary.restDaysWorked} worked)` : "days"}
          color="blue"
        />
        <CardComponent
          label="Regular Holiday"
          value={summary.regularHolidayDays}
          suffix={summary.regularHolidaysWorked && summary.regularHolidaysWorked > 0 ? ` (${summary.regularHolidaysWorked} worked)` : "days"}
          color="purple"
        />
        <CardComponent
          label="Special Holiday"
          value={summary.specialHolidayDays}
          suffix={summary.specialHolidaysWorked && summary.specialHolidaysWorked > 0 ? ` (${summary.specialHolidaysWorked} worked)` : "days"}
          color="purple"
        />
        <CardComponent
          label="Late/Undertime"
          value={summary.totalDeductionMinutes}
          suffix="mins"
          color="yellow"
        />
        <CardComponent
          label="Regular OT"
          value={summary.regularOtApproved || 0}
          suffix="mins"
          color="green"
        />
        <CardComponent
          label="Holiday/RD OT"
          value={(summary.restDayOt || 0) + (summary.holidayOt || 0)}
          suffix="mins"
          color="green"
        />
      </div>
    );
  }

  // Default employee attendance view
  return (
    <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
      <CardComponent
        label="Work Days"
        value={summary.workingDays}
        color="blue"
      />
      <CardComponent
        label="Present"
        value={summary.presentDays}
        total={summary.workingDays}
        color="green"
      />
      <CardComponent
        label="Absent"
        value={summary.absentDays}
        total={summary.workingDays}
        color="red"
      />
      <CardComponent
        label="Rest Days"
        value={summary.restDays}
        color="blue"
      />
      <CardComponent
        label="Regular Holiday"
        value={summary.regularHolidayDays}
        color="purple"
      />
      <CardComponent
        label="Special Holiday"
        value={summary.specialHolidayDays}
        color="purple"
      />
      <CardComponent
        label="Leave"
        value={summary.leaveDays}
        color="yellow"
      />
      <CardComponent
        label="Deductions"
        value={summary.totalDeductionMinutes}
        suffix="mins"
        color="red"
      />
      <CardComponent
        label="Overtime"
        value={summary.totalOvertimeMinutes}
        suffix="mins"
        color="green"
      />
    </div>
  );
}
