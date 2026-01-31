PeopleOS PH — SPEC V1 (Payroll-First + HR Workflow Docs)
0) Purpose

Build an internal HR admin tool that:

Computes payroll accurately from attendance import + manual adjustments.

Automates HR paperwork with a lightweight Workflow + Document Templates engine:

Salary change memo

Regularization memo

Disciplinary documents (NTE, NOD)

Separation pack (COE, quitclaim, final pay summary)

Hiring docs only at document automation level (Offer Letter / Employment Contract / NDA) — no full ATS.

1) Non-negotiable constraints

Attendance is import-only (CSV/XLSX from Lark). No Lark Attendance API in V1.

Employee self-serve forms remain in Lark (reimbursement, cash advance, etc.).

Manual pay items from Lark are encoded via ManualAdjustmentLine per employee per payroll run.

The Attendance UI and Payroll computation must share one canonical attendance calculator function.

Avoid storing “derived” values that drift (worked hours, multipliers, etc.). Compute from raw time + shift + approvals.

2) In-scope modules (V1)
A) Core Admin + Security

Users, roles, RBAC

Audit logs (append-only)

Basic company settings

B) Employee Directory (HR master file)

Employee records (201 essentials)

Role/position assignment (can be RoleScorecard or simple jobTitle)

Regularization date (affects statutory deductions eligibility)

Bank details (for bank export)

Government IDs (optional)

C) Attendance (Import + Review)

Import attendance batch files

Per-employee daily attendance view

Calculates:

base worked minutes (schedule bounded)

late/undertime minutes (always deducted unless explicitly excused)

approved OT minutes (only if approved)

No employee schedule module; shift comes from:

employee default shift template OR shift code from import mapping.

D) Payroll

Payroll periods + payroll runs

Payslip generation + breakdown lines

Late/UT deductions, OT pay (bucketed by day type)

Holiday handling limited to: WORKDAY / REST_DAY / REGULAR_HOLIDAY / SPECIAL_HOLIDAY

Statutory contributions (SSS/PhilHealth/Pag-IBIG) only if regularized

Bank export file generation (basic CSV export in V1; bank-specific formats later)

E) HR Workflow + Document Automation (V1-limited)

A lightweight workflow engine that supports:

workflow instances bound to an employee + an event type

step assignments + approvals

document generation from templates + variables

storage of generated documents + audit trail

Supported workflow types (V1):

Hiring (document automation only)

Regularization

Salary Change

Role Change (optional doc)

Disciplinary (NTE, NOD)

Separation (pack: COE, quitclaim, final pay summary)

Repayment Agreement (optional)

Not included in V1:

full ATS / applicant tracking pipeline UI (you can still generate offer letter from “manual candidate details”)

full clearance system with multi-department signoffs

e-signature platform (store acknowledgment status only)

3) Out-of-scope for V1 (explicit)

Drop or ignore for now:

Applicant tracking (Applicants/Interviews)

Leave management (Leave balances/requests/accrual)

Performance check-ins (OKRs/monthly reviews)

Job queue system tables (jobs/logs) unless already needed for imports

Ruleset versioning tables (use a config file / constants in V1)

13th month accrual tables (compute on-demand from payslips YTD)

Separation clearance multi-step signoffs (replace with a simple checklist doc template if needed)

4) Core workflows (how things actually work)
4.1 Attendance calculation (canonical)

For each day:

Inputs

shift window: scheduled_start, scheduled_end (from ShiftTemplate)

actual_in, actual_out (from import)

approvals: earlyInApproved, lateOutApproved

optional excusal flags: lateInApproved, earlyOutApproved (if you support “excuse late/UT”)

Compute

Late minutes = max(0, actual_in - scheduled_start) unless lateInApproved

Early out minutes = max(0, scheduled_end - actual_out) unless earlyOutApproved

Late/UT total = late + early_out (always deducted)

Base worked minutes = clamp(actual_in..actual_out into scheduled window) - break rules

OT minutes:

early OT = scheduled_start - actual_in if earlyInApproved

late OT = actual_out - scheduled_end if lateOutApproved

Important

If no actual logs / worked minutes is effectively 0 → no OT and no premiums.

4.2 Payroll computation (V1)

For each employee per pay period:

Determine minute_rate:

Default: minute_rate = daily_rate / 8 / 60

daily_rate comes from:

monthly_rate / 26 (your current standard)

or explicit daily_rate if wage type is daily

Compute payslip lines:

BASIC_PAY

LATE_UT_DEDUCTION = minute_rate * total_late_ut_minutes

OT pay bucketed:

OT_REGULAR_DAY

OT_REGULAR_HOLIDAY

