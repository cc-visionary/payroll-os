-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('REGULAR', 'PROBATIONARY', 'CONTRACTUAL', 'CONSULTANT', 'INTERN');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'RESIGNED', 'TERMINATED', 'AWOL', 'DECEASED', 'END_OF_CONTRACT');

-- CreateEnum
CREATE TYPE "WageType" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('MONTHLY', 'SEMI_MONTHLY', 'BI_WEEKLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "EmploymentEventType" AS ENUM ('HIRE', 'REGULARIZATION', 'SALARY_CHANGE', 'ROLE_CHANGE', 'DEPARTMENT_TRANSFER', 'PROMOTION', 'DEMOTION', 'PENALTY_ISSUED', 'INCIDENT_REPORTED', 'COMMENDATION', 'SEPARATION_INITIATED', 'SEPARATION_CONFIRMED', 'REHIRE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "EmploymentEventStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftBreakType" AS ENUM ('FIXED', 'AUTO_DEDUCT', 'NO_BREAK');

-- CreateEnum
CREATE TYPE "TimeLogType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "TimeLogSource" AS ENUM ('LARK_IMPORT', 'MANUAL', 'BIOMETRIC', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'REST_DAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('WORKDAY', 'REST_DAY', 'REGULAR_HOLIDAY', 'SPECIAL_HOLIDAY', 'SPECIAL_WORKING');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('TIME_IN_OVERRIDE', 'TIME_OUT_OVERRIDE', 'OT_OVERRIDE', 'ND_OVERRIDE', 'LATE_WAIVER', 'UNDERTIME_WAIVER', 'ABSENCE_EXCUSE', 'STATUS_CHANGE', 'DAY_TYPE_CHANGE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LeaveAccrualType" AS ENUM ('NONE', 'MONTHLY', 'ANNUAL', 'TENURE_BASED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'COMPUTING', 'REVIEW', 'APPROVED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipLineCategory" AS ENUM ('BASIC_PAY', 'OVERTIME_REGULAR', 'OVERTIME_REST_DAY', 'OVERTIME_HOLIDAY', 'NIGHT_DIFFERENTIAL', 'HOLIDAY_PAY', 'REST_DAY_PAY', 'ALLOWANCE', 'REIMBURSEMENT', 'INCENTIVE', 'BONUS', 'ADJUSTMENT_ADD', 'LATE_DEDUCTION', 'UNDERTIME_DEDUCTION', 'ABSENT_DEDUCTION', 'SSS_EE', 'SSS_ER', 'PHILHEALTH_EE', 'PHILHEALTH_ER', 'PAGIBIG_EE', 'PAGIBIG_ER', 'TAX_WITHHOLDING', 'CASH_ADVANCE_DEDUCTION', 'LOAN_DEDUCTION', 'ADJUSTMENT_DEDUCT', 'OTHER_DEDUCTION');

-- CreateEnum
CREATE TYPE "StatutoryType" AS ENUM ('SSS', 'PHILHEALTH', 'PAGIBIG', 'TAX');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ATTENDANCE_FILE_IMPORT', 'ATTENDANCE_COMPUTE', 'PAYROLL_COMPUTE', 'BANK_FILE_GENERATE', 'PAYSLIP_PDF_GENERATE', 'DOCUMENT_GENERATE', 'STATUTORY_EXPORT_GENERATE', 'LEAVE_ACCRUAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tradeName" VARCHAR(255),
    "tin" VARCHAR(20),
    "sssEmployerId" VARCHAR(20),
    "philhealthEmployerId" VARCHAR(20),
    "pagibigEmployerId" VARCHAR(20),
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100),
    "province" VARCHAR(100),
    "zipCode" VARCHAR(10),
    "country" VARCHAR(2) NOT NULL DEFAULT 'PH',
    "rdoCode" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "parentDepartmentId" UUID,
    "costCenterCode" VARCHAR(20),
    "managerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" VARCHAR(255),
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "refreshToken" VARCHAR(500) NOT NULL,
    "userAgent" VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "employeeNumber" VARCHAR(20) NOT NULL,
    "userId" UUID,
    "firstName" VARCHAR(100) NOT NULL,
    "middleName" VARCHAR(100),
    "lastName" VARCHAR(100) NOT NULL,
    "suffix" VARCHAR(20),
    "nickname" VARCHAR(50),
    "birthDate" DATE,
    "gender" VARCHAR(10),
    "civilStatus" VARCHAR(20),
    "nationality" VARCHAR(50) NOT NULL DEFAULT 'Filipino',
    "personalEmail" VARCHAR(255),
    "workEmail" VARCHAR(255),
    "mobileNumber" VARCHAR(20),
    "phoneNumber" VARCHAR(20),
    "presentAddressLine1" VARCHAR(255),
    "presentAddressLine2" VARCHAR(255),
    "presentCity" VARCHAR(100),
    "presentProvince" VARCHAR(100),
    "presentZipCode" VARCHAR(10),
    "permanentAddressLine1" VARCHAR(255),
    "permanentAddressLine2" VARCHAR(255),
    "permanentCity" VARCHAR(100),
    "permanentProvince" VARCHAR(100),
    "permanentZipCode" VARCHAR(10),
    "departmentId" UUID,
    "jobTitle" VARCHAR(100),
    "jobLevel" VARCHAR(50),
    "reportsToId" UUID,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PROBATIONARY',
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" DATE NOT NULL,
    "regularizationDate" DATE,
    "separationDate" DATE,
    "separationReason" VARCHAR(50),
    "isRankAndFile" BOOLEAN NOT NULL DEFAULT true,
    "isOtEligible" BOOLEAN NOT NULL DEFAULT true,
    "isNdEligible" BOOLEAN NOT NULL DEFAULT true,
    "isHolidayPayEligible" BOOLEAN NOT NULL DEFAULT true,
    "larkUserId" VARCHAR(100),
    "larkEmployeeId" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_statutory_ids" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "idType" VARCHAR(20) NOT NULL,
    "idNumber" VARCHAR(50) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_statutory_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "bankCode" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(100) NOT NULL,
    "accountNumber" VARCHAR(50) NOT NULL,
    "accountName" VARCHAR(255) NOT NULL,
    "accountType" VARCHAR(20),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employee_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "endDate" DATE,
    "wageType" "WageType" NOT NULL,
    "baseRate" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP',
    "payFrequency" "PayFrequency" NOT NULL DEFAULT 'SEMI_MONTHLY',
    "payPeriodsPerMonth" INTEGER NOT NULL DEFAULT 2,
    "standardWorkDaysPerMonth" DECIMAL(4,1) NOT NULL DEFAULT 22,
    "standardHoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "defaultShiftTemplateId" UUID,
    "isBenefitsEligible" BOOLEAN NOT NULL DEFAULT false,
    "riceSubsidy" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "clothingAllowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "laundryAllowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "medicalAllowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transportationAllowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mealAllowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "communicationAllowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reasonCode" VARCHAR(50),
    "remarks" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "eventType" "EmploymentEventType" NOT NULL,
    "eventDate" DATE NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmploymentEventStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "documentType" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "filePath" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileSizeBytes" BIGINT,
    "mimeType" VARCHAR(100),
    "generatedFromTemplateId" UUID,
    "generatedFromEventId" UUID,
    "templateVersion" INTEGER,
    "requiresAcknowledgment" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" UUID,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "endTime" TIME(0) NOT NULL,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "breakType" "ShiftBreakType" NOT NULL DEFAULT 'AUTO_DEDUCT',
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "breakStartTime" TIME(0),
    "breakEndTime" TIME(0),
    "graceMinutesLate" INTEGER NOT NULL DEFAULT 0,
    "graceMinutesEarlyOut" INTEGER NOT NULL DEFAULT 0,
    "scheduledWorkMinutes" INTEGER NOT NULL,
    "otEarlyInEnabled" BOOLEAN NOT NULL DEFAULT false,
    "otEarlyInStartMinutes" INTEGER NOT NULL DEFAULT 0,
    "otLateOutStartMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxOtEarlyInMinutes" INTEGER,
    "maxOtLateOutMinutes" INTEGER,
    "maxOtTotalMinutes" INTEGER,
    "ndStartTime" TIME(0) NOT NULL DEFAULT '22:00:00'::time,
    "ndEndTime" TIME(0) NOT NULL DEFAULT '06:00:00'::time,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "shiftTemplateId" UUID NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "endDate" DATE,
    "scheduleType" VARCHAR(20) NOT NULL DEFAULT 'fixed',
    "workDays" INTEGER[],
    "specificDate" DATE,
    "restDays" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileSize" BIGINT,
    "fileHash" VARCHAR(64),
    "columnMapping" JSONB,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_raw_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "importId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "employeeName" VARCHAR(255),
    "date" DATE,
    "shift" VARCHAR(50),
    "clockIn" VARCHAR(20),
    "clockOut" VARCHAR(20),
    "matchedEmployeeId" UUID,
    "matchConfidence" DECIMAL(5,4),
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_raw_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_time_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "logTime" TIMESTAMPTZ NOT NULL,
    "logType" "TimeLogType" NOT NULL,
    "logDate" DATE NOT NULL,
    "sourceType" "TimeLogSource" NOT NULL,
    "sourceBatchId" UUID,
    "sourceRecordId" VARCHAR(100),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "locationAccuracy" DECIMAL(8,2),
    "locationName" VARCHAR(255),
    "deviceType" VARCHAR(50),
    "deviceId" VARCHAR(100),
    "ipAddress" VARCHAR(45),
    "enteredById" UUID,
    "manualReason" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "approvalStatus" "ApprovalStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_day_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "shiftTemplateId" UUID,
    "scheduledStartTime" TIME(0),
    "scheduledEndTime" TIME(0),
    "scheduledWorkMinutes" INTEGER,
    "scheduledBreakMinutes" INTEGER,
    "dayType" "DayType" NOT NULL,
    "holidayId" UUID,
    "actualTimeIn" TIMESTAMPTZ,
    "actualTimeOut" TIMESTAMPTZ,
    "timeInLogId" UUID,
    "timeOutLogId" UUID,
    "breakMinutesApplied" INTEGER NOT NULL DEFAULT 0,
    "isBreakApplicable" BOOLEAN NOT NULL DEFAULT true,
    "attendanceStatus" "AttendanceStatus" NOT NULL,
    "grossWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "undertimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "otEarlyInMinutes" INTEGER NOT NULL DEFAULT 0,
    "otLateOutMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeRestDayMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeHolidayMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightDiffMinutes" INTEGER NOT NULL DEFAULT 0,
    "absentMinutes" INTEGER NOT NULL DEFAULT 0,
    "otMultiplier" DECIMAL(4,2),
    "ndMultiplier" DECIMAL(4,2),
    "holidayMultiplier" DECIMAL(4,2),
    "restDayMultiplier" DECIMAL(4,2),
    "rulesetVersionId" UUID,
    "leaveRequestId" UUID,
    "leaveTypeCode" VARCHAR(20),
    "leaveHours" DECIMAL(4,2),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedByPayrollRunId" UUID,
    "lockedAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedByJobId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_day_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attendanceDayRecordId" UUID NOT NULL,
    "adjustmentType" "AdjustmentType" NOT NULL,
    "fieldName" VARCHAR(50) NOT NULL,
    "originalValue" TEXT,
    "adjustedValue" TEXT NOT NULL,
    "reasonCode" VARCHAR(50) NOT NULL,
    "reasonDetail" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "accrualType" "LeaveAccrualType" NOT NULL,
    "accrualAmount" DECIMAL(5,2),
    "accrualCap" DECIMAL(5,2),
    "minTenureDays" INTEGER NOT NULL DEFAULT 0,
    "requiresRegularization" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "isConvertible" BOOLEAN NOT NULL DEFAULT false,
    "conversionRate" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "canCarryOver" BOOLEAN NOT NULL DEFAULT false,
    "carryOverCap" DECIMAL(5,2),
    "carryOverExpiryMonths" INTEGER,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "minAdvanceDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "openingBalance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "forfeited" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "converted" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjusted" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carriedOverFromPrevious" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carryOverExpiryDate" DATE,
    "lastAccrualDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "leaveDays" DECIMAL(5,2) NOT NULL,
    "startHalf" VARCHAR(20),
    "endHalf" VARCHAR(20),
    "reason" TEXT,
    "attachmentPath" VARCHAR(500),
    "attachmentFilename" VARCHAR(255),
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "balanceDeducted" DECIMAL(5,2),
    "leaveBalanceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_calendars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendarId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "dayType" "DayType" NOT NULL,
    "isNational" BOOLEAN NOT NULL DEFAULT true,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rest_day_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rest_day_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_calendars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "payFrequency" "PayFrequency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendarId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "cutoffDate" DATE NOT NULL,
    "payDate" DATE NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payPeriodId" UUID NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalGrossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNetPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "payslipCount" INTEGER NOT NULL DEFAULT 0,
    "rulesetVersionId" UUID,
    "createdById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollRunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "grossPay" DECIMAL(12,2) NOT NULL,
    "totalEarnings" DECIMAL(12,2) NOT NULL,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "netPay" DECIMAL(12,2) NOT NULL,
    "sssEe" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sssEr" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "philhealthEe" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "philhealthEr" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pagibigEe" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pagibigEr" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ytdGrossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ytdTaxableIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ytdTaxWithheld" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payProfileSnapshot" JSONB NOT NULL,
    "pdfPath" VARCHAR(500),
    "pdfGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payslipId" UUID NOT NULL,
    "category" "PayslipLineCategory" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,4),
    "rate" DECIMAL(12,4),
    "multiplier" DECIMAL(4,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "attendanceDayRecordId" UUID,
    "manualAdjustmentId" UUID,
    "reimbursementId" UUID,
    "cashAdvanceId" UUID,
    "orIncentiveId" UUID,
    "ruleCode" VARCHAR(50),
    "ruleDescription" VARCHAR(255),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_adjustment_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollRunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "category" "PayslipLineCategory" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollRunId" UUID NOT NULL,
    "bankCode" VARCHAR(20) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileFormat" VARCHAR(50) NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "checksum" VARCHAR(64),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receiptDate" DATE NOT NULL,
    "receiptNumber" VARCHAR(100),
    "attachmentPath" VARCHAR(500),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "payrollRunId" UUID,
    "payslipLineId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "requestDate" DATE NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "amountPerInstallment" DECIMAL(12,2) NOT NULL,
    "remainingBalance" DECIMAL(12,2) NOT NULL,
    "startDeductionDate" DATE,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "fullyRepaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_incentives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "orDate" DATE NOT NULL,
    "orNumber" VARCHAR(100) NOT NULL,
    "establishment" VARCHAR(255),
    "orAmount" DECIMAL(12,2) NOT NULL,
    "businessUnit" VARCHAR(100),
    "incentiveRate" DECIMAL(5,4) NOT NULL DEFAULT 0.01,
    "calculatedBonus" DECIMAL(12,2) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "payrollRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "or_incentives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rulesets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rulesets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruleset_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rulesetId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "endDate" DATE,
    "rules" JSONB NOT NULL,
    "sssTableVersionId" UUID,
    "philhealthTableVersionId" UUID,
    "pagibigTableVersionId" UUID,
    "taxTableVersionId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ruleset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multiplier_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rulesetVersionId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "dayType" "DayType",
    "isRestDay" BOOLEAN,
    "isOvertime" BOOLEAN,
    "isNightDiff" BOOLEAN,
    "multiplier" DECIMAL(4,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "multiplier_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_table_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "StatutoryType" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "endDate" DATE,
    "tableData" JSONB NOT NULL,
    "sourceDocument" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statutory_table_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "type" "JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" VARCHAR(255),
    "result" JSONB,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryAfter" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lockedBy" VARCHAR(100),
    "lockedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jobId" UUID NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "userEmail" VARCHAR(255),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID,
    "oldValues" JSONB,
    "newValues" JSONB,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileSizeBytes" BIGINT,
    "mimeType" VARCHAR(100),
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "companies_code_idx" ON "companies"("code");

-- CreateIndex
CREATE INDEX "departments_companyId_idx" ON "departments"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_companyId_code_key" ON "departments"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_companyId_employmentStatus_idx" ON "employees"("companyId", "employmentStatus");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_larkUserId_idx" ON "employees"("larkUserId");

-- CreateIndex
CREATE INDEX "employees_lastName_firstName_idx" ON "employees"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_employeeNumber_key" ON "employees"("companyId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "employee_statutory_ids_employeeId_idType_key" ON "employee_statutory_ids"("employeeId", "idType");

-- CreateIndex
CREATE INDEX "employee_bank_accounts_employeeId_idx" ON "employee_bank_accounts"("employeeId");

-- CreateIndex
CREATE INDEX "pay_profiles_employeeId_endDate_idx" ON "pay_profiles"("employeeId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "pay_profiles_employeeId_effectiveDate_key" ON "pay_profiles"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "employment_events_employeeId_eventType_idx" ON "employment_events"("employeeId", "eventType");

-- CreateIndex
CREATE INDEX "employment_events_eventDate_idx" ON "employment_events"("eventDate");

-- CreateIndex
CREATE INDEX "employee_documents_employeeId_documentType_idx" ON "employee_documents"("employeeId", "documentType");

-- CreateIndex
CREATE INDEX "shift_templates_companyId_isActive_idx" ON "shift_templates"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_companyId_code_key" ON "shift_templates"("companyId", "code");

-- CreateIndex
CREATE INDEX "employee_schedules_employeeId_effectiveDate_endDate_idx" ON "employee_schedules"("employeeId", "effectiveDate", "endDate");

-- CreateIndex
CREATE INDEX "employee_schedules_employeeId_specificDate_idx" ON "employee_schedules"("employeeId", "specificDate");

-- CreateIndex
CREATE INDEX "attendance_imports_companyId_createdAt_idx" ON "attendance_imports"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "attendance_imports_fileHash_idx" ON "attendance_imports"("fileHash");

-- CreateIndex
CREATE INDEX "attendance_raw_rows_importId_rowNumber_idx" ON "attendance_raw_rows"("importId", "rowNumber");

-- CreateIndex
CREATE INDEX "attendance_raw_rows_matchedEmployeeId_idx" ON "attendance_raw_rows"("matchedEmployeeId");

-- CreateIndex
CREATE INDEX "raw_time_logs_employeeId_logDate_idx" ON "raw_time_logs"("employeeId", "logDate");

-- CreateIndex
CREATE INDEX "raw_time_logs_sourceBatchId_idx" ON "raw_time_logs"("sourceBatchId");

-- CreateIndex
CREATE INDEX "raw_time_logs_sourceType_sourceRecordId_idx" ON "raw_time_logs"("sourceType", "sourceRecordId");

-- CreateIndex
CREATE INDEX "attendance_day_records_attendanceDate_idx" ON "attendance_day_records"("attendanceDate");

-- CreateIndex
CREATE INDEX "attendance_day_records_lockedByPayrollRunId_idx" ON "attendance_day_records"("lockedByPayrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_day_records_employeeId_attendanceDate_key" ON "attendance_day_records"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "attendance_adjustments_attendanceDayRecordId_idx" ON "attendance_adjustments"("attendanceDayRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_companyId_code_key" ON "leave_types"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_leaveTypeId_year_key" ON "leave_balances"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_startDate_endDate_idx" ON "leave_requests"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendars_companyId_year_key" ON "holiday_calendars"("companyId", "year");

-- CreateIndex
CREATE INDEX "calendar_events_date_idx" ON "calendar_events"("date");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_calendarId_date_key" ON "calendar_events"("calendarId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_calendars_companyId_year_payFrequency_key" ON "payroll_calendars"("companyId", "year", "payFrequency");

-- CreateIndex
CREATE INDEX "pay_periods_startDate_endDate_idx" ON "pay_periods"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_calendarId_code_key" ON "pay_periods"("calendarId", "code");

-- CreateIndex
CREATE INDEX "payroll_runs_payPeriodId_idx" ON "payroll_runs"("payPeriodId");

-- CreateIndex
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

-- CreateIndex
CREATE INDEX "payslips_employeeId_idx" ON "payslips"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payrollRunId_employeeId_key" ON "payslips"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "payslip_lines_payslipId_category_idx" ON "payslip_lines"("payslipId", "category");

-- CreateIndex
CREATE INDEX "manual_adjustment_lines_payrollRunId_employeeId_idx" ON "manual_adjustment_lines"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "bank_files_payrollRunId_idx" ON "bank_files"("payrollRunId");

-- CreateIndex
CREATE INDEX "reimbursements_employeeId_status_idx" ON "reimbursements"("employeeId", "status");

-- CreateIndex
CREATE INDEX "cash_advances_employeeId_status_idx" ON "cash_advances"("employeeId", "status");

-- CreateIndex
CREATE INDEX "or_incentives_employeeId_status_idx" ON "or_incentives"("employeeId", "status");

-- CreateIndex
CREATE INDEX "or_incentives_orDate_idx" ON "or_incentives"("orDate");

-- CreateIndex
CREATE UNIQUE INDEX "rulesets_companyId_code_key" ON "rulesets"("companyId", "code");

-- CreateIndex
CREATE INDEX "ruleset_versions_effectiveDate_idx" ON "ruleset_versions"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "ruleset_versions_rulesetId_version_key" ON "ruleset_versions"("rulesetId", "version");

-- CreateIndex
CREATE INDEX "multiplier_rules_rulesetVersionId_priority_idx" ON "multiplier_rules"("rulesetVersionId", "priority");

-- CreateIndex
CREATE INDEX "statutory_table_versions_type_effectiveDate_idx" ON "statutory_table_versions"("type", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_table_versions_type_version_key" ON "statutory_table_versions"("type", "version");

-- CreateIndex
CREATE INDEX "jobs_status_priority_createdAt_idx" ON "jobs"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");

-- CreateIndex
CREATE INDEX "jobs_companyId_createdAt_idx" ON "jobs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_lockedBy_lockedAt_idx" ON "jobs"("lockedBy", "lockedAt");

-- CreateIndex
CREATE INDEX "job_logs_jobId_createdAt_idx" ON "job_logs"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_statutory_ids" ADD CONSTRAINT "employee_statutory_ids_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_statutory_ids" ADD CONSTRAINT "employee_statutory_ids_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_defaultShiftTemplateId_fkey" FOREIGN KEY ("defaultShiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_generatedFromEventId_fkey" FOREIGN KEY ("generatedFromEventId") REFERENCES "employment_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_raw_rows" ADD CONSTRAINT "attendance_raw_rows_importId_fkey" FOREIGN KEY ("importId") REFERENCES "attendance_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_time_logs" ADD CONSTRAINT "raw_time_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_time_logs" ADD CONSTRAINT "raw_time_logs_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "attendance_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_time_logs" ADD CONSTRAINT "raw_time_logs_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_time_logs" ADD CONSTRAINT "raw_time_logs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_timeInLogId_fkey" FOREIGN KEY ("timeInLogId") REFERENCES "raw_time_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_timeOutLogId_fkey" FOREIGN KEY ("timeOutLogId") REFERENCES "raw_time_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_rulesetVersionId_fkey" FOREIGN KEY ("rulesetVersionId") REFERENCES "ruleset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_lockedByPayrollRunId_fkey" FOREIGN KEY ("lockedByPayrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_computedByJobId_fkey" FOREIGN KEY ("computedByJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_attendanceDayRecordId_fkey" FOREIGN KEY ("attendanceDayRecordId") REFERENCES "attendance_day_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveBalanceId_fkey" FOREIGN KEY ("leaveBalanceId") REFERENCES "leave_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_calendars" ADD CONSTRAINT "holiday_calendars_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "holiday_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_calendars" ADD CONSTRAINT "payroll_calendars_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "payroll_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_rulesetVersionId_fkey" FOREIGN KEY ("rulesetVersionId") REFERENCES "ruleset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_attendanceDayRecordId_fkey" FOREIGN KEY ("attendanceDayRecordId") REFERENCES "attendance_day_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_manualAdjustmentId_fkey" FOREIGN KEY ("manualAdjustmentId") REFERENCES "manual_adjustment_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "reimbursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_cashAdvanceId_fkey" FOREIGN KEY ("cashAdvanceId") REFERENCES "cash_advances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_orIncentiveId_fkey" FOREIGN KEY ("orIncentiveId") REFERENCES "or_incentives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_files" ADD CONSTRAINT "bank_files_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_incentives" ADD CONSTRAINT "or_incentives_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_incentives" ADD CONSTRAINT "or_incentives_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_incentives" ADD CONSTRAINT "or_incentives_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rulesets" ADD CONSTRAINT "rulesets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "rulesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_sssTableVersionId_fkey" FOREIGN KEY ("sssTableVersionId") REFERENCES "statutory_table_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_philhealthTableVersionId_fkey" FOREIGN KEY ("philhealthTableVersionId") REFERENCES "statutory_table_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_pagibigTableVersionId_fkey" FOREIGN KEY ("pagibigTableVersionId") REFERENCES "statutory_table_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_taxTableVersionId_fkey" FOREIGN KEY ("taxTableVersionId") REFERENCES "statutory_table_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multiplier_rules" ADD CONSTRAINT "multiplier_rules_rulesetVersionId_fkey" FOREIGN KEY ("rulesetVersionId") REFERENCES "ruleset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
