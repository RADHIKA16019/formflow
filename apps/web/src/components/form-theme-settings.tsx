"use client";

import { useEffect, useState } from "react";

export type FormTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  buttonStyle: "rounded" | "pill" | "square";
  borderRadius: "small" | "medium" | "large";
  backgroundStyle: "solid" | "gradient";
};

type Props = {
  theme: FormTheme;
  onChange: (theme: FormTheme) => void;
  onSave: () => void;
  isSaving?: boolean;
};

const defaultTheme: FormTheme = {
  primaryColor: "#B7B09E",
  secondaryColor: "#CFC6B1",
  backgroundColor: "#EBE2CC",
  fontFamily: "Inter",
  buttonStyle: "rounded",
  borderRadius: "medium",
  backgroundStyle: "solid",
};

export default function FormThemeSettings({
  theme,
  onChange,
  onSave,
  isSaving = false,
}: Props) {
  const [localTheme, setLocalTheme] = useState<FormTheme>(
    theme ?? defaultTheme
  );

  useEffect(() => {
    setLocalTheme(theme ?? defaultTheme);
  }, [theme]);

  function updateTheme<K extends keyof FormTheme>(
    key: K,
    value: FormTheme[K]
  ) {
    const updated = {
      ...localTheme,
      [key]: value,
    };

    setLocalTheme(updated);
    onChange(updated);
  }

  return (
    <div className="space-y-6 rounded-xl border bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Theme Customization</h2>
        <p className="text-sm text-gray-500">
          Customize the appearance of your form.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Primary Color
          </label>
          <input
            type="color"
            value={localTheme.primaryColor}
            onChange={(e) =>
              updateTheme("primaryColor", e.target.value)
            }
            className="h-11 w-full cursor-pointer rounded border p-1"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Secondary Color
          </label>
          <input
            type="color"
            value={localTheme.secondaryColor}
            onChange={(e) =>
              updateTheme("secondaryColor", e.target.value)
            }
            className="h-11 w-full cursor-pointer rounded border p-1"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Background Color
          </label>
          <input
            type="color"
            value={localTheme.backgroundColor}
            onChange={(e) =>
              updateTheme("backgroundColor", e.target.value)
            }
            className="h-11 w-full cursor-pointer rounded border p-1"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Font Family
        </label>
        <select
          value={localTheme.fontFamily}
          onChange={(e) =>
            updateTheme("fontFamily", e.target.value)
          }
          className="w-full rounded-lg border p-2"
        >
          <option value="Inter">Inter</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Tahoma">Tahoma</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Button Style
        </label>
        <div className="flex flex-wrap gap-2">
          {(["rounded", "pill", "square"] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => updateTheme("buttonStyle", style)}
              className={`rounded-lg border px-4 py-2 capitalize ${
                localTheme.buttonStyle === style
                  ? "border-black bg-gray-100 font-semibold"
                  : ""
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Border Radius
        </label>
        <select
          value={localTheme.borderRadius}
          onChange={(e) =>
            updateTheme(
              "borderRadius",
              e.target.value as FormTheme["borderRadius"]
            )
          }
          className="w-full rounded-lg border p-2"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Background Style
        </label>
        <div className="flex gap-2">
          {(["solid", "gradient"] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => updateTheme("backgroundStyle", style)}
              className={`rounded-lg border px-4 py-2 capitalize ${
                localTheme.backgroundStyle === style
                  ? "border-black bg-gray-100 font-semibold"
                  : ""
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Preview</p>
        <div
          className="space-y-3 rounded-xl p-5"
          style={{
            background:
              localTheme.backgroundStyle === "gradient"
                ? `linear-gradient(135deg, ${localTheme.backgroundColor}, ${localTheme.secondaryColor})`
                : localTheme.backgroundColor,
            fontFamily: localTheme.fontFamily,
            borderRadius:
              localTheme.borderRadius === "small"
                ? "6px"
                : localTheme.borderRadius === "large"
                  ? "20px"
                  : "12px",
          }}
        >
          <h3 className="font-semibold" style={{ color: localTheme.primaryColor }}>
            Your Form Preview
          </h3>
          <p style={{ color: "#444444" }}>
            This is how your form theme will look.
          </p>
          <button
            type="button"
            className="px-5 py-2 text-white"
            style={{
              backgroundColor: localTheme.primaryColor,
              borderRadius:
                localTheme.buttonStyle === "pill"
                  ? "9999px"
                  : localTheme.buttonStyle === "square"
                    ? "0"
                    : "8px",
            }}
          >
            Submit
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="rounded-lg bg-black px-5 py-2 text-white disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Theme"}
      </button>
    </div>
  );
}