OT_SPECIAL_HOLIDAY

(optional) OT_REST_DAY

Holiday premium (only if you explicitly decide; otherwise treat holiday pay logic separately)

Manual adjustments (earn/deduct)

Statutory deductions apply only if employee is regularized as of period date.

5) HR Workflow + Document Automation
5.1 Principles

Workflow = steps + approvals + generated documents.

Workflow is initiated by HR (manual), except:

Regularization can be auto-suggested (but still initiated manually in V1).

Generated docs are stored as immutable artifacts (HTML/PDF), linked to workflow and employee.

5.2 Supported workflow types (V1 detail)
(1) Hiring Workflow (Document automation only)

Trigger: HR initiates “Hiring Docs” workflow for a candidate (manual entry)

Steps (V1 minimal)

Enter Candidate details (name, role, pay offer, start date)

Generate Offer Letter

Generate Employment Contract (with Role Scorecard as Annex A if available)

Generate NDA (optional flag)

Mark “Accepted” (manual toggle)

Documents

Offer Letter

Employment Contract

NDA (optional)

Note: No applicant pipeline. This is “document pack generator,” not ATS.

(2) Regularization Workflow

Trigger: HR initiates (optionally reminded at hireDate+5 months)

Steps:

Manager evaluation input (simple text + rating)

HR approve/reject

Generate Regularization Memo

Update employee status/reg date

Documents:

Regularization Memorandum

(3) Salary Change Workflow

Steps:

HR inputs new rate + effective date + reason

Approval

Generate Salary Change Memo

Update pay profile / role scorecard override

Documents:

Salary Change Memorandum

(4) Disciplinary Workflow (V1 minimal progressive discipline)

Steps:

Incident logged (simple record + attachments)

Generate NTE

Employee explanation uploaded (as attachment)

Decision recorded

Generate NOD

Optional: Generate Warning/Suspension memo

Documents:

Notice to Explain (NTE)

Notice of Decision (NOD)

Warning Letter / Suspension Memo (optional)

(5) Separation Workflow (Doc pack)

Steps:

Separation initiated (last day, reason)

Generate Final Pay Summary (from payroll engine or estimate)

Generate Quitclaim + COE

Mark completed

Documents:

Final Pay Computation Summary

Quitclaim and Release

Certificate of Employment

(6) Repayment Agreement Workflow (optional V1)

Steps:

Record amount + reason

Choose repayment method: lump sum / payroll deduction

Generate repayment agreement

Track deductions via ManualAdjustmentLines in payroll runs

Documents:

Repayment Agreement

6) Minimal database schema (V1 target)
Keep core payroll tables

Company

User, Role, UserRole, Session (optional)

AuditLog

Employee

EmployeeBankAccount (optional but useful)

ShiftTemplate

AttendanceImport

AttendanceDayRecord (MINIMAL: raw + approvals + references only)

PayrollCalendar, PayPeriod, PayrollRun

Payslip, PayslipLine

ManualAdjustmentLine

BankFile (optional)

HolidayCalendar, CalendarEvent (optional but helpful)

Add workflow + docs tables (minimal)

You can implement workflows with only 4 tables:

WorkflowTemplate (optional in V1)

If you want configurable templates. If not, hardcode workflow definitions in code.

WorkflowInstance

employeeId (required)

workflowType

status

context JSON (inputs like new salary, incident details, candidate details)

initiatedById

WorkflowStep

workflowInstanceId

stepIndex

stepType

status

assignedToId (optional)

approvalStatus (optional)

result JSON (captured output)

DocumentTemplate + GeneratedDocument

DocumentTemplate: code, name, templateBody (HTML), version, variables schema

GeneratedDocument: employeeId, workflowInstanceId, templateId, renderedPath/blob, status, acknowledgedAt

If you already have EmployeeDocument, you can reuse it instead of creating GeneratedDocument.

7) UI scope (V1)
HR Admin screens

Employees: list/detail

Attendance:

Import page (upload + validation report)

Employee attendance table

Payroll:

Payroll runs list

Payslip detail with:

minute rate displayed

OT buckets displayed

late/UT deduction displayed

manual adjustments tab

Workflows:

Workflow dashboard (instances)

Workflow detail: steps + generated docs

Template manager (optional V1)

8) Acceptance criteria (V1)

Payroll acceptance:

Payslip shows correct:

minute rate

late/UT deduction

OT bucketed by day type

holiday OT not mixed with regular OT

No OT or premiums on rest days without logs.

Workflow acceptance:

HR can generate:

salary change memo

regularization memo

disciplinary NTE + NOD

separation pack (COE + quitclaim + final pay summary)

hiring doc pack (offer letter + contract + NDA)