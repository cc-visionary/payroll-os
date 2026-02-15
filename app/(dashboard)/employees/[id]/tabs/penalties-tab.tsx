"use client";

// =============================================================================
// PeopleOS PH - Employee Penalties Tab
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { createPenalty, cancelPenalty } from "@/app/actions/penalties";

interface PenaltyInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  isDeducted: boolean;
  deductedAt: Date | null;
  payrollRunId: string | null;
}

interface Penalty {
  id: string;
  penaltyType: { id: string; code: string; name: string } | null;
  customDescription: string | null;
  totalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  effectiveDate: Date;
  remarks: string | null;
  totalDeducted: number;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdBy: { id: string; email: string } | null;
  createdAt: Date;
  installments: PenaltyInstallment[];
}

interface PenaltyTypeOption {
  id: string;
  code: string;
  name: string;
}

interface PenaltiesTabProps {
  employeeId: string;
  penalties: Penalty[];
  penaltyTypes: PenaltyTypeOption[];
  canManage: boolean;
}

export function PenaltiesTab({
  employeeId,
  penalties,
  penaltyTypes,
  canManage,
}: PenaltiesTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cancellingPenalty, setCancellingPenalty] = useState<Penalty | null>(null);
  const [expandedPenaltyId, setExpandedPenaltyId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    penaltyTypeId: "",
    customDescription: "",
    totalAmount: "",
    installmentCount: "1",
    effectiveDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  const resetForm = () => {
    setFormData({
      penaltyTypeId: "",
      customDescription: "",
      totalAmount: "",
      installmentCount: "1",
      effectiveDate: new Date().toISOString().split("T")[0],
      remarks: "",
    });
    setError(null);
  };

  const activePenalties = penalties.filter((p) => p.status === "ACTIVE");
  const completedPenalties = penalties.filter((p) => p.status === "COMPLETED");
  const cancelledPenalties = penalties.filter((p) => p.status === "CANCELLED");

  const totalRemaining = activePenalties.reduce(
    (sum, p) => sum + (p.totalAmount - p.totalDeducted),
    0
  );

  const isOther = formData.penaltyTypeId === "OTHER";
  const totalAmount = parseFloat(formData.totalAmount) || 0;
  const installmentCount = parseInt(formData.installmentCount) || 1;

  // Preview installment breakdown
  const previewInstallments = (() => {
    if (totalAmount <= 0 || installmentCount < 1) return [];
    const base = Math.floor((totalAmount * 100) / installmentCount) / 100;
    const last = Math.round((totalAmount - base * (installmentCount - 1)) * 100) / 100;
    return Array.from({ length: installmentCount }, (_, i) => ({
      number: i + 1,
      amount: i === installmentCount - 1 ? last : base,
    }));
  })();

  const handleAdd = async () => {
    setError(null);

    if (isOther && !formData.customDescription.trim()) {
      setError("Description is required when using 'Other' type");
      return;
    }
    if (totalAmount <= 0) {
      setError("Total amount must be greater than 0");
      return;
    }

    startTransition(async () => {
      const result = await createPenalty({
        employeeId,
        penaltyTypeId: isOther || !formData.penaltyTypeId ? undefined : formData.penaltyTypeId,
        customDescription: isOther ? formData.customDescription : undefined,
        totalAmount,
        installmentCount,
        effectiveDate: formData.effectiveDate,
        remarks: formData.remarks || undefined,
      });

      if (result.success) {
        setIsAddModalOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to create penalty");
      }
    });
  };

  const handleCancel = async () => {
    if (!cancellingPenalty || !cancelReason.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await cancelPenalty(cancellingPenalty.id, cancelReason);

      if (result.success) {
        setCancellingPenalty(null);
        setCancelReason("");
        router.refresh();
      } else {
        setError(result.error || "Failed to cancel penalty");
      }
    });
  };

  const getPenaltyLabel = (p: Penalty) =>
    p.penaltyType?.name || p.customDescription || "Penalty";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const typeOptions = [
    ...penaltyTypes.map((pt) => ({ value: pt.id, label: pt.name })),
    { value: "OTHER", label: "Other (custom description)" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          label="Active Penalties"
          value={activePenalties.length.toString()}
          highlight={activePenalties.length > 0}
        />
        <SummaryCard
          label="Remaining Balance"
          value={`PHP ${formatCurrency(totalRemaining)}`}
          highlight={totalRemaining > 0}
        />
        <SummaryCard label="Completed" value={completedPenalties.length.toString()} />
      </div>

      {/* Add Penalty Button */}
      {canManage && (
        <div>
          <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }}>
            Add Penalty
          </Button>
        </div>
      )}

      {/* Active Penalties */}
      {activePenalties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Penalties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activePenalties.map((penalty) => (
              <PenaltyCard
                key={penalty.id}
                penalty={penalty}
                isExpanded={expandedPenaltyId === penalty.id}
                onToggle={() =>
                  setExpandedPenaltyId(
                    expandedPenaltyId === penalty.id ? null : penalty.id
                  )
                }
                onCancel={canManage ? () => setCancellingPenalty(penalty) : undefined}
                formatCurrency={formatCurrency}
                getPenaltyLabel={getPenaltyLabel}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Completed Penalties */}
      {completedPenalties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-gray-600">Completed Penalties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedPenalties.map((penalty) => (
              <PenaltyCard
                key={penalty.id}
                penalty={penalty}
                isExpanded={expandedPenaltyId === penalty.id}
                onToggle={() =>
                  setExpandedPenaltyId(
                    expandedPenaltyId === penalty.id ? null : penalty.id
                  )
                }
                formatCurrency={formatCurrency}
                getPenaltyLabel={getPenaltyLabel}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cancelled Penalties */}
      {cancelledPenalties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-gray-400">Cancelled Penalties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cancelledPenalties.map((penalty) => (
              <div
                key={penalty.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg opacity-60"
              >
                <div>
                  <span className="font-medium text-sm">{getPenaltyLabel(penalty)}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    PHP {formatCurrency(penalty.totalAmount)}
                  </span>
                  {penalty.cancelReason && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Reason: {penalty.cancelReason}
                    </p>
                  )}
                </div>
                <Badge variant="default">Cancelled</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {penalties.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No penalties recorded for this employee.</p>
          </CardContent>
        </Card>
      )}

      {/* Add Penalty Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Penalty"
        size="lg"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <div className="space-y-4">
          <Select
            label="Penalty Type"
            value={formData.penaltyTypeId}
            onChange={(e) => setFormData({ ...formData, penaltyTypeId: e.target.value })}
            options={[{ value: "", label: "Select a penalty type" }, ...typeOptions]}
          />

          {isOther && (
            <Input
              label="Description"
              value={formData.customDescription}
              onChange={(e) =>
                setFormData({ ...formData, customDescription: e.target.value })
              }
              placeholder="Describe the penalty..."
              required
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total Amount (PHP)"
              type="number"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
              placeholder="0.00"
              min={0}
              step="0.01"
              required
            />
            <Input
              label="Number of Installments"
              type="number"
              value={formData.installmentCount}
              onChange={(e) =>
                setFormData({ ...formData, installmentCount: e.target.value })
              }
              min={1}
              required
            />
          </div>

          <Input
            label="Effective Date"
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
            required
          />

          <Input
            label="Remarks"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="Optional notes or incident reference"
          />

          {/* Installment Preview */}
          {previewInstallments.length > 0 && totalAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Installment Schedule Preview
              </h4>
              <div className="space-y-1">
                {previewInstallments.map((inst) => (
                  <div
                    key={inst.number}
                    className="flex justify-between text-sm text-gray-600"
                  >
                    <span>Installment #{inst.number}</span>
                    <span className="font-medium">PHP {formatCurrency(inst.amount)}</span>
                  </div>
                ))}
                <div className="border-t pt-1 mt-2 flex justify-between text-sm font-medium">
                  <span>Total</span>
                  <span>PHP {formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            loading={isPending}
            disabled={
              !formData.totalAmount ||
              totalAmount <= 0 ||
              (!formData.penaltyTypeId) ||
              (isOther && !formData.customDescription.trim())
            }
          >
            Add Penalty
          </Button>
        </ModalFooter>
      </Modal>

      {/* Cancel Penalty Modal */}
      <Modal
        isOpen={!!cancellingPenalty}
        onClose={() => { setCancellingPenalty(null); setCancelReason(""); setError(null); }}
        title="Cancel Penalty"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        {cancellingPenalty && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                This will cancel{" "}
                <strong>
                  {cancellingPenalty.installments.filter((i) => !i.isDeducted).length}
                </strong>{" "}
                remaining installment(s) totaling{" "}
                <strong>
                  PHP{" "}
                  {formatCurrency(
                    cancellingPenalty.totalAmount - cancellingPenalty.totalDeducted
                  )}
                </strong>
                . Already-deducted installments will not be reversed.
              </p>
            </div>
            <Input
              label="Cancellation Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancelling this penalty..."
              required
            />
          </div>
        )}
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => { setCancellingPenalty(null); setCancelReason(""); }}
          >
            Back
          </Button>
          <Button
            variant="danger"
            onClick={handleCancel}
            loading={isPending}
            disabled={!cancelReason.trim()}
          >
            Cancel Penalty
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        highlight ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div
        className={`text-lg font-semibold mt-1 ${
          highlight ? "text-yellow-700" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PenaltyCard({
  penalty,
  isExpanded,
  onToggle,
  onCancel,
  formatCurrency,
  getPenaltyLabel,
}: {
  penalty: Penalty;
  isExpanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  formatCurrency: (n: number) => string;
  getPenaltyLabel: (p: Penalty) => string;
}) {
  const paidCount = penalty.installments.filter((i) => i.isDeducted).length;
  const progressPercent =
    penalty.installmentCount > 0
      ? Math.round((paidCount / penalty.installmentCount) * 100)
      : 0;
  const remaining = penalty.totalAmount - penalty.totalDeducted;

  const statusBadge =
    penalty.status === "ACTIVE" ? (
      <Badge variant="warning">Active</Badge>
    ) : penalty.status === "COMPLETED" ? (
      <Badge variant="success">Completed</Badge>
    ) : (
      <Badge variant="default">Cancelled</Badge>
    );

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{getPenaltyLabel(penalty)}</span>
            {statusBadge}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            PHP {formatCurrency(penalty.totalAmount)} total &middot;{" "}
            {penalty.installmentCount} installment{penalty.installmentCount !== 1 ? "s" : ""}{" "}
            ({paidCount} paid, {penalty.installmentCount - paidCount} remaining)
          </div>

          {/* Progress Bar */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  penalty.status === "COMPLETED"
                    ? "bg-green-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-10 text-right">
              {progressPercent}%
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span>
              Remaining: PHP {formatCurrency(remaining)}
            </span>
            <span>Effective: {formatDate(penalty.effectiveDate)}</span>
            {penalty.remarks && <span>Note: {penalty.remarks}</span>}
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {isExpanded ? "Hide" : "Details"}
          </Button>
          {onCancel && penalty.status === "ACTIVE" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Installment Schedule */}
      {isExpanded && (
        <div className="mt-4 border-t pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Deducted On</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {penalty.installments.map((inst) => (
                <tr key={inst.id} className="text-gray-700">
                  <td className="py-2">{inst.installmentNumber}</td>
                  <td className="py-2">PHP {formatCurrency(inst.amount)}</td>
                  <td className="py-2">
                    {inst.isDeducted ? (
                      <Badge variant="success">Deducted</Badge>
                    ) : penalty.status === "CANCELLED" ? (
                      <Badge variant="default">Cancelled</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </td>
                  <td className="py-2 text-gray-400">
                    {inst.deductedAt ? formatDate(inst.deductedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
