"use client";

// =============================================================================
// PeopleOS PH - Leave Type List Component
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { createLeaveType, updateLeaveType } from "@/app/actions/settings";

interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  accrualType: string;
  accrualAmount: number | null;
  accrualCap: number | null;
  isPaid: boolean;
  isConvertible: boolean;
  canCarryOver: boolean;
  requiresAttachment: boolean;
  requiresApproval: boolean;
  minAdvanceDays: number;
  isActive: boolean;
}

interface LeaveTypeListProps {
  initialLeaveTypes: LeaveType[];
}

const accrualTypeOptions = [
  { value: "ANNUAL", label: "Annual (granted at start of year)" },
  { value: "MONTHLY", label: "Monthly (accrues each month)" },
  { value: "TENURE_BASED", label: "Tenure-based (increases with tenure)" },
  { value: "NONE", label: "No accrual (unlimited/as needed)" },
];

export function LeaveTypeList({ initialLeaveTypes }: LeaveTypeListProps) {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState(initialLeaveTypes);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    accrualType: "ANNUAL",
    accrualAmount: 5,
    accrualCap: 15,
    isPaid: true,
    isConvertible: false,
    canCarryOver: false,
    requiresAttachment: false,
    requiresApproval: true,
    minAdvanceDays: 0,
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      accrualType: "ANNUAL",
      accrualAmount: 5,
      accrualCap: 15,
      isPaid: true,
      isConvertible: false,
      canCarryOver: false,
      requiresAttachment: false,
      requiresApproval: true,
      minAdvanceDays: 0,
    });
    setError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (lt: LeaveType) => {
    setFormData({
      code: lt.code,
      name: lt.name,
      description: lt.description || "",
      accrualType: lt.accrualType,
      accrualAmount: lt.accrualAmount ?? 0,
      accrualCap: lt.accrualCap ?? 0,
      isPaid: lt.isPaid,
      isConvertible: lt.isConvertible,
      canCarryOver: lt.canCarryOver,
      requiresAttachment: lt.requiresAttachment,
      requiresApproval: lt.requiresApproval,
      minAdvanceDays: lt.minAdvanceDays,
    });
    setError(null);
    setEditingLeaveType(lt);
  };

  const handleAdd = async () => {
    setError(null);
    startTransition(async () => {
      const result = await createLeaveType({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        accrualType: formData.accrualType as "ANNUAL" | "MONTHLY" | "NONE" | "TENURE_BASED",
        accrualAmount: formData.accrualAmount || undefined,
        accrualCap: formData.accrualCap || undefined,
        isPaid: formData.isPaid,
        isConvertible: formData.isConvertible,
        canCarryOver: formData.canCarryOver,
        requiresAttachment: formData.requiresAttachment,
        requiresApproval: formData.requiresApproval,
        minAdvanceDays: formData.minAdvanceDays,
      });

      if (result.success) {
        setIsAddModalOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to create leave type");
      }
    });
  };

  const handleUpdate = async () => {
    if (!editingLeaveType) return;
    setError(null);

    startTransition(async () => {
      const result = await updateLeaveType(editingLeaveType.id, {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        accrualType: formData.accrualType as "ANNUAL" | "MONTHLY" | "NONE" | "TENURE_BASED",
        accrualAmount: formData.accrualAmount || null,
        accrualCap: formData.accrualCap || null,
        isPaid: formData.isPaid,
        isConvertible: formData.isConvertible,
        canCarryOver: formData.canCarryOver,
        requiresAttachment: formData.requiresAttachment,
        requiresApproval: formData.requiresApproval,
        minAdvanceDays: formData.minAdvanceDays,
      });

      if (result.success) {
        setEditingLeaveType(null);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to update leave type");
      }
    });
  };

  return (
    <div>
      {/* Add Button */}
      <div className="mb-4">
        <Button onClick={openAddModal}>Add Leave Type</Button>
      </div>

      {/* Leave Type List */}
      {leaveTypes.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No leave types configured. Add leave types to define employee entitlements.
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {leaveTypes.map((lt) => (
            <div
              key={lt.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{lt.name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {lt.code}
                  </span>
                  <Badge variant={lt.isPaid ? "success" : "default"}>
                    {lt.isPaid ? "Paid" : "Unpaid"}
                  </Badge>
                  {!lt.isActive && (
                    <Badge variant="default">Inactive</Badge>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                  {lt.accrualAmount && (
                    <span>
                      {lt.accrualAmount} days/{lt.accrualType.toLowerCase()}
                    </span>
                  )}
                  {lt.accrualCap && <span>• Max {lt.accrualCap} days</span>}
                  {lt.canCarryOver && <span>• Carry-over allowed</span>}
                  {lt.isConvertible && <span>• Convertible to cash</span>}
                  {lt.requiresAttachment && <span>• Requires attachment</span>}
                </div>
                {lt.description && (
                  <p className="text-sm text-gray-400 mt-0.5">{lt.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(lt)}>
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Leave Type Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Leave Type"
        size="lg"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <LeaveTypeForm formData={formData} setFormData={setFormData} />
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            loading={isPending}
            disabled={!formData.code || !formData.name}
          >
            Add Leave Type
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Leave Type Modal */}
      <Modal
        isOpen={!!editingLeaveType}
        onClose={() => setEditingLeaveType(null)}
        title="Edit Leave Type"
        size="lg"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <LeaveTypeForm formData={formData} setFormData={setFormData} />
        <ModalFooter>
          <Button variant="outline" onClick={() => setEditingLeaveType(null)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            loading={isPending}
            disabled={!formData.code || !formData.name}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// Form Component
interface FormData {
  code: string;
  name: string;
  description: string;
  accrualType: string;
  accrualAmount: number;
  accrualCap: number;
  isPaid: boolean;
  isConvertible: boolean;
  canCarryOver: boolean;
  requiresAttachment: boolean;
  requiresApproval: boolean;
  minAdvanceDays: number;
}

function LeaveTypeForm({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Code"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          placeholder="e.g., VL, SL, ML"
          required
        />
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Vacation Leave"
          required
        />
      </div>
      <Input
        label="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Optional description"
      />
      <Select
        label="Accrual Type"
        value={formData.accrualType}
        onChange={(e) => setFormData({ ...formData, accrualType: e.target.value })}
        options={accrualTypeOptions}
      />
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Accrual Amount (days)"
          type="number"
          value={formData.accrualAmount}
          onChange={(e) =>
            setFormData({ ...formData, accrualAmount: parseInt(e.target.value) || 0 })
          }
          min={0}
        />
        <Input
          label="Maximum Cap (days)"
          type="number"
          value={formData.accrualCap}
          onChange={(e) =>
            setFormData({ ...formData, accrualCap: parseInt(e.target.value) || 0 })
          }
          min={0}
        />
        <Input
          label="Min Advance Days"
          type="number"
          value={formData.minAdvanceDays}
          onChange={(e) =>
            setFormData({ ...formData, minAdvanceDays: parseInt(e.target.value) || 0 })
          }
          min={0}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPaid"
            checked={formData.isPaid}
            onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isPaid" className="text-sm text-gray-700">
            Paid leave (employee receives salary during leave)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="requiresApproval"
            checked={formData.requiresApproval}
            onChange={(e) =>
              setFormData({ ...formData, requiresApproval: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="requiresApproval" className="text-sm text-gray-700">
            Requires manager approval
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="requiresAttachment"
            checked={formData.requiresAttachment}
            onChange={(e) =>
              setFormData({ ...formData, requiresAttachment: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="requiresAttachment" className="text-sm text-gray-700">
            Requires supporting document (e.g., medical certificate)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="canCarryOver"
            checked={formData.canCarryOver}
            onChange={(e) =>
              setFormData({ ...formData, canCarryOver: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="canCarryOver" className="text-sm text-gray-700">
            Allow carry-over of unused days
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isConvertible"
            checked={formData.isConvertible}
            onChange={(e) =>
              setFormData({ ...formData, isConvertible: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isConvertible" className="text-sm text-gray-700">
            Convertible to cash (unused days can be monetized)
          </label>
        </div>
      </div>
    </div>
  );
}
