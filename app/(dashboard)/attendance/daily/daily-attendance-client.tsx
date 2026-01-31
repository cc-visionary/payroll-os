"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DailyAttendanceEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  logDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  attendanceType: "PRESENT" | "ABSENT" | "REST_DAY" | "ON_LEAVE" | "NO_DATA" | "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";
  sourceType: string;
}

interface DailyAttendanceClientProps {
  initialDate: string;
  entries: DailyAttendanceEntry[];
}

type FilterStatus = "all" | "present" | "absent" | "on_leave" | "no_data";
type ViewMode = "cards" | "table" | "timeline";

export function DailyAttendanceClient({
  initialDate,
  entries,
}: DailyAttendanceClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  // Date navigation
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/attendance/daily?date=${e.target.value}`);
  };

  const goToPreviousDay = () => {
    const current = new Date(initialDate);
    current.setDate(current.getDate() - 1);
    router.push(`/attendance/daily?date=${current.toISOString().split("T")[0]}`);
  };

  const goToNextDay = () => {
    const current = new Date(initialDate);
    current.setDate(current.getDate() + 1);
    router.push(`/attendance/daily?date=${current.toISOString().split("T")[0]}`);
  };

  const goToToday = () => {
    router.push(`/attendance/daily?date=${new Date().toISOString().split("T")[0]}`);
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.employeeNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.department?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "present" && entry.attendanceType === "PRESENT") ||
      (filterStatus === "absent" && entry.attendanceType === "ABSENT") ||
      (filterStatus === "on_leave" && entry.attendanceType === "ON_LEAVE") ||
      (filterStatus === "no_data" && entry.attendanceType === "NO_DATA");

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: entries.length,
    present: entries.filter((e) => e.attendanceType === "PRESENT").length,
    absent: entries.filter((e) => e.attendanceType === "ABSENT").length,
    onLeave: entries.filter((e) => e.attendanceType === "ON_LEAVE").length,
    noData: entries.filter((e) => e.attendanceType === "NO_DATA").length,
  };

  const formatTime = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
      PRESENT: {
        label: "Present",
        color: "text-green-700",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
      },
      ABSENT: {
        label: "Absent",
        color: "text-red-700",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
      },
      ON_LEAVE: {
        label: "On Leave",
        color: "text-purple-700",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200",
      },
      REST_DAY: {
        label: "Rest Day",
        color: "text-blue-700",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
      },
      NO_DATA: {
        label: "No Data",
        color: "text-gray-500",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
      },
    };
    return configs[status] || configs.NO_DATA;
  };

  const selectedDate = new Date(initialDate);
  const isToday = initialDate === new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Date Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Previous day"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <input
              type="date"
              value={initialDate}
              onChange={handleDateChange}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="hidden sm:block">
              <div className="text-lg font-semibold text-gray-900">
                {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
              </div>
              <div className="text-sm text-gray-500">
                {selectedDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Next day"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {!isToday && (
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "cards" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "table" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "timeline" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setFilterStatus("all")}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterStatus === "all"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </button>

        <button
          onClick={() => setFilterStatus("present")}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterStatus === "present"
              ? "border-green-500 bg-green-50"
              : "border-gray-200 hover:border-green-200"
          }`}
        >
          <div className="text-2xl font-bold text-green-600">{stats.present}</div>
          <div className="text-sm text-gray-500">Present</div>
          {stats.total > 0 && (
            <div className="text-xs text-green-600 mt-1">
              {Math.round((stats.present / stats.total) * 100)}%
            </div>
          )}
        </button>

        <button
          onClick={() => setFilterStatus("absent")}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterStatus === "absent"
              ? "border-red-500 bg-red-50"
              : "border-gray-200 hover:border-red-200"
          }`}
        >
          <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          <div className="text-sm text-gray-500">Absent</div>
        </button>

        <button
          onClick={() => setFilterStatus("on_leave")}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterStatus === "on_leave"
              ? "border-purple-500 bg-purple-50"
              : "border-gray-200 hover:border-purple-200"
          }`}
        >
          <div className="text-2xl font-bold text-purple-600">{stats.onLeave}</div>
          <div className="text-sm text-gray-500">On Leave</div>
        </button>

        <button
          onClick={() => setFilterStatus("no_data")}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterStatus === "no_data"
              ? "border-gray-500 bg-gray-100"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="text-2xl font-bold text-gray-500">{stats.noData}</div>
          <div className="text-sm text-gray-500">No Data</div>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search by name, ID, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results count */}
      {(searchQuery || filterStatus !== "all") && (
        <div className="text-sm text-gray-500">
          Showing {filteredEntries.length} of {entries.length} employees
          {filterStatus !== "all" && (
            <button
              onClick={() => {
                setFilterStatus("all");
                setSearchQuery("");
              }}
              className="ml-2 text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500">No employees match your search criteria.</p>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEntries.map((entry) => {
            const statusConfig = getStatusConfig(entry.attendanceType);
            return (
              <Link
                key={entry.id}
                href={`/employees/${entry.employeeId}`}
                className={`block p-4 rounded-xl border-2 ${statusConfig.borderColor} ${statusConfig.bgColor} hover:shadow-md transition-all`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold ${
                    entry.attendanceType === "PRESENT"
                      ? "bg-green-200 text-green-800"
                      : entry.attendanceType === "ABSENT"
                      ? "bg-red-200 text-red-800"
                      : entry.attendanceType === "ON_LEAVE"
                      ? "bg-purple-200 text-purple-800"
                      : "bg-gray-200 text-gray-600"
                  }`}>
                    {getInitials(entry.employeeName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {entry.employeeName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {entry.employeeNumber || "No ID"} {entry.department && `• ${entry.department}`}
                    </div>
                  </div>
                </div>

                {/* Time info */}
                <div className="mt-3 pt-3 border-t border-gray-200/50">
                  {entry.attendanceType === "PRESENT" ? (
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">In</div>
                        <div className="font-semibold text-green-700">
                          {formatTime(entry.clockIn) || "-"}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">Out</div>
                        <div className="font-semibold text-gray-700">
                          {formatTime(entry.clockOut) || "-"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`text-center py-1 text-sm font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : viewMode === "timeline" ? (
        <Card>
          <CardContent className="p-0">
            {/* Timeline header - hours */}
            <div className="border-b border-gray-200 px-4 py-2 bg-gray-50 flex">
              <div className="w-48 flex-shrink-0"></div>
              <div className="flex-1 flex">
                {Array.from({ length: 13 }, (_, i) => i + 6).map((hour) => (
                  <div key={hour} className="flex-1 text-xs text-gray-500 text-center">
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline rows */}
            <div className="divide-y divide-gray-100">
              {filteredEntries.map((entry) => {
                const clockInHour = entry.clockIn ? new Date(entry.clockIn).getHours() : null;
                const clockInMin = entry.clockIn ? new Date(entry.clockIn).getMinutes() : null;
                const clockOutHour = entry.clockOut ? new Date(entry.clockOut).getHours() : null;
                const clockOutMin = entry.clockOut ? new Date(entry.clockOut).getMinutes() : null;

                // Calculate position and width as percentage (6am-19pm = 13 hours)
                const startPercent = clockInHour !== null
                  ? Math.max(0, ((clockInHour - 6) * 60 + (clockInMin || 0)) / (13 * 60) * 100)
                  : 0;
                const endPercent = clockOutHour !== null
                  ? Math.min(100, ((clockOutHour - 6) * 60 + (clockOutMin || 0)) / (13 * 60) * 100)
                  : clockInHour !== null ? Math.min(100, startPercent + 5) : 0;

                return (
                  <div key={entry.id} className="flex items-center px-4 py-3 hover:bg-gray-50">
                    {/* Employee info */}
                    <Link
                      href={`/employees/${entry.employeeId}`}
                      className="w-48 flex-shrink-0 flex items-center gap-3"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        entry.attendanceType === "PRESENT"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {getInitials(entry.employeeName)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {entry.employeeName}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {entry.department || "No dept"}
                        </div>
                      </div>
                    </Link>

                    {/* Timeline bar */}
                    <div className="flex-1 h-6 bg-gray-100 rounded relative">
                      {entry.attendanceType === "PRESENT" && (
                        <div
                          className="absolute h-full bg-green-400 rounded"
                          style={{
                            left: `${startPercent}%`,
                            width: `${Math.max(2, endPercent - startPercent)}%`,
                          }}
                        >
                          {/* Clock in marker */}
                          {entry.clockIn && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-600 rounded-full" />
                          )}
                          {/* Clock out marker */}
                          {entry.clockOut && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-600 rounded-full" />
                          )}
                        </div>
                      )}
                      {entry.attendanceType === "ABSENT" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-red-600 font-medium">Absent</span>
                        </div>
                      )}
                      {entry.attendanceType === "ON_LEAVE" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-purple-100 rounded">
                          <span className="text-xs text-purple-600 font-medium">On Leave</span>
                        </div>
                      )}
                      {entry.attendanceType === "NO_DATA" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-gray-400">No data</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Table View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clock In
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clock Out
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEntries.map((entry) => {
                    const statusConfig = getStatusConfig(entry.attendanceType);
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <Link
                            href={`/employees/${entry.employeeId}`}
                            className="flex items-center gap-3"
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                              entry.attendanceType === "PRESENT"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {getInitials(entry.employeeName)}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{entry.employeeName}</div>
                              <div className="text-sm text-gray-500">{entry.employeeNumber || "No ID"}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {entry.department || "-"}
                        </td>
                        <td className="px-4 py-4">
                          {entry.clockIn ? (
                            <span className="font-medium text-gray-900">
                              {formatTime(entry.clockIn)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {entry.clockOut ? (
                            <span className="font-medium text-gray-900">
                              {formatTime(entry.clockOut)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
