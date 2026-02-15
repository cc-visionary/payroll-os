"use client";

// =============================================================================
// PeopleOS PH - Penalty Type List Component
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  createPenaltyType,
  updatePenaltyType,
  deletePenaltyType,
} from "@/app/actions/penalties";

interface PenaltyType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  penaltyCount: number;
  createdAt: Date;
}

interface PenaltyTypeListProps {
  initialPenaltyTypes: PenaltyType[];
}

export function PenaltyTypeList({ initialPenaltyTypes }: PenaltyTypeListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<PenaltyType | null>(null);
  const [deletingType, setDeletingType] = useState<PenaltyType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  const resetForm = () => {
    setFormData({ code: "", name: "", description: "" });
    setError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (pt: PenaltyType) => {
    setFormData({
      code: pt.code,
      name: pt.name,
      description: pt.description || "",
    });
    setError(null);
    setEditingType(pt);
  };

  const handleAdd = async () => {
    setError(null);
    startTransition(async () => {
      const result = await createPenaltyType({
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || undefined,
      });

      if (result.success) {
        setIsAddModalOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to create penalty type");
      }
    });
  };

  const handleUpdate = async () => {
    if (!editingType) return;
    setError(null);

    startTransition(async () => {
      const result = await updatePenaltyType(editingType.id, {
        name: formData.name,
        description: formData.description || undefined,
      });

      if (result.success) {
        setEditingType(null);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to update penalty type");
      }
    });
  };

  const handleDelete = async () => {
    if (!deletingType) return;
    setError(null);

    startTransition(async () => {
      const result = await deletePenaltyType(deletingType.id);

      if (result.success) {
        setDeletingType(null);
        router.refresh();
      } else {
        setError(result.error || "Failed to delete penalty type");
      }
    });
  };

  return (
    <div>
      {/* Add Button */}
      <div className="mb-4">
        <Button onClick={openAddModal}>Add Penalty Type</Button>
      </div>

      {/* Penalty Type List */}
      {initialPenaltyTypes.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No penalty types configured. Add penalty types to define predefined categories.
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {initialPenaltyTypes.map((pt) => (
            <div
              key={pt.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{pt.name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {pt.code}
                  </span>
                  {!pt.isActive && <Badge variant="default">Inactive</Badge>}
                </div>
                {pt.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{pt.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {pt.penaltyCount} penalt{pt.penaltyCount === 1 ? "y" : "ies"} issued
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(pt)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => setDeletingType(pt)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Penalty Type"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., TARDY, DAMAGE"
              required
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Tardiness Penalty"
              required
            />
          </div>
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
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
            Add Penalty Type
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingType}
        onClose={() => setEditingType(null)}
        title="Edit Penalty Type"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <div className="space-y-4">
          <Input
            label="Code"
            value={formData.code}
            disabled
            className="bg-gray-50"
          />
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Penalty type name"
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setEditingType(null)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} loading={isPending} disabled={!formData.name}>
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingType}
        onClose={() => setDeletingType(null)}
        title="Delete Penalty Type"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{deletingType?.name}</strong>? This action
          cannot be undone. Penalty types with active penalties cannot be deleted.
        </p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeletingType(null)}>
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
