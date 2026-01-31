import { describe, test, expect } from "vitest";
import { calculateAttendanceTimes, setManilaHours } from "../utils/timezone";

/**
 * Unit tests for break override feature in attendance calculations
 *
 * Key scenarios:
 * 1. Normal break (60 min) - baseline
 * 2. Break override to 0 (working lunch):
 *    - Full day worked = no late/undertime adjustment needed
 *    - Late in = reduced late minutes (schedule window included break time)
 *    - Early out = reduced undertime (schedule window included break time)
 *    - Late in after break = special case
 * 3. Partial break override (e.g., 30 min instead of 60)
 * 4. OT scenarios when no break was taken
 */

describe("Break Override - Late/Undertime Adjustments", () => {
  // Helper to create a date at Manila time
  const manilaTime = (dateStr: string, hours: number, minutes: number): Date => {
    const date = new Date(dateStr);
    return setManilaHours(date, hours, minutes);
  };

  // Helper to create schedule time (stored as UTC representing Manila local time)
  const scheduleTime = (hours: number, minutes: number): Date => {
    return new Date(`1970-01-01T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00.000Z`);
  };

  describe("Scenario 1: Normal 60-minute break (baseline)", () => {
    const shiftBreakMinutes = 60;
    const breakMinutesApplied = null; // No override

    test("On time, full day = no late/undertime", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),  // Clock in 9:00 AM
        manilaTime("2026-01-26", 18, 0), // Clock out 6:00 PM
        scheduleTime(9, 0),              // Schedule start 9:00 AM
        scheduleTime(18, 0),             // Schedule end 6:00 PM
        new Date("2026-01-26"),
        false, // earlyInApproved
        false, // lateOutApproved
        shiftBreakMinutes,
        breakMinutesApplied
      );

      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(0);
    });

    test("30 min late = 30 late minutes", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),  // Clock in 9:30 AM (30 min late)
        manilaTime("2026-01-26", 18, 0),  // Clock out 6:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(0);
    });

    test("Leave 60 min early = 60 undertime minutes", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),   // Clock in 9:00 AM
        manilaTime("2026-01-26", 17, 0),  // Clock out 5:00 PM (1 hour early)
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(60);
    });
  });

  describe("Scenario 2: Break override to 0 (no break / working lunch)", () => {
    const shiftBreakMinutes = 60;  // Original shift has 60 min break
    const breakMinutesApplied = 0; // Override: no break taken

    test("Full day worked (9AM-6PM) = no late/undertime (worked through lunch)", () => {
      // Schedule: 9AM-6PM with 60 min break = 8 hours expected work
      // If no break taken, working 9AM-6PM = 9 hours (1 hour extra = potential OT)
      // But late/undertime should still be 0
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),   // Clock in 9:00 AM
        manilaTime("2026-01-26", 18, 0),  // Clock out 6:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      expect(result.lateMinutes).toBe(0);
      expect(result.undertimeMinutes).toBe(0);
    });

    test("Leave at 5PM with no break = NO undertime (8 hours worked = full day)", () => {
      // Schedule: 9AM-6PM with 60 min break = 8 hours expected work
      // If no break taken, leaving at 5PM = 8 hours worked = full day
      // Undertime should be 0 (not 60) because break adjustment applies
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),   // Clock in 9:00 AM
        manilaTime("2026-01-26", 17, 0),  // Clock out 5:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Without break override: undertime = 60 min
      // With break override (0): undertime = 60 - 60 = 0 min
      expect(result.undertimeMinutes).toBe(0);
      expect(result.lateMinutes).toBe(0);
    });

    test("Leave at 4:30PM with no break = only 30 min undertime (not 90)", () => {
      // Schedule: 9AM-6PM with 60 min break = 8 hours expected work
      // If no break, leaving at 4:30PM = 7.5 hours worked = 30 min short
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),   // Clock in 9:00 AM
        manilaTime("2026-01-26", 16, 30), // Clock out 4:30 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Without break override: undertime = 90 min
      // With break override (0): undertime = 90 - 60 = 30 min
      expect(result.undertimeMinutes).toBe(30);
    });

    test("60 min late with no break = still 60 late minutes (late is independent of break)", () => {
      // Schedule: 9AM-6PM with 60 min break
      // Employee arrives at 10AM but didn't take break
      // Late = 60 min (break adjustment does NOT apply to late - only to undertime)
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 10, 0),  // Clock in 10:00 AM (60 min late)
        manilaTime("2026-01-26", 18, 0),  // Clock out 6:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Late is calculated independently of break - being late in the morning
      // has nothing to do with whether you took lunch or not
      expect(result.lateMinutes).toBe(60);
    });

    test("30 min late with no break = still 30 late minutes (late is independent of break)", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),  // Clock in 9:30 AM (30 min late)
        manilaTime("2026-01-26", 18, 0),  // Clock out 6:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Late is calculated independently of break
      expect(result.lateMinutes).toBe(30);
    });

    test("90 min late with no break = still 90 late minutes (late is independent of break)", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 10, 30), // Clock in 10:30 AM (90 min late)
        manilaTime("2026-01-26", 18, 0),  // Clock out 6:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Late is calculated independently of break
      expect(result.lateMinutes).toBe(90);
    });

    test("Both 30 min late AND 30 min early out with no break = late counts, undertime zeroed", () => {
      // Schedule: 9AM-6PM, arrives 9:30, leaves 5:30
      // Without override: 30 late + 30 undertime
      // With break=0: 30 late (unchanged) + 0 undertime (30-60 adjustment, capped at 0)
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),  // Clock in 9:30 AM (30 min late)
        manilaTime("2026-01-26", 17, 30), // Clock out 5:30 PM (30 min early)
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      expect(result.lateMinutes).toBe(30);  // Late is independent of break
      expect(result.undertimeMinutes).toBe(0); // Undertime offset by 60 min unused break
    });
  });

  describe("Scenario 3: Partial break override (30 min instead of 60)", () => {
    const shiftBreakMinutes = 60;   // Original shift has 60 min break
    const breakMinutesApplied = 30; // Override: only 30 min break taken

    test("Leave at 5:30PM with 30 min break = NO undertime", () => {
      // Schedule: 9AM-6PM with 60 min break = 8 hours expected work
      // If only 30 min break, expected 8.5 hours work time
      // Leaving at 5:30PM = 8.5 hours worked = exactly right
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),   // Clock in 9:00 AM
        manilaTime("2026-01-26", 17, 30), // Clock out 5:30 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Without override: undertime = 30 min
      // With 30 min break (adjustment = 30): undertime = 30 - 30 = 0 min
      expect(result.undertimeMinutes).toBe(0);
    });

    test("Leave at 5PM with 30 min break = only 30 min undertime (not 60)", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),   // Clock in 9:00 AM
        manilaTime("2026-01-26", 17, 0),  // Clock out 5:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Without override: undertime = 60 min
      // With 30 min break (adjustment = 30): undertime = 60 - 30 = 30 min
      expect(result.undertimeMinutes).toBe(30);
    });

    test("30 min late with 30 min break taken = still 30 late minutes (late is independent)", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),  // Clock in 9:30 AM (30 min late)
        manilaTime("2026-01-26", 18, 0),  // Clock out 6:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Late is calculated independently of break - being late in the morning
      // has nothing to do with whether you took lunch or not
      expect(result.lateMinutes).toBe(30);
    });
  });

  describe("Scenario 4: No override (breakMinutesApplied = null)", () => {
    const shiftBreakMinutes = 60;
    const breakMinutesApplied = null; // No override, use shift break

    test("Should NOT apply any adjustment when no override is set", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),  // Clock in 9:30 AM (30 min late)
        manilaTime("2026-01-26", 17, 0),  // Clock out 5:00 PM (60 min early)
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // No adjustment should be applied
      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(60);
    });
  });

  describe("Scenario 5: Overnight shifts with break override", () => {
    const shiftBreakMinutes = 60;
    const breakMinutesApplied = 0; // No break

    test("Overnight shift (10PM-6AM) with no break, leave 1 hour early = NO undertime", () => {
      // Overnight: 10PM to 6AM = 8 hours with 1 hour break = 7 hours work
      // No break: leaving at 5AM = 7 hours worked = full day
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 22, 0),  // Clock in 10:00 PM
        manilaTime("2026-01-27", 5, 0),   // Clock out 5:00 AM next day (1 hour early)
        scheduleTime(22, 0),              // Schedule start 10:00 PM
        scheduleTime(6, 0),               // Schedule end 6:00 AM
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Without break override: undertime = 60 min
      // With break override (0): undertime = 60 - 60 = 0 min
      expect(result.undertimeMinutes).toBe(0);
    });
  });

  describe("Scenario 6: Edge cases", () => {
    test("Break override same as shift break (no change)", () => {
      const shiftBreakMinutes = 60;
      const breakMinutesApplied = 60; // Same as shift

      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),  // 30 min late
        manilaTime("2026-01-26", 17, 0),  // 60 min early
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Adjustment = 60 - 60 = 0, so no change
      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(60);
    });

    test("Break override greater than shift break (no adjustment - shouldn't happen)", () => {
      const shiftBreakMinutes = 60;
      const breakMinutesApplied = 90; // More than shift break (edge case)

      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),
        manilaTime("2026-01-26", 17, 0),
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // Adjustment = 60 - 90 = -30, but we only adjust when positive
      // So no adjustment should be made
      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(60);
    });

    test("Missing shift break info (undefined) with override = no adjustment", () => {
      const shiftBreakMinutes = undefined;
      const breakMinutesApplied = 0;

      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 30),
        manilaTime("2026-01-26", 17, 0),
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, false,
        shiftBreakMinutes,
        breakMinutesApplied
      );

      // No adjustment when shift break is undefined
      expect(result.lateMinutes).toBe(30);
      expect(result.undertimeMinutes).toBe(60);
    });
  });
});

