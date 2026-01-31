// =============================================================================
// PeopleOS PH - Shift Template Definitions
// =============================================================================

export interface ShiftDefinition {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  breakStartTime?: string;  // HH:MM format, e.g., "13:00"
  breakEndTime?: string;    // HH:MM format, e.g., "14:00"
  scheduledWorkMinutes: number;
  isOvernight: boolean;
}

export const shifts: ShiftDefinition[] = [
  {
    code: "FLEX-SHIFT",
    name: "Flex Shift",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    breakStartTime: "13:00",
    breakEndTime: "14:00",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "930-1830",
    name: "9:30 AM to 6:30 PM",
    startTime: "09:30",
    endTime: "18:30",
    breakMinutes: 60,
    breakStartTime: "13:00",
    breakEndTime: "14:00",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "1000-1900",
    name: "10:00 AM to 7:00 PM",
    startTime: "10:00",
    endTime: "19:00",
    breakMinutes: 60,
    breakStartTime: "13:00",
    breakEndTime: "14:00",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "900-1800",
    name: "9:00 AM to 6:00 PM",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    breakStartTime: "13:00",
    breakEndTime: "14:00",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "1200-2100",
    name: "12:00 PM to 9:00 PM",
    startTime: "12:00",
    endTime: "21:00",
    breakMinutes: 60,
    breakStartTime: "18:00",
    breakEndTime: "19:00",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "3PM-TO-12AM",
    name: "3:00 PM to 12:00 AM",
    startTime: "15:00",
    endTime: "00:00",
    breakMinutes: 60,
    breakStartTime: "20:00",
    breakEndTime: "21:00",
    scheduledWorkMinutes: 480,
    isOvernight: true,
  },
  {
    code: "830-1730",
    name: "8:30 AM to 5:30 PM",
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 60,
    breakStartTime: "12:30",
    breakEndTime: "13:30",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "1230-2130",
    name: "12:30 PM to 9:30 PM",
    startTime: "12:30",
    endTime: "21:30",
    breakMinutes: 60,
    breakStartTime: "17:00",
    breakEndTime: "18:00",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "800-1700",
    name: "8:00 AM to 5:00 PM",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: 60,
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    scheduledWorkMinutes: 480,
    isOvernight: false,
  },
  {
    code: "900-1400",
    name: "9:00 AM to 2:00 PM (Part-time)",
    startTime: "09:00",
    endTime: "14:00",
    breakMinutes: 0,
    // No break for part-time shift
    scheduledWorkMinutes: 300,
    isOvernight: false,
  },
];
