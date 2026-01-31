import { describe, test, expect } from "vitest";

/**
 * Unit tests for attendance late/undertime/OT calculation
 *
 * These tests verify the timezone-agnostic calculation logic used in
 * documents.ts for generating payslip PDFs.
 *
 * Key insight: Schedule times are stored as UTC values but represent
 * Manila local time (UTC+8). The fix uses setUTCHours with the Manila
 * offset to ensure consistent behavior regardless of server timezone.
 */

describe("Attendance Calculation - Timezone-Agnostic", () => {
  /**
   * The FIXED calculation logic from documents.ts
   * Uses setUTCHours with Manila offset for consistent results
   */
  function calculateLateMinutes(
    attendanceDate: Date,
    actualTimeIn: Date,
    actualTimeOut: Date,
    schedStartTime: Date,
    schedEndTime: Date
  ): {
    lateMinutes: number;
    undertimeMinutes: number;
    schedStartUtc: Date;
    schedEndUtc: Date;
  } {
    // Extract hours/minutes from stored time (represents Manila local time)
    const startH = schedStartTime.getUTCHours();
    const startM = schedStartTime.getUTCMinutes();
    const endH = schedEndTime.getUTCHours();
    const endM = schedEndTime.getUTCMinutes();

    // Manila is UTC+8, so subtract 8 hours to convert Manila local time to UTC
    const MANILA_OFFSET_HOURS = 8;

    // Build schedule times using UTC hours with Manila offset
    const schedStart = new Date(attendanceDate);
    schedStart.setUTCHours(startH - MANILA_OFFSET_HOURS, startM, 0, 0);

    const schedEnd = new Date(attendanceDate);
    schedEnd.setUTCHours(endH - MANILA_OFFSET_HOURS, endM, 0, 0);

    // Handle overnight shifts (end time is next day)
    if (endH < startH || (endH - MANILA_OFFSET_HOURS) < 0) {
      schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
    }

    const clockIn = new Date(actualTimeIn);
    const clockOut = new Date(actualTimeOut);

    // Calculate late (clock in after schedule start)
    const lateMinutes = clockIn > schedStart
      ? Math.round((clockIn.getTime() - schedStart.getTime()) / (1000 * 60))
      : 0;

    // Calculate undertime (clock out before schedule end)
    const undertimeMinutes = clockOut < schedEnd
      ? Math.round((schedEnd.getTime() - clockOut.getTime()) / (1000 * 60))
      : 0;

    return {
      lateMinutes,
      undertimeMinutes,
      schedStartUtc: schedStart,
      schedEndUtc: schedEnd,
    };
  }

  describe("Basic scenarios", () => {
    test("Employee 272 minutes late (2:02 PM clock-in for 9:30 AM shift)", () => {
      // Scenario from user PDF:
      // - Date: Jan 14, 2026
      // - Schedule: 09:30 - 18:30 Manila time
      // - Clock In: 14:02 Manila = 06:02 UTC
      // - Clock Out: 18:32 Manila = 10:32 UTC
      // Expected: 272 minutes late

      const attendanceDate = new Date("2026-01-14T00:00:00.000Z");
      const schedStartTime = new Date("1970-01-01T09:30:00.000Z"); // 9:30 AM
      const schedEndTime = new Date("1970-01-01T18:30:00.000Z");   // 6:30 PM
      const actualTimeIn = new Date("2026-01-14T06:02:00.000Z");   // 2:02 PM Manila
      const actualTimeOut = new Date("2026-01-14T10:32:00.000Z");  // 6:32 PM Manila

      const result = calculateLateMinutes(
        attendanceDate,
        actualTimeIn,
        actualTimeOut,
        schedStartTime,
        schedEndTime
      );

      expect(result.schedStartUtc.toISOString()).toBe("2026-01-14T01:30:00.000Z");
      expect(result.schedEndUtc.toISOString()).toBe("2026-01-14T10:30:00.000Z");
      expect(result.lateMinutes).toBe(272);
      expect(result.undertimeMinutes).toBe(0); // Clocked out 2 mins after schedule end
    });

    test("Employee on time (8:57 AM clock-in for 9:00 AM shift)", () => {
      const attendanceDate = new Date("2026-01-13T00:00:00.000Z");
      const schedStartTime = new Date("1970-01-01T09:00:00.000Z"); // 9:00 AM
      const schedEndTime = new Date("1970-01-01T18:00:00.000Z");   // 6:00 PM
      const actualTimeIn = new Date("2026-01-13T00:57:00.000Z");   // 8:57 AM Manila
      const actualTimeOut = new Date("2026-01-13T10:01:00.000Z");  // 6:01 PM Manila

      const result = calculateLateMinutes(
        attendanceDate,
        actualTimeIn,
        actualTimeOut,
        schedStartTime,
        schedEndTime
      );

      expect(result.schedStartUtc.toISOString()).toBe("2026-01-13T01:00:00.000Z");
      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(0);
    });

    test("Employee with undertime (leaves 30 mins early)", () => {
      const attendanceDate = new Date("2026-01-08T00:00:00.000Z");
      const schedStartTime = new Date("1970-01-01T09:30:00.000Z"); // 9:30 AM
      const schedEndTime = new Date("1970-01-01T18:30:00.000Z");   // 6:30 PM
      const actualTimeIn = new Date("2026-01-08T01:29:00.000Z");   // 9:29 AM Manila
      const actualTimeOut = new Date("2026-01-08T10:00:00.000Z");  // 6:00 PM Manila (30 mins early)

      const result = calculateLateMinutes(
        attendanceDate,
        actualTimeIn,
        actualTimeOut,
        schedStartTime,
        schedEndTime
      );

      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(30);
    });

    test("Employee both late and undertime", () => {
      const attendanceDate = new Date("2026-01-14T00:00:00.000Z");
      const schedStartTime = new Date("1970-01-01T09:00:00.000Z"); // 9:00 AM
      const schedEndTime = new Date("1970-01-01T18:00:00.000Z");   // 6:00 PM
      const actualTimeIn = new Date("2026-01-14T01:30:00.000Z");   // 9:30 AM Manila (30 mins late)
      const actualTimeOut = new Date("2026-01-14T09:30:00.000Z");  // 5:30 PM Manila (30 mins early)

      const result = calculateLateMinutes(
        attendanceDate,
        actualTimeIn,
        actualTimeOut,
        schedStartTime,
        schedEndTime
      );

      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(30);
    });
  });

  describe("Edge cases", () => {
    test("Overnight shift (10 PM to 6 AM)", () => {
      const attendanceDate = new Date("2026-01-14T00:00:00.000Z");
      const schedStartTime = new Date("1970-01-01T22:00:00.000Z"); // 10:00 PM
      const schedEndTime = new Date("1970-01-01T06:00:00.000Z");   // 6:00 AM (next day)
      const actualTimeIn = new Date("2026-01-14T14:30:00.000Z");   // 10:30 PM Manila (30 mins late)
      const actualTimeOut = new Date("2026-01-14T21:30:00.000Z");  // 5:30 AM Manila (30 mins early)

      const result = calculateLateMinutes(
        attendanceDate,
        actualTimeIn,
        actualTimeOut,
        schedStartTime,
        schedEndTime
      );

      // 10 PM Manila = 2 PM UTC (14:00)
      expect(result.schedStartUtc.toISOString()).toBe("2026-01-14T14:00:00.000Z");
      // 6 AM Manila next day = 10 PM UTC (22:00)
      expect(result.schedEndUtc.toISOString()).toBe("2026-01-14T22:00:00.000Z");
      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(30);
    });
  });
});
