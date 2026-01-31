// =============================================================================
// PeopleOS PH - Permission Definitions
// =============================================================================
// Central definition of all permissions in the system.
// Permissions follow the pattern: resource:action
// =============================================================================

/**
 * All available permissions in PeopleOS.
 * Pattern: RESOURCE_ACTION
 */
export const Permission = {
  // Employee Management
  EMPLOYEE_VIEW: "employee:view",
  EMPLOYEE_CREATE: "employee:create",
  EMPLOYEE_EDIT: "employee:edit",
  EMPLOYEE_DELETE: "employee:delete",
  EMPLOYEE_VIEW_SENSITIVE: "employee:view_sensitive", // SSS, TIN, bank details

  // Pay Profile Management
  PAY_PROFILE_VIEW: "pay_profile:view",
  PAY_PROFILE_EDIT: "pay_profile:edit",
  PAY_PROFILE_APPROVE: "pay_profile:approve",

  // Attendance & Timekeeping
  ATTENDANCE_VIEW: "attendance:view",
  ATTENDANCE_IMPORT: "attendance:import",
  ATTENDANCE_EDIT: "attendance:edit",
  ATTENDANCE_ADJUST: "attendance:adjust",
  ATTENDANCE_APPROVE_ADJUSTMENT: "attendance:approve_adjustment",

  // Leave Management
  LEAVE_VIEW: "leave:view",
  LEAVE_REQUEST: "leave:request",
  LEAVE_APPROVE: "leave:approve",

  // Payroll Operations
  PAYROLL_VIEW: "payroll:view",
  PAYROLL_RUN: "payroll:run",
  PAYROLL_EDIT: "payroll:edit",
  PAYROLL_APPROVE: "payroll:approve",
  PAYROLL_RELEASE: "payroll:release",

  // Payslips
  PAYSLIP_VIEW_OWN: "payslip:view_own",
  PAYSLIP_VIEW_ALL: "payslip:view_all",
  PAYSLIP_GENERATE: "payslip:generate",

  // Exports & Reports
  EXPORT_BANK_FILE: "export:bank_file",
  EXPORT_STATUTORY: "export:statutory",
  EXPORT_PAYROLL_REGISTER: "export:payroll_register",
  REPORT_VIEW: "report:view",

  // Document Generation
  DOCUMENT_GENERATE: "document:generate",
  DOCUMENT_VIEW: "document:view",

  // Reimbursements
  REIMBURSEMENT_VIEW: "reimbursement:view",
  REIMBURSEMENT_REQUEST: "reimbursement:request",
  REIMBURSEMENT_APPROVE: "reimbursement:approve",

  // Cash Advances
  CASH_ADVANCE_VIEW: "cash_advance:view",
  CASH_ADVANCE_REQUEST: "cash_advance:request",
  CASH_ADVANCE_APPROVE: "cash_advance:approve",

  // OR Incentives
  OR_INCENTIVE_VIEW: "or_incentive:view",
  OR_INCENTIVE_SUBMIT: "or_incentive:submit",
  OR_INCENTIVE_APPROVE: "or_incentive:approve",

  // Department Management
  DEPARTMENT_VIEW: "department:view",
  DEPARTMENT_MANAGE: "department:manage",

  // Leave Types Management
  LEAVE_TYPE_VIEW: "leave_type:view",
  LEAVE_TYPE_MANAGE: "leave_type:manage",

  // Role Scorecard Management
  ROLE_SCORECARD_VIEW: "role_scorecard:view",
  ROLE_SCORECARD_MANAGE: "role_scorecard:manage",

  // Hiring / Applicant Tracking
  HIRING_VIEW: "hiring:view",
  HIRING_CREATE: "hiring:create",
  HIRING_EDIT: "hiring:edit",
  HIRING_CONVERT: "hiring:convert", // Convert applicant to employee

  // Shifts & Schedules
  SHIFT_VIEW: "shift:view",
  SHIFT_MANAGE: "shift:manage",
  SCHEDULE_VIEW: "schedule:view",
  SCHEDULE_MANAGE: "schedule:manage",

  // Holiday Calendar
  CALENDAR_VIEW: "calendar:view",
  CALENDAR_MANAGE: "calendar:manage",

  // Rulesets
  RULESET_VIEW: "ruleset:view",
  RULESET_MANAGE: "ruleset:manage",

  // User & Role Management
  USER_VIEW: "user:view",
  USER_MANAGE: "user:manage",
  ROLE_VIEW: "role:view",
  ROLE_MANAGE: "role:manage",

  // Audit Logs
  AUDIT_VIEW: "audit:view",

  // System Administration
  SYSTEM_SETTINGS: "system:settings",
} as const;

