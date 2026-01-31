// =============================================================================
// PeopleOS PH - Ruleset and Multiplier Definitions
// =============================================================================

export const defaultRuleset = {
  code: "PH_STANDARD_2025",
  name: "Philippine Standard Rules 2025",
  isDefault: true,
  version: 1,
  effectiveDate: "2025-01-01",
  rules: {
    workHoursPerDay: 8,
    workDaysPerMonth: 22,
    nightDiffStart: "22:00",
    nightDiffEnd: "06:00",
  },
};

export const multiplierRules = [
  // Regular Day
  { code: "REG_BASIC", name: "Regular Day Basic", dayType: "WORKDAY", isOvertime: false, isNightDiff: false, isRestDay: false, multiplier: 1.0, priority: 1 },
  { code: "REG_OT", name: "Regular Day OT", dayType: "WORKDAY", isOvertime: true, isNightDiff: false, isRestDay: false, multiplier: 1.25, priority: 2 },
  { code: "REG_ND", name: "Regular Day ND", dayType: "WORKDAY", isOvertime: false, isNightDiff: true, isRestDay: false, multiplier: 1.1, priority: 3 },
  { code: "REG_OT_ND", name: "Regular Day OT + ND", dayType: "WORKDAY", isOvertime: true, isNightDiff: true, isRestDay: false, multiplier: 1.375, priority: 4 },

  // Rest Day
  { code: "RD_BASIC", name: "Rest Day Basic", dayType: "REST_DAY", isOvertime: false, isNightDiff: false, isRestDay: true, multiplier: 1.3, priority: 10 },
  { code: "RD_OT", name: "Rest Day OT", dayType: "REST_DAY", isOvertime: true, isNightDiff: false, isRestDay: true, multiplier: 1.69, priority: 11 },
  { code: "RD_ND", name: "Rest Day ND", dayType: "REST_DAY", isOvertime: false, isNightDiff: true, isRestDay: true, multiplier: 1.43, priority: 12 },
  { code: "RD_OT_ND", name: "Rest Day OT + ND", dayType: "REST_DAY", isOvertime: true, isNightDiff: true, isRestDay: true, multiplier: 1.859, priority: 13 },

  // Regular Holiday
  { code: "RH_BASIC", name: "Regular Holiday Basic", dayType: "REGULAR_HOLIDAY", isOvertime: false, isNightDiff: false, isRestDay: false, multiplier: 2.0, priority: 20 },
  { code: "RH_OT", name: "Regular Holiday OT", dayType: "REGULAR_HOLIDAY", isOvertime: true, isNightDiff: false, isRestDay: false, multiplier: 2.6, priority: 21 },
  { code: "RH_ND", name: "Regular Holiday ND", dayType: "REGULAR_HOLIDAY", isOvertime: false, isNightDiff: true, isRestDay: false, multiplier: 2.2, priority: 22 },
  { code: "RH_OT_ND", name: "Regular Holiday OT + ND", dayType: "REGULAR_HOLIDAY", isOvertime: true, isNightDiff: true, isRestDay: false, multiplier: 2.86, priority: 23 },

  // Regular Holiday + Rest Day
  { code: "RH_RD_BASIC", name: "Regular Holiday on Rest Day", dayType: "REGULAR_HOLIDAY", isOvertime: false, isNightDiff: false, isRestDay: true, multiplier: 2.6, priority: 30 },
  { code: "RH_RD_OT", name: "Regular Holiday on Rest Day OT", dayType: "REGULAR_HOLIDAY", isOvertime: true, isNightDiff: false, isRestDay: true, multiplier: 3.38, priority: 31 },
  { code: "RH_RD_ND", name: "Regular Holiday on Rest Day ND", dayType: "REGULAR_HOLIDAY", isOvertime: false, isNightDiff: true, isRestDay: true, multiplier: 2.86, priority: 32 },
  { code: "RH_RD_OT_ND", name: "Regular Holiday on Rest Day OT + ND", dayType: "REGULAR_HOLIDAY", isOvertime: true, isNightDiff: true, isRestDay: true, multiplier: 3.718, priority: 33 },

  // Special Holiday
  { code: "SH_BASIC", name: "Special Holiday Basic", dayType: "SPECIAL_HOLIDAY", isOvertime: false, isNightDiff: false, isRestDay: false, multiplier: 1.3, priority: 40 },
  { code: "SH_OT", name: "Special Holiday OT", dayType: "SPECIAL_HOLIDAY", isOvertime: true, isNightDiff: false, isRestDay: false, multiplier: 1.69, priority: 41 },
  { code: "SH_ND", name: "Special Holiday ND", dayType: "SPECIAL_HOLIDAY", isOvertime: false, isNightDiff: true, isRestDay: false, multiplier: 1.43, priority: 42 },
  { code: "SH_OT_ND", name: "Special Holiday OT + ND", dayType: "SPECIAL_HOLIDAY", isOvertime: true, isNightDiff: true, isRestDay: false, multiplier: 1.859, priority: 43 },

  // Special Holiday + Rest Day
  { code: "SH_RD_BASIC", name: "Special Holiday on Rest Day", dayType: "SPECIAL_HOLIDAY", isOvertime: false, isNightDiff: false, isRestDay: true, multiplier: 1.5, priority: 50 },
  { code: "SH_RD_OT", name: "Special Holiday on Rest Day OT", dayType: "SPECIAL_HOLIDAY", isOvertime: true, isNightDiff: false, isRestDay: true, multiplier: 1.95, priority: 51 },
  { code: "SH_RD_ND", name: "Special Holiday on Rest Day ND", dayType: "SPECIAL_HOLIDAY", isOvertime: false, isNightDiff: true, isRestDay: true, multiplier: 1.65, priority: 52 },
  { code: "SH_RD_OT_ND", name: "Special Holiday on Rest Day OT + ND", dayType: "SPECIAL_HOLIDAY", isOvertime: true, isNightDiff: true, isRestDay: true, multiplier: 2.145, priority: 53 },
];
