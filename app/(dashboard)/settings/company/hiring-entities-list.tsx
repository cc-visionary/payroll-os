"use client";

// =============================================================================
// PeopleOS PH - Hiring Entities List Component
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  createHiringEntity,
  updateHiringEntity,
  deleteHiringEntity,
} from "@/app/actions/settings";

interface HiringEntity {
  id: string;
  code: string;
  name: string;
  tradeName: string | null;
  tin: string | null;
  rdoCode: string | null;
  sssEmployerId: string | null;
  philhealthEmployerId: string | null;
  pagibigEmployerId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  zipCode: string | null;
  phoneNumber: string | null;
  email: string | null;
  isActive: boolean;
  employeeCount: number;
  createdAt: Date;
}

interface HiringEntitiesListProps {
  initialEntities: HiringEntity[];
}

const emptyFormData = {
  code: "",
  name: "",
  tradeName: "",
  tin: "",
  rdoCode: "",
  sssEmployerId: "",
  philhealthEmployerId: "",
  pagibigEmployerId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  zipCode: "",
  phoneNumber: "",
  email: "",
};

export function HiringEntitiesList({ initialEntities }: HiringEntitiesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [entities, setEntities] = useState<HiringEntity[]>(initialEntities);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<HiringEntity | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingEntity(null);
    setFormData(emptyFormData);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entity: HiringEntity) => {
    setEditingEntity(entity);
    setFormData({
      code: entity.code,
      name: entity.name,
      tradeName: entity.tradeName || "",
      tin: entity.tin || "",
      rdoCode: entity.rdoCode || "",
      sssEmployerId: entity.sssEmployerId || "",
      philhealthEmployerId: entity.philhealthEmployerId || "",
      pagibigEmployerId: entity.pagibigEmployerId || "",
      addressLine1: entity.addressLine1 || "",
      addressLine2: entity.addressLine2 || "",
      city: entity.city || "",
      province: entity.province || "",
      zipCode: entity.zipCode || "",
      phoneNumber: entity.phoneNumber || "",
      email: entity.email || "",
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingEntity(null);
    setFormData(emptyFormData);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      setError("Code and Name are required");
      return;
    }

    setError(null);
    startTransition(async () => {
      if (editingEntity) {
        const result = await updateHiringEntity(editingEntity.id, {
          code: formData.code,
          name: formData.name,
          tradeName: formData.tradeName || null,
          tin: formData.tin || null,
          rdoCode: formData.rdoCode || null,
          sssEmployerId: formData.sssEmployerId || null,
          philhealthEmployerId: formData.philhealthEmployerId || null,
          pagibigEmployerId: formData.pagibigEmployerId || null,
          addressLine1: formData.addressLine1 || null,
          addressLine2: formData.addressLine2 || null,
          city: formData.city || null,
          province: formData.province || null,
          zipCode: formData.zipCode || null,
          phoneNumber: formData.phoneNumber || null,
          email: formData.email || null,
        });

        if (result.success) {
          handleClose();
          router.refresh();
        } else {
          setError(result.error || "Failed to update hiring entity");
        }
      } else {
        const result = await createHiringEntity({
          code: formData.code,
          name: formData.name,
          tradeName: formData.tradeName || undefined,
          tin: formData.tin || undefined,
          rdoCode: formData.rdoCode || undefined,
          sssEmployerId: formData.sssEmployerId || undefined,
          philhealthEmployerId: formData.philhealthEmployerId || undefined,
          pagibigEmployerId: formData.pagibigEmployerId || undefined,
          addressLine1: formData.addressLine1 || undefined,
          addressLine2: formData.addressLine2 || undefined,
          city: formData.city || undefined,
          province: formData.province || undefined,
          zipCode: formData.zipCode || undefined,
          phoneNumber: formData.phoneNumber || undefined,
          email: formData.email || undefined,
        });

        if (result.success) {
          handleClose();
          router.refresh();
        } else {
          setError(result.error || "Failed to create hiring entity");
        }
      }
    });
  };

  const handleDelete = async (entityId: string) => {
    startTransition(async () => {
      const result = await deleteHiringEntity(entityId);
      if (result.success) {
        setDeleteConfirmId(null);
        router.refresh();
      } else {
        setError(result.error || "Failed to delete hiring entity");
      }
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          {entities.length} hiring {entities.length === 1 ? "entity" : "entities"}
        </div>
        <Button onClick={handleOpenCreate}>Add Hiring Entity</Button>
      </div>

      {/* List */}
      {entities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No hiring entities configured yet.</p>
          <p className="text-sm mt-1">
            Add a hiring entity to assign employees to different legal entities.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entities.map((entity) => (
            <div
              key={entity.id}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{entity.name}</h4>
                    <Badge variant={entity.isActive ? "success" : "default"}>
                      {entity.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {entity.tradeName && (
                    <p className="text-sm text-gray-500">DBA: {entity.tradeName}</p>
                  )}
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Code:</span>{" "}
                      <span className="text-gray-900">{entity.code}</span>
                    </div>
                    {entity.tin && (
                      <div>
                        <span className="text-gray-500">TIN:</span>{" "}
                        <span className="text-gray-900">{entity.tin}</span>
                      </div>
                    )}
                    {entity.sssEmployerId && (
                      <div>
                        <span className="text-gray-500">SSS:</span>{" "}
                        <span className="text-gray-900">{entity.sssEmployerId}</span>
                      </div>
                    )}
                    {entity.philhealthEmployerId && (
                      <div>
                        <span className="text-gray-500">PhilHealth:</span>{" "}
                        <span className="text-gray-900">{entity.philhealthEmployerId}</span>
                      </div>
                    )}
                    {entity.pagibigEmployerId && (
                      <div>
                        <span className="text-gray-500">Pag-IBIG:</span>{" "}
                        <span className="text-gray-900">{entity.pagibigEmployerId}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {entity.employeeCount} employee{entity.employeeCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(entity)}>
                    Edit
                  </Button>
                  {entity.employeeCount === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirmId(entity.id)}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirmId === entity.id && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800 mb-2">
                    Are you sure you want to delete &quot;{entity.name}&quot;?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDelete(entity.id)}
                      loading={isPending}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingEntity ? "Edit Hiring Entity" : "Add Hiring Entity"}
        size="lg"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., GC, LUX"
                required
              />
              <Input
                label="Legal Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Trade Name / DBA"
                value={formData.tradeName}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                placeholder="Doing Business As"
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <Input
                label="Phone Number"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
          </div>

          {/* Government Registration */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Government Registration</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="TIN"
                value={formData.tin}
                onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                placeholder="000-000-000-000"
              />
              <Input
                label="RDO Code"
                value={formData.rdoCode}
                onChange={(e) => setFormData({ ...formData, rdoCode: e.target.value })}
                placeholder="e.g., 044"
              />
              <Input
                label="SSS Employer Number"
                value={formData.sssEmployerId}
                onChange={(e) => setFormData({ ...formData, sssEmployerId: e.target.value })}
              />
              <Input
                label="PhilHealth Employer Number"
                value={formData.philhealthEmployerId}
                onChange={(e) =>
                  setFormData({ ...formData, philhealthEmployerId: e.target.value })
                }
              />
              <Input
                label="Pag-IBIG Employer Number"
                value={formData.pagibigEmployerId}
                onChange={(e) =>
                  setFormData({ ...formData, pagibigEmployerId: e.target.value })
                }
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Business Address</h4>
            <div className="space-y-4">
              <Input
                label="Address Line 1"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                placeholder="Building, Street, Barangay"
              />
              <Input
                label="Address Line 2"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="City / Municipality"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
                <Input
                  label="Province"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                />
                <Input
                  label="ZIP Code"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isPending}>
            {editingEntity ? "Save Changes" : "Create Entity"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
