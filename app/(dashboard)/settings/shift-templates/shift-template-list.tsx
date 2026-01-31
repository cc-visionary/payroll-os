"use client";

// =============================================================================
// PeopleOS PH - Shift Template List Component
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import {
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
} from "@/app/actions/settings";

interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  startTime: Date;
  endTime: Date;
  isOvernight: boolean;
  breakType: string;
  breakMinutes: number;
  breakStartTime: Date | null;
  breakEndTime: Date | null;
  scheduledWorkMinutes: number;
  graceMinutesLate: number;
  graceMinutesEarlyOut: number;
  isActive: boolean;
}

interface ShiftTemplateListProps {
  initialShiftTemplates: ShiftTemplate[];
}

export function ShiftTemplateList({ initialShiftTemplates }: ShiftTemplateListProps) {
  const router = useRouter();
  const [shiftTemplates, setShiftTemplates] = useState(initialShiftTemplates);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<ShiftTemplate | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    breakStartTime: "13:00",
    breakEndTime: "14:00",
    graceMinutesLate: 15,
    isOvernight: false,
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      breakStartTime: "13:00",
      breakEndTime: "14:00",
      graceMinutesLate: 15,
      isOvernight: false,
    });
    setError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const formatTimeFromDate = (date: Date): string => {
    const d = new Date(date);
    const hours = d.getUTCHours().toString().padStart(2, "0");
    const minutes = d.getUTCMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const openEditModal = (template: ShiftTemplate) => {
    setFormData({
      code: template.code,
      name: template.name,
      startTime: formatTimeFromDate(template.startTime),
      endTime: formatTimeFromDate(template.endTime),
      breakMinutes: template.breakMinutes,
      breakStartTime: template.breakStartTime ? formatTimeFromDate(template.breakStartTime) : "13:00",
      breakEndTime: template.breakEndTime ? formatTimeFromDate(template.breakEndTime) : "14:00",
      graceMinutesLate: template.graceMinutesLate,
      isOvernight: template.isOvernight,
    });
    setError(null);
    setEditingTemplate(template);
  };

  const handleAdd = async () => {
    setError(null);
    startTransition(async () => {
      const result = await createShiftTemplate({
        code: formData.code,
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        breakMinutes: formData.breakMinutes,
        breakStartTime: formData.breakMinutes > 0 ? formData.breakStartTime : undefined,
        breakEndTime: formData.breakMinutes > 0 ? formData.breakEndTime : undefined,
        graceMinutesLate: formData.graceMinutesLate,
        isOvernight: formData.isOvernight,
      });

      if (result.success) {
        setIsAddModalOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to create shift template");
      }
    });
  };

  const handleUpdate = async () => {
    if (!editingTemplate) return;
    setError(null);

    startTransition(async () => {
      const result = await updateShiftTemplate(editingTemplate.id, {
        code: formData.code,
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        breakMinutes: formData.breakMinutes,
        breakStartTime: formData.breakMinutes > 0 ? formData.breakStartTime : undefined,
        breakEndTime: formData.breakMinutes > 0 ? formData.breakEndTime : undefined,
        graceMinutesLate: formData.graceMinutesLate,
        isOvernight: formData.isOvernight,
      });

      if (result.success) {
        setEditingTemplate(null);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to update shift template");
      }
    });
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteShiftTemplate(deletingTemplate.id);

      if (result.success) {
        setShiftTemplates(shiftTemplates.filter((t) => t.id !== deletingTemplate.id));
        setDeletingTemplate(null);
      } else {
        setError(result.error || "Failed to delete shift template");
      }
    });
  };

  const formatTime12hr = (date: Date) => {
    const d = new Date(date);
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div>
      {/* Add Button */}
      <div className="mb-4">
        <Button onClick={openAddModal}>Add Shift Template</Button>
      </div>

      {/* Shift Template List */}
      {shiftTemplates.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No shift templates configured. Add your first shift template to define working hours.
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {shiftTemplates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{template.name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {template.code}
                  </span>
                  {template.isOvernight && (
                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                      Overnight
                    </span>
                  )}
                  {!template.isActive && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {formatTime12hr(template.startTime)} - {formatTime12hr(template.endTime)} •{" "}
                  {template.breakMinutes > 0 ? (
                    <>
                      {template.breakMinutes} min break
                      {template.breakStartTime && template.breakEndTime && (
                        <span className="text-gray-400">
                          {" "}({formatTime12hr(template.breakStartTime)}-{formatTime12hr(template.breakEndTime)})
                        </span>
                      )}
                    </>
                  ) : (
                    "No break"
                  )} • {template.graceMinutesLate} min grace
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {Math.round(template.scheduledWorkMinutes / 60 * 10) / 10} hours work time
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(template)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingTemplate(template)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Shift Template Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Shift Template"
        size="lg"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <ShiftTemplateForm formData={formData} setFormData={setFormData} />
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            loading={isPending}
            disabled={!formData.code || !formData.name}
          >
            Add Shift Template
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Shift Template Modal */}
      <Modal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title="Edit Shift Template"
        size="lg"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <ShiftTemplateForm formData={formData} setFormData={setFormData} />
        <ModalFooter>
          <Button variant="outline" onClick={() => setEditingTemplate(null)}>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        title="Delete Shift Template"
        size="sm"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <p className="text-gray-600">
          Are you sure you want to delete{" "}
          <strong>{deletingTemplate?.name}</strong>? This action cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeletingTemplate(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={isPending}>
            Delete
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
  startTime: string;
  endTime: string;
  breakMinutes: number;
  breakStartTime: string;
  breakEndTime: string;
  graceMinutesLate: number;
  isOvernight: boolean;
}

function ShiftTemplateForm({
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
          placeholder="e.g., DAY, NIGHT, MID"
          required
        />
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Day Shift"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start Time"
          type="time"
          value={formData.startTime}
          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
          required
        />
        <Input
          label="End Time"
          type="time"
          value={formData.endTime}
          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Break Duration (minutes)"
          type="number"
          value={formData.breakMinutes}
          onChange={(e) =>
            setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })
          }
          min={0}
        />
        <Input
          label="Break Start Time"
          type="time"
          value={formData.breakStartTime}
          onChange={(e) => setFormData({ ...formData, breakStartTime: e.target.value })}
          disabled={formData.breakMinutes === 0}
        />
        <Input
          label="Break End Time"
          type="time"
          value={formData.breakEndTime}
          onChange={(e) => setFormData({ ...formData, breakEndTime: e.target.value })}
          disabled={formData.breakMinutes === 0}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Grace Period for Late (minutes)"
          type="number"
          value={formData.graceMinutesLate}
          onChange={(e) =>
            setFormData({ ...formData, graceMinutesLate: parseInt(e.target.value) || 0 })
          }
          min={0}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isOvernight"
          checked={formData.isOvernight}
          onChange={(e) => setFormData({ ...formData, isOvernight: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isOvernight" className="text-sm text-gray-700">
          Overnight shift (ends after midnight)
        </label>
      </div>
    </div>
  );
}
