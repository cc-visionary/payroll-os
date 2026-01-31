"use client";

// =============================================================================
// PeopleOS PH - Import Events Modal (CSV)
// =============================================================================

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { importCalendarEvents, type ImportCalendarRow } from "@/app/actions/calendar";

interface ImportEventsModalProps {
  calendarId: string;
  year: number;
}

const SAMPLE_CSV = `date,name,type
2025-01-01,New Year's Day,REGULAR_HOLIDAY
2025-04-09,Araw ng Kagitingan,REGULAR_HOLIDAY
2025-04-17,Maundy Thursday,REGULAR_HOLIDAY
2025-04-18,Good Friday,REGULAR_HOLIDAY
2025-05-01,Labor Day,REGULAR_HOLIDAY
2025-06-12,Independence Day,REGULAR_HOLIDAY
2025-08-21,Ninoy Aquino Day,SPECIAL_HOLIDAY
2025-08-25,National Heroes Day,REGULAR_HOLIDAY
2025-11-01,All Saints Day,SPECIAL_HOLIDAY
2025-11-30,Bonifacio Day,REGULAR_HOLIDAY
2025-12-24,Christmas Eve,SPECIAL_HOLIDAY
2025-12-25,Christmas Day,REGULAR_HOLIDAY
2025-12-30,Rizal Day,REGULAR_HOLIDAY
2025-12-31,New Year's Eve,SPECIAL_HOLIDAY`;

export function ImportEventsModal({
  calendarId,
  year,
}: ImportEventsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const parseCsv = (csv: string): ImportCalendarRow[] => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];

    // Skip header row
    return lines.slice(1).map((line) => {
      const [date, name, type] = line.split(",").map((s) => s.trim());
      return { date, name, type };
    });
  };

  const handleImport = async () => {
    setError(null);
    setResult(null);

    if (!csvContent.trim()) {
      setError("Please provide CSV content or upload a file");
      return;
    }

    const rows = parseCsv(csvContent);
    if (rows.length === 0) {
      setError("No valid rows found in CSV");
      return;
    }

    startTransition(async () => {
      const importResult = await importCalendarEvents(calendarId, rows);

      if (importResult.success && "created" in importResult) {
        setResult({
          imported: importResult.created,
          skipped: importResult.skipped,
        });
        setCsvContent("");
      } else if (!importResult.success) {
        setError(importResult.error || "Failed to import events");
      }
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
    setResult(null);
    setCsvContent("");
  };

  const loadSample = () => {
    // Update year in sample CSV
    const updatedSample = SAMPLE_CSV.replace(/2025/g, year.toString());
    setCsvContent(updatedSample);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Import CSV
      </Button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Import Calendar Events">
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
              Successfully imported {result.imported} events.
              {result.skipped > 0 && ` Skipped ${result.skipped} duplicates.`}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="text-center text-sm text-gray-500">or</div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Paste CSV Content
              </label>
              <Button type="button" size="sm" variant="ghost" onClick={loadSample}>
                Load PH Holidays Sample
              </Button>
            </div>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full h-48 px-3 py-2 text-sm font-mono border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="date,name,type&#10;2025-01-01,New Year's Day,REGULAR_HOLIDAY"
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-md text-sm">
            <strong>CSV Format:</strong>
            <ul className="mt-1 text-gray-600 list-disc list-inside">
              <li>
                Headers: <code>date,name,type</code>
              </li>
              <li>
                Date format: <code>YYYY-MM-DD</code>
              </li>
              <li>
                Types:{" "}
                <code>REGULAR_HOLIDAY, SPECIAL_HOLIDAY, SPECIAL_WORKING_DAY, COMPANY_EVENT</code>
              </li>
            </ul>
          </div>
        </div>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              type="button"
              onClick={handleImport}
              loading={isPending}
              disabled={!csvContent.trim()}
            >
              Import Events
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
}
