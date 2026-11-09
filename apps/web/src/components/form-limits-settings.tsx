"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";

interface FormLimitsSettingsProps {
  formId: string;
  title: string;
  description?: string | null;
  expiresAt?: Date | string | null;
  responseLimit?: number | null;
}

function toLocalDateTime(value?: Date | string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 16);
}

export default function FormLimitsSettings({
  formId,
  title,
  description,
  expiresAt,
  responseLimit,
}: FormLimitsSettingsProps) {
  const [expiry, setExpiry] = useState(() =>
    toLocalDateTime(expiresAt)
  );

  const [limit, setLimit] = useState(() =>
    responseLimit != null ? String(responseLimit) : ""
  );

  const updateForm = trpc.updateForm.useMutation();

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (expiry) {
      const selectedDate = new Date(expiry);

      if (Number.isNaN(selectedDate.getTime())) {
        return;
      }

      if (selectedDate.getTime() <= Date.now()) {
        return;
      }
    }

    const responseLimitValue = limit.trim()
      ? Number(limit)
      : null;

    if (
      responseLimitValue !== null &&
      (!Number.isInteger(responseLimitValue) ||
        responseLimitValue < 1 ||
        responseLimitValue > 1000000)
    ) {
      return;
    }

    updateForm.mutate({
      formId,
      title,
      description: description ?? undefined,
      expiresAt: expiry ? new Date(expiry) : null,
      responseLimit: responseLimitValue,
    });
  };

  const clearLimits = () => {
    setExpiry("");
    setLimit("");

    updateForm.mutate({
      formId,
      title,
      description: description ?? undefined,
      expiresAt: null,
      responseLimit: null,
    });
  };

  const invalidExpiry =
    !!expiry && new Date(expiry).getTime() <= Date.now();

  const invalidLimit =
    !!limit &&
    (!Number.isInteger(Number(limit)) ||
      Number(limit) < 1 ||
      Number(limit) > 1000000);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Response Limits
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Control when your form stops accepting responses.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label
            htmlFor="form-expiry"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Expiry date and time
          </label>

          <input
            id="form-expiry"
            type="datetime-local"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:text-white"
          />

          {invalidExpiry && (
            <p className="mt-2 text-xs text-red-600">
              Please select a future date and time.
            </p>
          )}

          <p className="mt-1 text-xs text-gray-500">
            Leave empty if you don't want your form to expire.
          </p>
        </div>

        <div>
          <label
            htmlFor="response-limit"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Maximum responses
          </label>

          <input
            id="response-limit"
            type="number"
            min="1"
            max="1000000"
            step="1"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="e.g. 100"
            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:text-white"
          />

          {invalidLimit && (
            <p className="mt-2 text-xs text-red-600">
              Enter a whole number between 1 and 1,000,000.
            </p>
          )}

          <p className="mt-1 text-xs text-gray-500">
            Leave empty for unlimited responses.
          </p>
        </div>

        {updateForm.error && (
          <p className="text-sm text-red-600">
            {updateForm.error.message}
          </p>
        )}

        {updateForm.isSuccess && (
          <p className="text-sm text-green-600">
            Form settings saved successfully!
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={
              updateForm.isPending ||
              invalidExpiry ||
              invalidLimit
            }
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateForm.isPending ? "Saving..." : "Save Settings"}
          </button>

          <button
            type="button"
            onClick={clearLimits}
            disabled={updateForm.isPending}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Clear Limits
          </button>
        </div>
      </form>
    </section>
  );
}