describe("Break Override - OT Calculations", () => {
  const manilaTime = (dateStr: string, hours: number, minutes: number): Date => {
    const date = new Date(dateStr);
    return setManilaHours(date, hours, minutes);
  };

  const scheduleTime = (hours: number, minutes: number): Date => {
    return new Date(`1970-01-01T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00.000Z`);
  };

  describe("Early In OT with break override", () => {
    test("Early clock in approved should count as OT regardless of break override", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 8, 0),   // Clock in 8:00 AM (1 hour early)
        manilaTime("2026-01-26", 18, 0),  // Clock out 6:00 PM
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        true,  // earlyInApproved
        false, // lateOutApproved
        60,    // shiftBreakMinutes
        0      // breakMinutesApplied (no break)
      );

      expect(result.otEarlyInMinutes).toBe(60);
      expect(result.lateMinutes).toBe(0);
    });
  });

  describe("Late Out OT with break override", () => {
    test("Late clock out approved should count as OT regardless of break override", () => {
      const result = calculateAttendanceTimes(
        manilaTime("2026-01-26", 9, 0),   // Clock in 9:00 AM
        manilaTime("2026-01-26", 19, 0),  // Clock out 7:00 PM (1 hour late)
        scheduleTime(9, 0),
        scheduleTime(18, 0),
        new Date("2026-01-26"),
        false, // earlyInApproved
        true,  // lateOutApproved
        60,    // shiftBreakMinutes
        0      // breakMinutesApplied (no break)
      );

      expect(result.otLateOutMinutes).toBe(60);
      expect(result.undertimeMinutes).toBe(0);
    });
  });
});

