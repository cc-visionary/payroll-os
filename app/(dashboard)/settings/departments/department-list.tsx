"use client";

// =============================================================================
// PeopleOS PH - Department List Component
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/app/actions/settings";

interface Department {
  id: string;
  code: string;
  name: string;
  costCenterCode: string | null;
  employeeCount: number;
  manager: { id: string; name: string } | null;
}

interface DepartmentListProps {
  initialDepartments: Department[];
}

export function DepartmentList({ initialDepartments }: DepartmentListProps) {
  const router = useRouter();
  const [departments, setDepartments] = useState(initialDepartments);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    costCenterCode: "",
  });

  const resetForm = () => {
    setFormData({ code: "", name: "", costCenterCode: "" });
    setError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setFormData({
      code: dept.code,
      name: dept.name,
      costCenterCode: dept.costCenterCode || "",
    });
    setError(null);
    setEditingDepartment(dept);
  };

  const handleAdd = async () => {
    setError(null);
    startTransition(async () => {
      const result = await createDepartment({
        code: formData.code,
        name: formData.name,
        costCenterCode: formData.costCenterCode || undefined,
      });

      if (result.success && result.department) {
        // Add to local state immediately for instant feedback
        setDepartments([...departments, result.department]);
        setIsAddModalOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to create department");
      }
    });
  };

  const handleUpdate = async () => {
    if (!editingDepartment) return;
    setError(null);

    startTransition(async () => {
      const result = await updateDepartment(editingDepartment.id, {
        code: formData.code,
        name: formData.name,
        costCenterCode: formData.costCenterCode || null,
      });

      if (result.success) {
        setEditingDepartment(null);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to update department");
      }
    });
  };

  const handleDelete = async () => {
    if (!deletingDepartment) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteDepartment(deletingDepartment.id);

      if (result.success) {
        setDepartments(departments.filter((d) => d.id !== deletingDepartment.id));
        setDeletingDepartment(null);
      } else {
        setError(result.error || "Failed to delete department");
      }
    });
  };

  return (
    <div>
      {/* Add Button */}
      <div className="mb-4">
        <Button onClick={openAddModal}>Add Department</Button>
      </div>

      {/* Department List */}
      {departments.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No departments configured. Add your first department to get started.
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{dept.name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {dept.code}
                  </span>
                </div>
                {dept.costCenterCode && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    Cost Center: {dept.costCenterCode}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {dept.employeeCount} employee{dept.employeeCount !== 1 ? "s" : ""}
                  {dept.manager && ` • Manager: ${dept.manager.name}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(dept)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingDepartment(dept)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Department Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Department"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <div className="space-y-4">
          <Input
            label="Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g., HR, ENG, FIN"
            required
          />
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Human Resources"
            required
          />
          <Input
            label="Cost Center Code"
            value={formData.costCenterCode}
            onChange={(e) => setFormData({ ...formData, costCenterCode: e.target.value })}
            placeholder="Optional cost center code"
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            loading={isPending}
            disabled={!formData.code || !formData.name}
          >
            Add Department
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Department Modal */}
      <Modal
        isOpen={!!editingDepartment}
        onClose={() => setEditingDepartment(null)}
        title="Edit Department"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <div className="space-y-4">
          <Input
            label="Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g., HR, ENG, FIN"
            required
          />
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Human Resources"
            required
          />
          <Input
            label="Cost Center Code"
            value={formData.costCenterCode}
            onChange={(e) => setFormData({ ...formData, costCenterCode: e.target.value })}
            placeholder="Optional cost center code"
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setEditingDepartment(null)}>
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
        isOpen={!!deletingDepartment}
        onClose={() => setDeletingDepartment(null)}
        title="Delete Department"
        size="sm"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <p className="text-gray-600">
          Are you sure you want to delete{" "}
          <strong>{deletingDepartment?.name}</strong>? This action cannot be undone.
        </p>
        {deletingDepartment && deletingDepartment.employeeCount > 0 && (
          <p className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
            Warning: This department has {deletingDepartment.employeeCount} employee(s)
            assigned. They will need to be reassigned.
          </p>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeletingDepartment(null)}>
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