export type PermissionKey = keyof typeof Permission;
export type PermissionValue = (typeof Permission)[PermissionKey];

/**
 * Role definitions with their default permissions.
 * These are used during seeding and can be customized per company.
 */
export const RolePermissions: Record<string, PermissionValue[]> = {
  // Super Admin - full system access
  SUPER_ADMIN: Object.values(Permission),

  // HR Admin - manages employees, attendance, leaves
  HR_ADMIN: [
    Permission.EMPLOYEE_VIEW,
    Permission.EMPLOYEE_CREATE,
    Permission.EMPLOYEE_EDIT,
    Permission.EMPLOYEE_DELETE,
    Permission.EMPLOYEE_VIEW_SENSITIVE,
    Permission.PAY_PROFILE_VIEW,
    Permission.PAY_PROFILE_EDIT,
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_IMPORT,
    Permission.ATTENDANCE_EDIT,
    Permission.ATTENDANCE_ADJUST,
    Permission.ATTENDANCE_APPROVE_ADJUSTMENT,
    Permission.LEAVE_VIEW,
    Permission.LEAVE_APPROVE,
    Permission.PAYSLIP_VIEW_ALL,
    Permission.DOCUMENT_GENERATE,
    Permission.DOCUMENT_VIEW,
    Permission.REIMBURSEMENT_VIEW,
    Permission.REIMBURSEMENT_APPROVE,
    Permission.CASH_ADVANCE_VIEW,
    Permission.CASH_ADVANCE_APPROVE,
    Permission.OR_INCENTIVE_VIEW,
    Permission.OR_INCENTIVE_APPROVE,
    Permission.SHIFT_VIEW,
    Permission.SHIFT_MANAGE,
    Permission.SCHEDULE_VIEW,
    Permission.SCHEDULE_MANAGE,
    Permission.CALENDAR_VIEW,
    Permission.CALENDAR_MANAGE,
    Permission.DEPARTMENT_VIEW,
    Permission.DEPARTMENT_MANAGE,
    Permission.LEAVE_TYPE_VIEW,
    Permission.LEAVE_TYPE_MANAGE,
    Permission.ROLE_SCORECARD_VIEW,
    Permission.ROLE_SCORECARD_MANAGE,
    Permission.HIRING_VIEW,
    Permission.HIRING_CREATE,
    Permission.HIRING_EDIT,
    Permission.HIRING_CONVERT,
    Permission.USER_VIEW,
    Permission.REPORT_VIEW,
    Permission.AUDIT_VIEW,
  ],

  // Payroll Admin - runs and manages payroll
  PAYROLL_ADMIN: [
    Permission.EMPLOYEE_VIEW,
    Permission.EMPLOYEE_VIEW_SENSITIVE,
    Permission.PAY_PROFILE_VIEW,
    Permission.PAY_PROFILE_EDIT,
    Permission.PAY_PROFILE_APPROVE,
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_IMPORT,
    Permission.PAYROLL_VIEW,
    Permission.PAYROLL_RUN,
    Permission.PAYROLL_EDIT,
    Permission.PAYSLIP_VIEW_ALL,
    Permission.PAYSLIP_GENERATE,
    Permission.EXPORT_BANK_FILE,
    Permission.EXPORT_STATUTORY,
    Permission.EXPORT_PAYROLL_REGISTER,
    Permission.REPORT_VIEW,
    Permission.REIMBURSEMENT_VIEW,
    Permission.CASH_ADVANCE_VIEW,
    Permission.OR_INCENTIVE_VIEW,
    Permission.SHIFT_VIEW,
    Permission.SCHEDULE_VIEW,
    Permission.CALENDAR_VIEW,
    Permission.RULESET_VIEW,
  ],

  // Finance Manager - approves payroll, views reports
  FINANCE_MANAGER: [
    Permission.EMPLOYEE_VIEW,
    Permission.PAY_PROFILE_VIEW,
    Permission.ATTENDANCE_VIEW,
    Permission.PAYROLL_VIEW,
    Permission.PAYROLL_APPROVE,
    Permission.PAYROLL_RELEASE,
    Permission.PAYSLIP_VIEW_ALL,
    Permission.EXPORT_BANK_FILE,
    Permission.EXPORT_STATUTORY,
    Permission.EXPORT_PAYROLL_REGISTER,
    Permission.REPORT_VIEW,
    Permission.REIMBURSEMENT_VIEW,
    Permission.REIMBURSEMENT_APPROVE,
    Permission.CASH_ADVANCE_VIEW,
    Permission.CASH_ADVANCE_APPROVE,
    Permission.AUDIT_VIEW,
  ],

  // Team Lead / Manager - approves team leaves, views team attendance
  MANAGER: [
    Permission.EMPLOYEE_VIEW,
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_APPROVE_ADJUSTMENT,
    Permission.LEAVE_VIEW,
    Permission.LEAVE_APPROVE,
    Permission.PAYSLIP_VIEW_OWN,
    Permission.SCHEDULE_VIEW,
    Permission.REIMBURSEMENT_VIEW,
    Permission.REIMBURSEMENT_APPROVE,
  ],

  // Regular Employee - self-service only
  EMPLOYEE: [
    Permission.ATTENDANCE_VIEW, // Own attendance only (enforced at query level)
    Permission.LEAVE_VIEW,
    Permission.LEAVE_REQUEST,
    Permission.PAYSLIP_VIEW_OWN,
    Permission.REIMBURSEMENT_REQUEST,
    Permission.CASH_ADVANCE_REQUEST,
    Permission.OR_INCENTIVE_SUBMIT,
    Permission.SCHEDULE_VIEW, // Own schedule only
  ],
};

