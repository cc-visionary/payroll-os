"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteImportRecord } from "@/app/actions/attendance-import";

interface DeleteImportButtonProps {
  importId: string;
  fileName: string;
}

export function DeleteImportButton({ importId, fileName }: DeleteImportButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteImportRecord(importId);
      if (result.success) {
        setIsOpen(false);
        router.push("/attendance/import");
      } else {
        setError(result.error || "Failed to delete import");
      }
    });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Delete Import
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Delete Import Record"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete the import record for{" "}
            <strong>{fileName}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            This will remove the import metadata and raw row data. Any time logs
            that were already created from this import will remain in the system.
          </p>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
