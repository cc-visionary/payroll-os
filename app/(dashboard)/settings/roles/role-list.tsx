"use client";

// =============================================================================
// PeopleOS PH - Role List Component
// =============================================================================

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { PermissionGroups } from "@/lib/auth/permissions";
import { createRole, updateRole, deleteRole } from "@/app/actions/roles";

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

interface RoleListProps {
  initialRoles: Role[];
}

function formatPermissionLabel(permission: string): string {
  const action = permission.split(":")[1];
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function RoleList({ initialRoles }: RoleListProps) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    permissions: [] as string[],
  });

  const resetForm = () => {
    setFormData({ code: "", name: "", description: "", permissions: [] });
    setError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || "",
      permissions: [...role.permissions],
    });
    setError(null);
    setEditingRole(role);
  };

  const togglePermission = useCallback((perm: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }, []);

  const toggleGroup = useCallback((permissions: readonly string[], allChecked: boolean) => {
    setFormData((prev) => {
      if (allChecked) {
        return {
          ...prev,
          permissions: prev.permissions.filter((p) => !permissions.includes(p)),
        };
      } else {
        const newPerms = new Set([...prev.permissions, ...permissions]);
        return { ...prev, permissions: Array.from(newPerms) };
      }
    });
  }, []);

  const handleAdd = async () => {
    setError(null);
    startTransition(async () => {
      const result = await createRole({
        code: formData.code.toUpperCase().replace(/\s+/g, "_"),
        name: formData.name,
        description: formData.description || undefined,
        permissions: formData.permissions,
      });

      if (result.success && result.role) {
        setRoles([...roles, result.role]);
        setIsAddModalOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to create role");
      }
    });
  };

  const handleUpdate = async () => {
    if (!editingRole) return;
    setError(null);

    startTransition(async () => {
      const result = await updateRole(editingRole.id, {
        name: formData.name,
        description: formData.description || null,
        permissions: formData.permissions,
      });

      if (result.success) {
        setEditingRole(null);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to update role");
      }
    });
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteRole(deletingRole.id);

      if (result.success) {
        setRoles(roles.filter((r) => r.id !== deletingRole.id));
        setDeletingRole(null);
      } else {
        setError(result.error || "Failed to delete role");
      }
    });
  };

  const permissionGrid = (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Permissions ({formData.permissions.length} selected)
      </label>
      <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
        <div className="grid grid-cols-2 gap-6">
          {Object.entries(PermissionGroups).map(([groupName, permissions]) => {
            const allChecked = permissions.every((p) =>
              formData.permissions.includes(p)
            );
            const someChecked = permissions.some((p) =>
              formData.permissions.includes(p)
            );

            return (
              <div key={groupName} className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked && !allChecked;
                    }}
                    onChange={() => toggleGroup(permissions, allChecked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {groupName}
                  </span>
                </label>
                <div className="ml-6 space-y-1">
                  {permissions.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {formatPermissionLabel(perm)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Add Button */}
      <div className="mb-4">
        <Button onClick={openAddModal}>Add Role</Button>
      </div>

      {/* Role List */}
      {roles.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No roles configured. Add your first role to get started.
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{role.name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {role.code}
                  </span>
                  {role.isSystem && <Badge variant="info">System</Badge>}
                </div>
                {role.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {role.userCount} user{role.userCount !== 1 ? "s" : ""} assigned
                  {" \u2022 "}
                  {role.permissions.length} permission
                  {role.permissions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(role)}>
                  Edit
                </Button>
                {!role.isSystem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingRole(role)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Role Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Role"
        size="lg"
        className="!max-w-3xl"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })
              }
              placeholder="e.g., CUSTOM_ROLE"
              required
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Custom Role"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of this role"
              rows={2}
              className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {permissionGrid}
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
            Add Role
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={!!editingRole}
        onClose={() => setEditingRole(null)}
        title={`Edit Role${editingRole?.isSystem ? " (System)" : ""}`}
        size="lg"
        className="!max-w-3xl"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={formData.code}
              disabled
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Custom Role"
              required
              disabled={editingRole?.isSystem}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of this role"
              rows={2}
              disabled={editingRole?.isSystem}
              className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          {permissionGrid}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setEditingRole(null)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            loading={isPending}
            disabled={!formData.name}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingRole}
        onClose={() => setDeletingRole(null)}
        title="Delete Role"
        size="sm"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        <p className="text-gray-600">
          Are you sure you want to delete{" "}
          <strong>{deletingRole?.name}</strong>? This action cannot be undone.
        </p>
        {deletingRole && deletingRole.userCount > 0 && (
          <p className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
            Warning: This role has {deletingRole.userCount} user(s) assigned.
            They will need to be reassigned.
          </p>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeletingRole(null)}>
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
