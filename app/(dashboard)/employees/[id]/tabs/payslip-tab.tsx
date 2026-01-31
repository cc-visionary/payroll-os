"use client";

// =============================================================================
// PeopleOS PH - Payslip Tab
// =============================================================================

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getPayslipDetailAction } from "@/app/actions/employees";
import type {
  EmployeePayslipSummary,
  PayslipLineItem,
} from "@/lib/data/employees";

// Local type for payslip detail (matches server action response)
interface PayslipDetail {
  id: string;
  payslipNumber: string | null;
  payPeriodCode: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payrollRunStatus: string;
  grossPay: string;
  totalEarnings: string;
  totalDeductions: string;
  netPay: string;
  sssEe: string;
  sssEr: string;
  philhealthEe: string;
  philhealthEr: string;
  pagibigEe: string;
  pagibigEr: string;
  withholdingTax: string;
  ytdGrossPay: string;
  ytdTaxableIncome: string;
  ytdTaxWithheld: string;
  lines: PayslipLineItem[];
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  createdAt: string;
}

interface PayslipTabProps {
  employeeId: string;
  payslips: EmployeePayslipSummary[];
}

// Categorize line items
const EARNING_CATEGORIES = [
  "BASIC_PAY",
  "OVERTIME_REGULAR",
  "OVERTIME_REST_DAY",
  "OVERTIME_HOLIDAY",
  "NIGHT_DIFFERENTIAL",
  "HOLIDAY_PAY",
  "REST_DAY_PAY",
  "ALLOWANCE",
  "REIMBURSEMENT",
  "INCENTIVE",
  "BONUS",
  "ADJUSTMENT_ADD",
  "THIRTEENTH_MONTH_PAY",
];

const DEDUCTION_CATEGORIES = [
  "LATE_DEDUCTION",
  "UNDERTIME_DEDUCTION",
  "LATE_UT_DEDUCTION",
  "ABSENT_DEDUCTION",
  "SSS_EE",
  "PHILHEALTH_EE",
  "PAGIBIG_EE",
  "WITHHOLDING_TAX",
  "CASH_ADVANCE",
  "LOAN_DEDUCTION",
  "ADJUSTMENT_DEDUCT",
  "OTHER_DEDUCTION",
];