/**
 * Permission groups for UI display and bulk assignment.
 */
export const PermissionGroups = {
  "Employee Management": [
    Permission.EMPLOYEE_VIEW,
    Permission.EMPLOYEE_CREATE,
    Permission.EMPLOYEE_EDIT,
    Permission.EMPLOYEE_DELETE,
    Permission.EMPLOYEE_VIEW_SENSITIVE,
  ],
  "Pay Profiles": [
    Permission.PAY_PROFILE_VIEW,
    Permission.PAY_PROFILE_EDIT,
    Permission.PAY_PROFILE_APPROVE,
  ],
  Attendance: [
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_IMPORT,
    Permission.ATTENDANCE_EDIT,
    Permission.ATTENDANCE_ADJUST,
    Permission.ATTENDANCE_APPROVE_ADJUSTMENT,
  ],
  Leave: [Permission.LEAVE_VIEW, Permission.LEAVE_REQUEST, Permission.LEAVE_APPROVE],
  Payroll: [
    Permission.PAYROLL_VIEW,
    Permission.PAYROLL_RUN,
    Permission.PAYROLL_EDIT,
    Permission.PAYROLL_APPROVE,
    Permission.PAYROLL_RELEASE,
  ],
  Payslips: [
    Permission.PAYSLIP_VIEW_OWN,
    Permission.PAYSLIP_VIEW_ALL,
    Permission.PAYSLIP_GENERATE,
  ],
  "Exports & Reports": [
    Permission.EXPORT_BANK_FILE,
    Permission.EXPORT_STATUTORY,
    Permission.EXPORT_PAYROLL_REGISTER,
    Permission.REPORT_VIEW,
  ],
  Documents: [Permission.DOCUMENT_GENERATE, Permission.DOCUMENT_VIEW],
  Reimbursements: [
    Permission.REIMBURSEMENT_VIEW,
    Permission.REIMBURSEMENT_REQUEST,
    Permission.REIMBURSEMENT_APPROVE,
  ],
  "Cash Advances": [
    Permission.CASH_ADVANCE_VIEW,
    Permission.CASH_ADVANCE_REQUEST,
    Permission.CASH_ADVANCE_APPROVE,
  ],
  "OR Incentives": [
    Permission.OR_INCENTIVE_VIEW,
    Permission.OR_INCENTIVE_SUBMIT,
    Permission.OR_INCENTIVE_APPROVE,
  ],
  Departments: [Permission.DEPARTMENT_VIEW, Permission.DEPARTMENT_MANAGE],
  "Leave Types": [Permission.LEAVE_TYPE_VIEW, Permission.LEAVE_TYPE_MANAGE],
  "Role Scorecards": [Permission.ROLE_SCORECARD_VIEW, Permission.ROLE_SCORECARD_MANAGE],
  Hiring: [
    Permission.HIRING_VIEW,
    Permission.HIRING_CREATE,
    Permission.HIRING_EDIT,
    Permission.HIRING_CONVERT,
  ],
  Scheduling: [
    Permission.SHIFT_VIEW,
    Permission.SHIFT_MANAGE,
    Permission.SCHEDULE_VIEW,
    Permission.SCHEDULE_MANAGE,
  ],
  Calendar: [Permission.CALENDAR_VIEW, Permission.CALENDAR_MANAGE],
  Rulesets: [Permission.RULESET_VIEW, Permission.RULESET_MANAGE],
  "User Management": [
    Permission.USER_VIEW,
    Permission.USER_MANAGE,
    Permission.ROLE_VIEW,
    Permission.ROLE_MANAGE,
  ],
  System: [Permission.AUDIT_VIEW, Permission.SYSTEM_SETTINGS],
} as const;