describe("Real-world scenarios from user data", () => {
  const manilaTime = (dateStr: string, hours: number, minutes: number): Date => {
    const date = new Date(dateStr);
    return setManilaHours(date, hours, minutes);
  };

  const scheduleTime = (hours: number, minutes: number): Date => {
    return new Date(`1970-01-01T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00.000Z`);
  };

  test("Employee works 9AM-5PM with no break (working lunch) = late counted, no undertime", () => {
    // Real scenario: Employee has 9AM-6PM schedule with 60 min break
    // They worked through lunch (breakMinutesApplied = 0) and left at 5PM
    // Expected: No undertime because 8 hours worked = full day
    // But late is still counted (late is independent of break)
    const result = calculateAttendanceTimes(
      manilaTime("2026-01-26", 9, 8),    // Clock in 9:08 AM (8 min late)
      manilaTime("2026-01-26", 17, 0),   // Clock out 5:00 PM
      scheduleTime(9, 0),
      scheduleTime(18, 0),
      new Date("2026-01-26"),
      false, false,
      60,  // shiftBreakMinutes
      0    // breakMinutesApplied = 0 (no break)
    );

    // Late is calculated independently - 8 min late is 8 min late
    expect(result.lateMinutes).toBe(8);
    // 60 min early but with 60 min break adjustment = 0 undertime
    expect(result.undertimeMinutes).toBe(0);
  });

  test("Employee with data from DB: Jan 26, 2026 - correct late and undertime calculation", () => {
    // From DB: time_in=01:09 UTC (9:09 AM Manila), time_out=05:00 UTC (1:00 PM Manila)
    // Schedule: 09:00-18:00 with 60 min break
    // breakMinutesApplied = 0
    const result = calculateAttendanceTimes(
      manilaTime("2026-01-26", 9, 9),    // Clock in 9:09 AM Manila
      manilaTime("2026-01-26", 13, 0),   // Clock out 1:00 PM Manila (05:00 UTC)
      scheduleTime(9, 0),
      scheduleTime(18, 0),
      new Date("2026-01-26"),
      false, false,
      60,  // shiftBreakMinutes
      0    // breakMinutesApplied = 0
    );

    // Late is calculated independently - 9 min late is 9 min late
    // (break adjustment does NOT apply to late)
    expect(result.lateMinutes).toBe(9);
    // 5 hours early = 300 min, with 60 min break adjustment = 240 min undertime
    expect(result.undertimeMinutes).toBe(240);
  });
});
