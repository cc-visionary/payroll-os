/**
 * Payslip PDF Generator
 *
 * Generates a 2-page payslip per employee:
 * - Page 1: Complete calculation breakdown with earnings, deductions, statutory, summary, YTD, and rates
 * - Page 2: Daily attendance log
 */

import {
  createPDFDocument,
  addCompanyHeader,
  addDocumentTitle,
  addPageFooterAndNumbers,
  pdfToBuffer,
} from "../index";

export interface PayslipEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  department?: string | null;
  jobTitle?: string | null;
}

export interface PayslipCompanyInfo {
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface PayslipPeriodInfo {
  code: string;
  startDate: Date;
  endDate: Date;
  payDate: Date;
}

export interface PayslipLineItem {
  category: string;
  description: string;
  amount: number;
  quantity?: number | null;
  rate?: number | null;
  multiplier?: number | null;
}

export interface PayslipRateInfo {
  dailyRate: number;
  hourlyRate: number;
  minuteRate: number;
  monthlyRate?: number;
  wageType: "MONTHLY" | "DAILY" | "HOURLY";
}

export interface PayslipAttendanceDay {
  date: Date;
  dayType: string;
  attendanceStatus?: string;
  shiftCode?: string | null;
  shiftTime?: string | null;
  timeIn?: Date | null;
  timeOut?: Date | null;
  breakMinutes?: number | null;
  lateMinutes: number;
  undertimeMinutes: number;
  workedMinutes: number;
  // OT breakdown
  otEarlyInMinutes: number;
  otLateOutMinutes: number;
  otRestDayMinutes: number;
  otHolidayMinutes: number;
  ndMinutes: number;
  // OT approval flags (early in/late out counts as OT only if approved)
  earlyInApproved?: boolean | null;
  lateOutApproved?: boolean | null;
  // Late/undertime approval flags (excuses the deduction if approved)
  lateInApproved?: boolean | null;
  earlyOutApproved?: boolean | null;
  holidayName?: string | null;
  holidayType?: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | null;
  leaveTypeName?: string | null;
  notes?: string | null;
}

export interface PayslipAttendanceSummary {
  // Day counts
  workDays: number;
  presentDays: number;
  absentDays: number;
  restDays: number;
  restDaysWorked: number;
  regularHolidays: number;
  regularHolidaysWorked: number;
  specialHolidays: number;
  specialHolidaysWorked: number;
  // Time metrics
  totalLateMins: number;
  totalUndertimeMins: number;
  regularOtMins: number;      // Early in + late out approved
  restDayOtMins: number;
  holidayOtMins: number;
  totalNdMins: number;
  // Legacy fields for backward compatibility
  expectedWorkDays?: number;
  daysAttended?: number;
  absences?: number;
  totalRegularMins?: number;
  totalOtMins?: number;
}

export interface PayslipData {
  grossPay: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  sssEe: number;
  sssEr: number;
  philhealthEe: number;
  philhealthEr: number;
  pagibigEe: number;
  pagibigEr: number;
  withholdingTax: number;
  ytdGrossPay: number;
  ytdTaxWithheld: number;
  lines: PayslipLineItem[];
  rates: PayslipRateInfo;
  attendanceSummary: PayslipAttendanceSummary;
  attendanceRecords: PayslipAttendanceDay[];
}

// Earning categories
const EARNING_CATEGORIES = [
  "BASIC_PAY",
  "OVERTIME_REGULAR",
  "OVERTIME_REST_DAY",
  "OVERTIME_HOLIDAY",
  "NIGHT_DIFFERENTIAL",
  "HOLIDAY_PAY",
  "REGULAR_HOLIDAY_PAY",
  "SPECIAL_HOLIDAY_PAY",
  "REST_DAY_PAY",
  "ALLOWANCE",
  "REIMBURSEMENT",
  "INCENTIVE",
  "BONUS",
  "ADJUSTMENT_ADD",
];

// Deduction categories (non-statutory)
const NON_STATUTORY_DEDUCTION_CATEGORIES = [
  "LATE_DEDUCTION",
  "UNDERTIME_DEDUCTION",
  "LATE_UT_DEDUCTION",
  "ABSENT_DEDUCTION",
  "CASH_ADVANCE_DEDUCTION",
  "LOAN_DEDUCTION",
  "ADJUSTMENT_DEDUCT",
  "OTHER_DEDUCTION",
];

// Page layout constants
const MARGINS = { left: 50, right: 50, top: 60, bottom: 60 };

export async function generatePayslipPDF(
  employee: PayslipEmployeeInfo,
  company: PayslipCompanyInfo,
  payPeriod: PayslipPeriodInfo,
  data: PayslipData
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Payslip - ${employee.firstName} ${employee.lastName} - ${payPeriod.code}`,
    author: company.name,
    subject: `Payslip for pay period ${payPeriod.code}`,
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;

  // Formatting helpers
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatRate = (value: number): string => {
    return value.toLocaleString("en-PH", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const formatDateRange = (start: Date, end: Date): string => {
    const startStr = new Date(start).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const endStr = new Date(end).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startStr} - ${endStr}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date | null | undefined): string => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatQty = (qty: number | null | undefined): string => {
    if (qty === null || qty === undefined) return "";
    return qty.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const formatMult = (mult: number | null | undefined): string => {
    if (mult === null || mult === undefined) return "";
    return mult.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // =========================================================================
  // PAGE 1: Complete Calculation Breakdown
  // =========================================================================

  // Company Header
  addCompanyHeader(doc, company);

  // Document Title
  addDocumentTitle(doc, "PAYSLIP");

  // -------------------------------------------------------------------------
  // Employee Information Section
  // -------------------------------------------------------------------------
  const infoBoxY = doc.y;
  doc.rect(MARGINS.left, infoBoxY, pageWidth, 55).stroke("#e5e7eb");

  const col1X = MARGINS.left + 10;
  const col2X = MARGINS.left + pageWidth / 2 + 10;
  const labelWidth = 80;
  const valueWidth = pageWidth / 2 - labelWidth - 20;

  doc.font("Helvetica").fontSize(9).fillColor("#4a4a4a");

  // Row 1
  doc.text("Employee:", col1X, infoBoxY + 8, { width: labelWidth });
  doc.font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(fullName, col1X + labelWidth, infoBoxY + 8, { width: valueWidth });

  doc.font("Helvetica").fillColor("#4a4a4a");
  doc.text("Employee No:", col2X, infoBoxY + 8, { width: labelWidth });
  doc.font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(employee.employeeNumber, col2X + labelWidth, infoBoxY + 8, { width: valueWidth });

  // Row 2
  doc.font("Helvetica").fillColor("#4a4a4a");
  doc.text("Department:", col1X, infoBoxY + 23, { width: labelWidth });
  doc.font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(employee.department || "-", col1X + labelWidth, infoBoxY + 23, { width: valueWidth });

  doc.font("Helvetica").fillColor("#4a4a4a");
  doc.text("Position:", col2X, infoBoxY + 23, { width: labelWidth });
  doc.font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(employee.jobTitle || "-", col2X + labelWidth, infoBoxY + 23, { width: valueWidth });

  // Row 3
  doc.font("Helvetica").fillColor("#4a4a4a");
  doc.text("Pay Period:", col1X, infoBoxY + 38, { width: labelWidth });
  doc.font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(formatDateRange(payPeriod.startDate, payPeriod.endDate), col1X + labelWidth, infoBoxY + 38, { width: valueWidth });

  doc.font("Helvetica").fillColor("#4a4a4a");
  doc.text("Pay Date:", col2X, infoBoxY + 38, { width: labelWidth });
  doc.font("Helvetica-Bold").fillColor("#1a1a1a");
  doc.text(formatDate(payPeriod.payDate), col2X + labelWidth, infoBoxY + 38, { width: valueWidth });

  doc.y = infoBoxY + 65;

  // -------------------------------------------------------------------------
  // EARNINGS Section with Table
  // -------------------------------------------------------------------------
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#1a1a1a");
  doc.text("EARNINGS", MARGINS.left, doc.y, { width: pageWidth, align: "center" });
  doc.moveDown(0.3);

  const earnings = data.lines.filter((l) => EARNING_CATEGORIES.includes(l.category));

  // Table headers
  const earningsColWidths = [200, 60, 80, 45, 100]; // Description, Qty, Rate, Mult, Amount
  const tableRowHeight = 16;
  const tablePadding = 4;
  const tableFontSize = 8;

  let tableY = doc.y;

  // Header row
  doc.font("Helvetica-Bold").fontSize(tableFontSize).fillColor("#1a1a1a");
  doc.fillColor("#f3f4f6").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
  doc.fillColor("#1a1a1a");

  const earningsHeaders = ["Description", "Qty", "Rate", "Mult", "Amount"];
  let colX = MARGINS.left;
  earningsHeaders.forEach((header, i) => {
    const align = i === 0 ? "left" : "right";
    doc.text(header, colX + tablePadding, tableY + tablePadding, {
      width: earningsColWidths[i] - tablePadding * 2,
      align,
    });
    colX += earningsColWidths[i];
  });
  tableY += tableRowHeight;

  // Data rows
  doc.font("Helvetica").fontSize(tableFontSize);
  earnings.forEach((line, idx) => {
    if (idx % 2 === 1) {
      doc.fillColor("#f9fafb").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
    }
    doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(MARGINS.left, tableY, pageWidth, tableRowHeight).stroke();

    doc.fillColor("#1a1a1a");
    let colX = MARGINS.left;

    // Description
    doc.text(line.description, colX + tablePadding, tableY + tablePadding, {
      width: earningsColWidths[0] - tablePadding * 2,
      align: "left",
    });
    colX += earningsColWidths[0];

    // Qty
    doc.text(formatQty(line.quantity), colX + tablePadding, tableY + tablePadding, {
      width: earningsColWidths[1] - tablePadding * 2,
      align: "right",
    });
    colX += earningsColWidths[1];

    // Rate
    doc.text(line.rate ? formatRate(line.rate) : "", colX + tablePadding, tableY + tablePadding, {
      width: earningsColWidths[2] - tablePadding * 2,
      align: "right",
    });
    colX += earningsColWidths[2];

    // Multiplier
    doc.text(formatMult(line.multiplier), colX + tablePadding, tableY + tablePadding, {
      width: earningsColWidths[3] - tablePadding * 2,
      align: "right",
    });
    colX += earningsColWidths[3];

    // Amount
    doc.text(formatCurrency(line.amount), colX + tablePadding, tableY + tablePadding, {
      width: earningsColWidths[4] - tablePadding * 2,
      align: "right",
    });

    tableY += tableRowHeight;
  });

  // Gross Pay total row
  doc.fillColor("#e8f5e9").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
  doc.strokeColor("#4caf50").lineWidth(1).rect(MARGINS.left, tableY, pageWidth, tableRowHeight).stroke();
  doc.font("Helvetica-Bold").fontSize(tableFontSize).fillColor("#2e7d32");
  doc.text("GROSS PAY", MARGINS.left + tablePadding, tableY + tablePadding, {
    width: earningsColWidths[0] + earningsColWidths[1] + earningsColWidths[2] + earningsColWidths[3] - tablePadding * 2,
    align: "left",
  });
  doc.text(formatCurrency(data.grossPay), MARGINS.left + pageWidth - earningsColWidths[4] + tablePadding, tableY + tablePadding, {
    width: earningsColWidths[4] - tablePadding * 2,
    align: "right",
  });
  tableY += tableRowHeight + 10;

  doc.y = tableY;

  // -------------------------------------------------------------------------
  // STATUTORY DEDUCTIONS Section (only shown if there are statutory deductions)
  // -------------------------------------------------------------------------
  const totalStatutory = data.sssEe + data.philhealthEe + data.pagibigEe + data.withholdingTax;
  const deductionColWidths = [385, 100]; // Description, Amount

  if (totalStatutory > 0) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1a1a1a");
    doc.text("STATUTORY DEDUCTIONS", MARGINS.left, doc.y, { width: pageWidth, align: "center" });
    doc.moveDown(0.3);

    const statutoryItems = [
      { label: "SSS (Employee Share)", amount: data.sssEe },
      { label: "PhilHealth (Employee Share)", amount: data.philhealthEe },
      { label: "Pag-IBIG (Employee Share)", amount: data.pagibigEe },
      { label: "Withholding Tax", amount: data.withholdingTax },
    ].filter((item) => item.amount > 0);

    tableY = doc.y;

    // Header row
    doc.font("Helvetica-Bold").fontSize(tableFontSize).fillColor("#1a1a1a");
    doc.fillColor("#f3f4f6").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
    doc.fillColor("#1a1a1a");
    doc.text("Description", MARGINS.left + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[0] - tablePadding * 2,
      align: "left",
    });
    doc.text("Amount", MARGINS.left + deductionColWidths[0] + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[1] - tablePadding * 2,
      align: "right",
    });
    tableY += tableRowHeight;

    // Data rows
    doc.font("Helvetica").fontSize(tableFontSize).fillColor("#c00000");
    statutoryItems.forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.fillColor("#fff5f5").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
      }
      doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(MARGINS.left, tableY, pageWidth, tableRowHeight).stroke();

      doc.fillColor("#c00000");
      doc.text(item.label, MARGINS.left + tablePadding, tableY + tablePadding, {
        width: deductionColWidths[0] - tablePadding * 2,
        align: "left",
      });
      doc.text(`- ${formatCurrency(item.amount)}`, MARGINS.left + deductionColWidths[0] + tablePadding, tableY + tablePadding, {
        width: deductionColWidths[1] - tablePadding * 2,
        align: "right",
      });
      tableY += tableRowHeight;
    });

    // Total Statutory row
    doc.fillColor("#ffebee").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
    doc.strokeColor("#c00000").lineWidth(0.5).rect(MARGINS.left, tableY, pageWidth, tableRowHeight).stroke();
    doc.font("Helvetica-Bold").fontSize(tableFontSize).fillColor("#b71c1c");
    doc.text("Total Statutory Deductions", MARGINS.left + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[0] - tablePadding * 2,
      align: "left",
    });
    doc.text(`- ${formatCurrency(totalStatutory)}`, MARGINS.left + deductionColWidths[0] + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[1] - tablePadding * 2,
      align: "right",
    });
    tableY += tableRowHeight + 10;

    doc.y = tableY;
  }

  // -------------------------------------------------------------------------
  // OTHER DEDUCTIONS Section
  // -------------------------------------------------------------------------
  const nonStatutoryDeductions = data.lines.filter((l) =>
    NON_STATUTORY_DEDUCTION_CATEGORIES.includes(l.category)
  );

  if (nonStatutoryDeductions.length > 0) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1a1a1a");
    doc.text("OTHER DEDUCTIONS", MARGINS.left, doc.y, { width: pageWidth, align: "center" });
    doc.moveDown(0.3);

    const totalOtherDeductions = nonStatutoryDeductions.reduce((sum, l) => sum + l.amount, 0);

    tableY = doc.y;

    // Header row
    doc.font("Helvetica-Bold").fontSize(tableFontSize).fillColor("#1a1a1a");
    doc.fillColor("#f3f4f6").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
    doc.fillColor("#1a1a1a");
    doc.text("Description", MARGINS.left + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[0] - tablePadding * 2,
      align: "left",
    });
    doc.text("Amount", MARGINS.left + deductionColWidths[0] + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[1] - tablePadding * 2,
      align: "right",
    });
    tableY += tableRowHeight;

    // Data rows
    doc.font("Helvetica").fontSize(tableFontSize).fillColor("#c00000");
    nonStatutoryDeductions.forEach((line, idx) => {
      if (idx % 2 === 1) {
        doc.fillColor("#fff5f5").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
      }
      doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(MARGINS.left, tableY, pageWidth, tableRowHeight).stroke();

      doc.fillColor("#c00000");
      doc.text(line.description, MARGINS.left + tablePadding, tableY + tablePadding, {
        width: deductionColWidths[0] - tablePadding * 2,
        align: "left",
      });
      doc.text(`- ${formatCurrency(line.amount)}`, MARGINS.left + deductionColWidths[0] + tablePadding, tableY + tablePadding, {
        width: deductionColWidths[1] - tablePadding * 2,
        align: "right",
      });
      tableY += tableRowHeight;
    });

    // Total Other Deductions row
    doc.fillColor("#ffebee").rect(MARGINS.left, tableY, pageWidth, tableRowHeight).fill();
    doc.strokeColor("#c00000").lineWidth(0.5).rect(MARGINS.left, tableY, pageWidth, tableRowHeight).stroke();
    doc.font("Helvetica-Bold").fontSize(tableFontSize).fillColor("#b71c1c");
    doc.text("Total Other Deductions", MARGINS.left + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[0] - tablePadding * 2,
      align: "left",
    });
    doc.text(`- ${formatCurrency(totalOtherDeductions)}`, MARGINS.left + deductionColWidths[0] + tablePadding, tableY + tablePadding, {
      width: deductionColWidths[1] - tablePadding * 2,
      align: "right",
    });
    tableY += tableRowHeight + 10;

    doc.y = tableY;
  }

  // -------------------------------------------------------------------------
  // NET PAY Summary Box
  // -------------------------------------------------------------------------
  const summaryBoxY = doc.y;
  const summaryBoxHeight = 70;

  doc.fillColor("#e3f2fd").rect(MARGINS.left, summaryBoxY, pageWidth, summaryBoxHeight).fill();
  doc.strokeColor("#1976d2").lineWidth(1.5).rect(MARGINS.left, summaryBoxY, pageWidth, summaryBoxHeight).stroke();

  // Summary content
  doc.font("Helvetica").fontSize(10).fillColor("#1a1a1a");
  const summaryLabelX = MARGINS.left + 15;
  const summaryValueX = MARGINS.left + pageWidth - 120;
  const summaryValueWidth = 100;

  doc.text("Gross Pay:", summaryLabelX, summaryBoxY + 10, { width: 200 });
  doc.text(`PHP ${formatCurrency(data.grossPay)}`, summaryValueX, summaryBoxY + 10, { width: summaryValueWidth, align: "right" });

  doc.text("Total Deductions:", summaryLabelX, summaryBoxY + 25, { width: 200 });
  doc.fillColor("#c00000");
  doc.text(`- PHP ${formatCurrency(data.totalDeductions)}`, summaryValueX, summaryBoxY + 25, { width: summaryValueWidth, align: "right" });

  // Net Pay line
  doc.strokeColor("#1976d2").lineWidth(1).moveTo(summaryLabelX, summaryBoxY + 42).lineTo(MARGINS.left + pageWidth - 15, summaryBoxY + 42).stroke();

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#1565c0");
  doc.text("NET PAY:", summaryLabelX, summaryBoxY + 48, { width: 200 });
  doc.text(`PHP ${formatCurrency(data.netPay)}`, summaryValueX - 20, summaryBoxY + 48, { width: summaryValueWidth + 20, align: "right" });

  doc.y = summaryBoxY + summaryBoxHeight + 15;

  // =========================================================================
  // PAGE 2: Daily Attendance Log (Matching UI Format)
  // =========================================================================

  doc.addPage();

  // Header for page 2
  addCompanyHeader(doc, company);

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1a1a");
  doc.text("Daily Attendance Log", { align: "center" });
  doc.moveDown(0.3);

  // Employee reference
  doc.font("Helvetica").fontSize(9).fillColor("#4a4a4a");
  doc.text(`Employee: ${fullName} (${employee.employeeNumber}) | Pay Period: ${formatDateRange(payPeriod.startDate, payPeriod.endDate)}`, { align: "center" });
  doc.moveDown(0.8);

  // -------------------------------------------------------------------------
  // Summary Cards (matching UI layout - 8 cards)
  // -------------------------------------------------------------------------
  const summary = data.attendanceSummary;
  const cardWidth = 58;
  const cardHeight = 44;
  const cardGap = 4;
  const cardsPerRow = 8;
  const totalCardsWidth = cardWidth * cardsPerRow + cardGap * (cardsPerRow - 1);
  const cardsStartX = (doc.page.width - totalCardsWidth) / 2;
  let cardY = doc.y;

  // Helper to draw a summary card
  const drawSummaryCard = (
    x: number,
    y: number,
    value: string | number,
    label: string,
    suffix: string,
    borderColor: string,
    textColor: string
  ) => {
    // Card border
    doc.strokeColor(borderColor).lineWidth(1.5).rect(x, y, cardWidth, cardHeight).stroke();

    // Value
    doc.font("Helvetica-Bold").fontSize(13).fillColor(textColor);
    const valueText = String(value);
    doc.text(valueText, x, y + 7, { width: cardWidth, align: "center" });

    // Suffix (like "days" or "mins")
    doc.font("Helvetica").fontSize(6).fillColor("#6b7280");
    doc.text(suffix, x, y + 21, { width: cardWidth, align: "center" });

    // Label
    doc.font("Helvetica").fontSize(6).fillColor("#6b7280");
    doc.text(label, x + 2, y + 32, { width: cardWidth - 4, align: "center" });
  };

  // Calculate totals
  const totalDeductionMins = summary.totalLateMins + summary.totalUndertimeMins;
  const totalOtMins = summary.regularOtMins + summary.restDayOtMins + summary.holidayOtMins;

  // Draw summary cards (8 cards matching UI)
  const cards = [
    { value: summary.workDays, label: "Work Days", suffix: "days", color: "#22c55e" },
    { value: `${summary.presentDays}/${summary.workDays}`, label: "Present", suffix: "", color: "#22c55e" },
    { value: `${summary.absentDays}/${summary.workDays}`, label: "Absent", suffix: "", color: "#ef4444" },
    { value: summary.restDays, label: "Rest Days", suffix: "days", color: "#6b7280" },
    { value: summary.regularHolidays, label: "Regular Holiday", suffix: "days", color: "#3b82f6" },
    { value: summary.specialHolidays, label: "Special Holiday", suffix: "days", color: "#a855f7" },
    { value: totalDeductionMins, label: "Late/Undertime", suffix: "mins", color: "#eab308" },
    { value: totalOtMins, label: "Total OT", suffix: "mins", color: "#22c55e" },
  ];

  cards.forEach((card, i) => {
    const x = cardsStartX + i * (cardWidth + cardGap);
    drawSummaryCard(x, cardY, card.value, card.label, card.suffix, card.color, card.color);
  });

  doc.y = cardY + cardHeight + 15;

  // -------------------------------------------------------------------------
  // Daily Attendance Table (matching UI format)
  // -------------------------------------------------------------------------
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a1a1a");
  doc.text("Daily Attendance", MARGINS.left, doc.y);
  doc.font("Helvetica").fontSize(8).fillColor("#6b7280");
  doc.text(`${data.attendanceRecords.length} day(s) in pay period`, MARGINS.left, doc.y);
  doc.moveDown(0.5);

  // Table headers matching UI
  const attHeaders = ["Date", "Day", "Shift", "Clock In", "Clock Out", "Hours", "Status", "Deduction", "Overtime", "ND"];
  const attColWidths = [50, 30, 55, 50, 50, 35, 65, 50, 50, 35]; // Total: 470
  const attTableWidth = attColWidths.reduce((a, b) => a + b, 0);
  const attRowHeight = 18;
  const attPadding = 3;
  const attFontSize = 7;

  const startX = (doc.page.width - attTableWidth) / 2;
  let startY = doc.y;

  // Helper to get day name
  const getDayName = (date: Date): string => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[new Date(date).getDay()];
  };

  // Helper to get status display - returns array for multiple badges
  // Uses the effective attendanceStatus from server (already includes priority logic)
  const getStatusDisplayMulti = (record: PayslipAttendanceDay): { label: string; bgColor: string; textColor: string; subLabel?: string }[] => {
    const hasWork = record.workedMinutes > 0;
    const status = record.attendanceStatus || "";
    const badges: { label: string; bgColor: string; textColor: string; subLabel?: string }[] = [];

    // Add work status badge for worked days
    if (hasWork) {
      badges.push({ label: "Present", bgColor: "#dcfce7", textColor: "#166534" });

      // If worked on a holiday, also show holiday badge
      if (record.holidayType || record.dayType === "REGULAR_HOLIDAY" || record.dayType === "SPECIAL_HOLIDAY") {
        const isRegular = record.holidayType === "REGULAR_HOLIDAY" || record.dayType === "REGULAR_HOLIDAY";
        badges.push({
          label: isRegular ? "Reg Hol" : "Spl Hol",
          bgColor: isRegular ? "#fef3c7" : "#e0e7ff",
          textColor: isRegular ? "#92400e" : "#4338ca",
          subLabel: record.holidayName || undefined,
        });
      }
    } else {
      // Not worked - use effective status
      switch (status) {
        case "ON_LEAVE":
          badges.push({
            label: "On Leave",
            bgColor: "#dbeafe",
            textColor: "#1e40af",
            subLabel: record.leaveTypeName || undefined,
          });
          break;
        case "REST_DAY":
          badges.push({ label: "Rest Day", bgColor: "#f3f4f6", textColor: "#374151" });
          break;
        case "REGULAR_HOLIDAY":
          badges.push({
            label: "Reg Hol",
            bgColor: "#fef3c7",
            textColor: "#92400e",
            subLabel: record.holidayName || undefined,
          });
          break;
        case "SPECIAL_HOLIDAY":
          badges.push({
            label: "Spl Hol",
            bgColor: "#e0e7ff",
            textColor: "#4338ca",
            subLabel: record.holidayName || undefined,
          });
          break;
        case "ABSENT":
          badges.push({ label: "Absent", bgColor: "#fee2e2", textColor: "#991b1b" });
          break;
        default:
          // Fallback to dayType for older records
          switch (record.dayType) {
            case "REST_DAY":
              badges.push({ label: "Rest Day", bgColor: "#f3f4f6", textColor: "#374151" });
              break;
            case "REGULAR_HOLIDAY":
              badges.push({
                label: "Reg Hol",
                bgColor: "#fef3c7",
                textColor: "#92400e",
                subLabel: record.holidayName || undefined,
              });
              break;
            case "SPECIAL_HOLIDAY":
              badges.push({
                label: "Spl Hol",
                bgColor: "#e0e7ff",
                textColor: "#4338ca",
                subLabel: record.holidayName || undefined,
              });
              break;
            case "WORKDAY":
              badges.push({ label: "Absent", bgColor: "#fee2e2", textColor: "#991b1b" });
              break;
          }
      }
    }

    return badges.length > 0 ? badges : [{ label: record.dayType || status, bgColor: "#f3f4f6", textColor: "#374151" }];
  };

  // Draw table header
  doc.font("Helvetica-Bold").fontSize(attFontSize);
  doc.fillColor("#f3f4f6").rect(startX, startY, attTableWidth, attRowHeight).fill();
  doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(startX, startY, attTableWidth, attRowHeight).stroke();

  let attColX = startX;
  doc.fillColor("#374151");
  attHeaders.forEach((header, i) => {
    const align = i >= 5 ? "right" : "left";
    doc.text(header, attColX + attPadding, startY + 5, {
      width: attColWidths[i] - attPadding * 2,
      align,
    });
    attColX += attColWidths[i];
  });

  startY += attRowHeight;

  // Sort records by date and draw rows
  const sortedRecords = [...data.attendanceRecords].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  doc.font("Helvetica").fontSize(attFontSize);

  sortedRecords.forEach((record, rowIndex) => {
    // Check for page break
    if (startY + attRowHeight > doc.page.height - 60) {
      doc.addPage();
      startY = 50;

      // Redraw header on new page
      doc.font("Helvetica-Bold").fontSize(attFontSize);
      doc.fillColor("#f3f4f6").rect(startX, startY, attTableWidth, attRowHeight).fill();
      doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(startX, startY, attTableWidth, attRowHeight).stroke();

      attColX = startX;
      doc.fillColor("#374151");
      attHeaders.forEach((header, i) => {
        const align = i >= 5 ? "right" : "left";
        doc.text(header, attColX + attPadding, startY + 5, {
          width: attColWidths[i] - attPadding * 2,
          align,
        });
        attColX += attColWidths[i];
      });
      startY += attRowHeight;
      doc.font("Helvetica").fontSize(attFontSize);
    }

    // Alternating row background
    if (rowIndex % 2 === 0) {
      doc.fillColor("#ffffff").rect(startX, startY, attTableWidth, attRowHeight).fill();
    } else {
      doc.fillColor("#f9fafb").rect(startX, startY, attTableWidth, attRowHeight).fill();
    }

    // Row border
    doc.strokeColor("#e5e7eb").lineWidth(0.3).rect(startX, startY, attTableWidth, attRowHeight).stroke();

    // Calculate values
    const lateUt = record.lateMinutes + record.undertimeMinutes;
    const otRegular = (record.earlyInApproved ? (record.otEarlyInMinutes || 0) : 0) +
                      (record.lateOutApproved ? (record.otLateOutMinutes || 0) : 0);
    const otOther = (record.otRestDayMinutes || 0) + (record.otHolidayMinutes || 0);
    const totalOt = otRegular + otOther;
    const hours = record.workedMinutes > 0 ? (record.workedMinutes / 60).toFixed(1) : "-";
    const statusBadges = getStatusDisplayMulti(record);
    const isLate = record.lateMinutes > 0;
    const isUndertime = record.undertimeMinutes > 0;

    // Date
    attColX = startX;
    const dateStr = new Date(record.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    doc.fillColor("#1a1a1a").text(dateStr, attColX + attPadding, startY + 5, {
      width: attColWidths[0] - attPadding * 2,
      align: "left",
    });
    attColX += attColWidths[0];

    // Day
    doc.fillColor("#6b7280").text(getDayName(record.date), attColX + attPadding, startY + 5, {
      width: attColWidths[1] - attPadding * 2,
      align: "left",
    });
    attColX += attColWidths[1];

    // Shift (scheduled time)
    const shiftDisplay = record.shiftTime || "-";
    doc.fillColor("#6b7280").text(shiftDisplay, attColX + attPadding, startY + 5, {
      width: attColWidths[2] - attPadding * 2,
      align: "left",
    });
    attColX += attColWidths[2];

    // Clock In (red if late)
    const clockInColor = isLate ? "#dc2626" : "#1a1a1a";
    doc.fillColor(clockInColor).text(formatTime(record.timeIn), attColX + attPadding, startY + 5, {
      width: attColWidths[3] - attPadding * 2,
      align: "left",
    });
    attColX += attColWidths[3];

    // Clock Out
    const clockOutColor = isUndertime ? "#dc2626" : "#1a1a1a";
    doc.fillColor(clockOutColor).text(formatTime(record.timeOut), attColX + attPadding, startY + 5, {
      width: attColWidths[4] - attPadding * 2,
      align: "left",
    });
    attColX += attColWidths[4];

    // Hours
    doc.fillColor("#1a1a1a").text(hours, attColX + attPadding, startY + 5, {
      width: attColWidths[5] - attPadding * 2,
      align: "right",
    });
    attColX += attColWidths[5];

    // Status badges - support multiple badges with holiday names
    const statusColWidth = attColWidths[6];
    let badgeX = attColX + attPadding;
    const badgeY = startY + 2;
    const badgeHeight = 10;
    const badgeSpacing = 2;

    // Find if any badge has a holiday name to display
    const holidayBadge = statusBadges.find(b => b.subLabel);

    if (holidayBadge) {
      // Holiday with name - show badge on top, name below
      const badgeWidth = Math.min(statusColWidth - attPadding * 2, 30);
      doc.fillColor(holidayBadge.bgColor).roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2).fill();
      doc.fillColor(holidayBadge.textColor).fontSize(5).text(holidayBadge.label, badgeX, badgeY + 2.5, {
        width: badgeWidth,
        align: "center",
      });
      // Holiday name below badge (truncated if too long)
      const holidayName = holidayBadge.subLabel!.length > 12
        ? holidayBadge.subLabel!.substring(0, 11) + "…"
        : holidayBadge.subLabel!;
      doc.fillColor("#6b7280").fontSize(4.5).text(holidayName, attColX + attPadding, badgeY + badgeHeight + 1, {
        width: statusColWidth - attPadding * 2,
        align: "left",
      });
    } else {
      // Regular badges without holiday names
      const maxBadgeWidth = (statusColWidth - attPadding * 2 - badgeSpacing * (statusBadges.length - 1)) / statusBadges.length;
      statusBadges.forEach((badge) => {
        const badgeWidth = Math.min(maxBadgeWidth, 30);
        doc.fillColor(badge.bgColor).roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2).fill();
        doc.fillColor(badge.textColor).fontSize(5).text(badge.label, badgeX, badgeY + 2.5, {
          width: badgeWidth,
          align: "center",
        });
        badgeX += badgeWidth + badgeSpacing;
      });
    }
    doc.fontSize(attFontSize);
    attColX += attColWidths[6];

    // Deduction (Late + UT) - in red
    const deductionText = lateUt > 0 ? `${lateUt}m` : "-";
    doc.fillColor(lateUt > 0 ? "#dc2626" : "#9ca3af").text(deductionText, attColX + attPadding, startY + 5, {
      width: attColWidths[7] - attPadding * 2,
      align: "right",
    });
    attColX += attColWidths[7];

    // Overtime - in green
    const otText = totalOt > 0 ? `${totalOt}m` : "-";
    doc.fillColor(totalOt > 0 ? "#16a34a" : "#9ca3af").text(otText, attColX + attPadding, startY + 5, {
      width: attColWidths[8] - attPadding * 2,
      align: "right",
    });
    attColX += attColWidths[8];

    // Night Diff - in purple
    const ndText = record.ndMinutes > 0 ? `${record.ndMinutes}m` : "-";
    doc.fillColor(record.ndMinutes > 0 ? "#7c3aed" : "#9ca3af").text(ndText, attColX + attPadding, startY + 5, {
      width: attColWidths[9] - attPadding * 2,
      align: "right",
    });

    startY += attRowHeight;
  });

  return pdfToBuffer(doc);
}