export function PayslipTab({
  employeeId,
  payslips,
}: PayslipTabProps) {
  const [expandedPayslipId, setExpandedPayslipId] = useState<string | null>(
    null
  );
  const [payslipDetails, setPayslipDetails] = useState<
    Record<string, PayslipDetail>
  >({});
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggleExpand = async (payslipId: string) => {
    if (expandedPayslipId === payslipId) {
      setExpandedPayslipId(null);
      return;
    }

    // Load details if not already loaded
    if (!payslipDetails[payslipId]) {
      setLoading(payslipId);
      const result = await getPayslipDetailAction(employeeId, payslipId);
      if (result.success && result.data) {
        setPayslipDetails((prev) => ({ ...prev, [payslipId]: result.data! }));
      }
      setLoading(null);
    }

    setExpandedPayslipId(payslipId);
  };

  const categorizeLines = (lines: PayslipLineItem[]) => {
    const earnings = lines.filter((l) => EARNING_CATEGORIES.includes(l.category));
    const deductions = lines.filter(
      (l) => DEDUCTION_CATEGORIES.includes(l.category) || !EARNING_CATEGORIES.includes(l.category)
    );
    return { earnings, deductions };
  };

  const formatLineCategory = (category: string): string => {
    const map: Record<string, string> = {
      BASIC_PAY: "Basic Pay",
      OVERTIME_REGULAR: "Regular OT",
      OVERTIME_REST_DAY: "Rest Day OT",
      OVERTIME_HOLIDAY: "Holiday OT",
      NIGHT_DIFFERENTIAL: "Night Differential",
      HOLIDAY_PAY: "Holiday Pay",
      REST_DAY_PAY: "Rest Day Pay",
      ALLOWANCE: "Allowance",
      REIMBURSEMENT: "Reimbursement",
      INCENTIVE: "Incentive",
      BONUS: "Bonus",
      ADJUSTMENT_ADD: "Adjustment (+)",
      THIRTEENTH_MONTH_PAY: "13th Month Pay",
      LATE_DEDUCTION: "Late",
      UNDERTIME_DEDUCTION: "Undertime",
      LATE_UT_DEDUCTION: "Late/Undertime",
      ABSENT_DEDUCTION: "Absent",
      SSS_EE: "SSS (EE)",
      SSS_ER: "SSS (ER)",
      PHILHEALTH_EE: "PhilHealth (EE)",
      PHILHEALTH_ER: "PhilHealth (ER)",
      PAGIBIG_EE: "Pag-IBIG (EE)",
      PAGIBIG_ER: "Pag-IBIG (ER)",
      WITHHOLDING_TAX: "Withholding Tax",
      CASH_ADVANCE: "Cash Advance",
      LOAN_DEDUCTION: "Loan",
      ADJUSTMENT_DEDUCT: "Adjustment (-)",
      OTHER_DEDUCTION: "Other Deduction",
    };
    return map[category] || category.replace(/_/g, " ");
  };

  return (
    <div className="space-y-6">
      {/* Payslip History */}
      <Card>
        <CardHeader>
          <CardTitle>Payslip History</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <p className="text-gray-500">No payslips found for this employee</p>
          ) : (
            <div className="space-y-4">
              {payslips.map((payslip) => {
                const isExpanded = expandedPayslipId === payslip.id;
                const detail = payslipDetails[payslip.id];
                const isLoading = loading === payslip.id;

                return (
                  <div
                    key={payslip.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Summary Row */}
                    <div
                      className="p-4 bg-white hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleToggleExpand(payslip.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {payslip.payPeriodCode}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDate(new Date(payslip.payPeriodStart))} -{" "}
                              {formatDate(new Date(payslip.payPeriodEnd))}
                            </div>
                          </div>
                          <Badge
                            variant={
                              payslip.payrollRunStatus === "RELEASED"
                                ? "success"
                                : payslip.payrollRunStatus === "APPROVED"
                                ? "info"
                                : payslip.payrollRunStatus === "REVIEW"
                                ? "warning"
                                : "default"
                            }
                          >
                            {payslip.payrollRunStatus}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Net Pay</div>
                            <div className="font-semibold text-green-600">
                              {formatCurrency(Number(payslip.netPay))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {payslip.pdfPath && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(payslip.pdfPath!, "_blank");
                                }}
                              >
                                PDF
                              </Button>
                            )}
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Quick Summary */}
                      <div className="mt-3 flex gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">Gross:</span>{" "}
                          <span className="text-gray-900">
                            {formatCurrency(Number(payslip.grossPay))}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Deductions:</span>{" "}
                          <span className="text-red-600">
                            -{formatCurrency(Number(payslip.totalDeductions))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        {isLoading ? (
                          <div className="text-center py-4 text-gray-500">
                            Loading details...
                          </div>
                        ) : detail ? (
                          <div className="space-y-6">
                            {/* Earnings */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">
                                Earnings
                              </h4>
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="text-left px-4 py-2 font-medium text-gray-700">
                                        Description
                                      </th>
                                      <th className="text-right px-4 py-2 font-medium text-gray-700">
                                        Qty
                                      </th>
                                      <th className="text-right px-4 py-2 font-medium text-gray-700">
                                        Rate
                                      </th>
                                      <th className="text-right px-4 py-2 font-medium text-gray-700">
                                        Mult
                                      </th>
                                      <th className="text-right px-4 py-2 font-medium text-gray-700">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {categorizeLines(detail.lines).earnings.map(
                                      (line) => (
                                        <tr
                                          key={line.id}
                                          className="border-t border-gray-100"
                                        >
                                          <td className="px-4 py-2 text-gray-900">
                                            <span className="text-gray-500 text-xs">
                                              [{formatLineCategory(line.category)}]
                                            </span>{" "}
                                            {line.description}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-700">
                                            {line.quantity || "-"}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-700">
                                            {line.rate
                                              ? formatCurrency(Number(line.rate))
                                              : "-"}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-700">
                                            {line.multiplier || "-"}
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium text-green-600">
                                            {formatCurrency(Number(line.amount))}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                                      <td
                                        colSpan={4}
                                        className="px-4 py-2 font-medium text-gray-900"
                                      >
                                        Total Earnings
                                      </td>
                                      <td className="px-4 py-2 text-right font-semibold text-green-600">
                                        {formatCurrency(
                                          Number(detail.totalEarnings)
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Deductions */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">
                                Deductions
                              </h4>
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="text-left px-4 py-2 font-medium text-gray-700">
                                        Description
                                      </th>
                                      <th className="text-right px-4 py-2 font-medium text-gray-700">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {categorizeLines(detail.lines).deductions.map(
                                      (line) => (
                                        <tr
                                          key={line.id}
                                          className="border-t border-gray-100"
                                        >
                                          <td className="px-4 py-2 text-gray-900">
                                            <span className="text-gray-500 text-xs">
                                              [{formatLineCategory(line.category)}]
                                            </span>{" "}
                                            {line.description}
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium text-red-600">
                                            -{formatCurrency(Number(line.amount))}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                    {/* Statutory breakdown if not in lines */}
                                    {Number(detail.sssEe) > 0 &&
                                      !detail.lines.some(
                                        (l) => l.category === "SSS_EE"
                                      ) && (
                                        <tr className="border-t border-gray-100">
                                          <td className="px-4 py-2 text-gray-900">
                                            <span className="text-gray-500 text-xs">
                                              [SSS (EE)]
                                            </span>{" "}
                                            SSS Employee Share
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium text-red-600">
                                            -
                                            {formatCurrency(Number(detail.sssEe))}
                                          </td>
                                        </tr>
                                      )}
                                    {Number(detail.philhealthEe) > 0 &&
                                      !detail.lines.some(
                                        (l) => l.category === "PHILHEALTH_EE"
                                      ) && (
                                        <tr className="border-t border-gray-100">
                                          <td className="px-4 py-2 text-gray-900">
                                            <span className="text-gray-500 text-xs">
                                              [PhilHealth (EE)]
                                            </span>{" "}
                                            PhilHealth Employee Share
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium text-red-600">
                                            -
                                            {formatCurrency(
                                              Number(detail.philhealthEe)
                                            )}
                                          </td>
                                        </tr>
                                      )}
                                    {Number(detail.pagibigEe) > 0 &&
                                      !detail.lines.some(
                                        (l) => l.category === "PAGIBIG_EE"
                                      ) && (
                                        <tr className="border-t border-gray-100">
                                          <td className="px-4 py-2 text-gray-900">
                                            <span className="text-gray-500 text-xs">
                                              [Pag-IBIG (EE)]
                                            </span>{" "}
                                            Pag-IBIG Employee Share
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium text-red-600">
                                            -
                                            {formatCurrency(
                                              Number(detail.pagibigEe)
                                            )}
                                          </td>
                                        </tr>
                                      )}
                                    {Number(detail.withholdingTax) > 0 &&
                                      !detail.lines.some(
                                        (l) => l.category === "WITHHOLDING_TAX"
                                      ) && (
                                        <tr className="border-t border-gray-100">
                                          <td className="px-4 py-2 text-gray-900">
                                            <span className="text-gray-500 text-xs">
                                              [Withholding Tax]
                                            </span>{" "}
                                            Withholding Tax
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium text-red-600">
                                            -
                                            {formatCurrency(
                                              Number(detail.withholdingTax)
                                            )}
                                          </td>
                                        </tr>
                                      )}
                                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                                      <td className="px-4 py-2 font-medium text-gray-900">
                                        Total Deductions
                                      </td>
                                      <td className="px-4 py-2 text-right font-semibold text-red-600">
                                        -
                                        {formatCurrency(
                                          Number(detail.totalDeductions)
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Net Pay Summary */}
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-medium text-gray-900">
                                  Net Pay
                                </span>
                                <span className="text-2xl font-bold text-green-600">
                                  {formatCurrency(Number(detail.netPay))}
                                </span>
                              </div>
                            </div>

                            {/* Employer Contributions (if any) */}
                            {(Number(detail.sssEr) > 0 ||
                              Number(detail.philhealthEr) > 0 ||
                              Number(detail.pagibigEr) > 0) && (
                              <div>
                                <h4 className="font-medium text-gray-700 mb-2 text-sm">
                                  Employer Contributions (Not deducted from pay)
                                </h4>
                                <div className="flex gap-4 text-sm text-gray-600">
                                  {Number(detail.sssEr) > 0 && (
                                    <span>
                                      SSS (ER):{" "}
                                      {formatCurrency(Number(detail.sssEr))}
                                    </span>
                                  )}
                                  {Number(detail.philhealthEr) > 0 && (
                                    <span>
                                      PhilHealth (ER):{" "}
                                      {formatCurrency(Number(detail.philhealthEr))}
                                    </span>
                                  )}
                                  {Number(detail.pagibigEr) > 0 && (
                                    <span>
                                      Pag-IBIG (ER):{" "}
                                      {formatCurrency(Number(detail.pagibigEr))}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            Failed to load payslip details
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
