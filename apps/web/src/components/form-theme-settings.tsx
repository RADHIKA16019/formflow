
"use client";

import { useEffect, useState, type ChangeEvent } from "react";

export type FormTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  buttonStyle: "rounded" | "pill" | "square";
  borderRadius: "small" | "medium" | "large";
  backgroundStyle: "solid" | "gradient";
  backgroundImage?: string;
  backgroundImageName?: string;
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

const builtInThemes: {
  name: string;
  category: string;
  description: string;
  theme: FormTheme;
}[] = [
  {
    name: "Classic Beige",
    category: "Elegant",
    description: "Warm and timeless",
    theme: { ...defaultTheme },
  },
  {
    name: "Ocean Blue",
    category: "Professional",
    description: "Clean and professional",
    theme: {
      ...defaultTheme,
      primaryColor: "#2563EB",
      secondaryColor: "#BFDBFE",
      backgroundColor: "#EFF6FF",
    },
  },
  {
    name: "Lavender",
    category: "Creative",
    description: "Soft and modern",
    theme: {
      ...defaultTheme,
      primaryColor: "#8B5CF6",
      secondaryColor: "#DDD6FE",
      backgroundColor: "#F5F3FF",
      fontFamily: "Poppins",
      buttonStyle: "pill",
      borderRadius: "large",
    },
  },
  {
    name: "Forest Green",
    category: "Nature",
    description: "Natural and calming",
    theme: {
      ...defaultTheme,
      primaryColor: "#15803D",
      secondaryColor: "#BBF7D0",
      backgroundColor: "#F0FDF4",
      fontFamily: "Lato",
    },
  },
  {
    name: "Sunset",
    category: "Creative",
    description: "Warm and vibrant",
    theme: {
      ...defaultTheme,
      primaryColor: "#EA580C",
      secondaryColor: "#FED7AA",
      backgroundColor: "#FFF7ED",
      fontFamily: "Nunito",
      buttonStyle: "pill",
      borderRadius: "large",
      backgroundStyle: "gradient",
    },
  },
  {
    name: "Minimal",
    category: "Minimal",
    description: "Simple black and white",
    theme: {
      ...defaultTheme,
      primaryColor: "#171717",
      secondaryColor: "#D4D4D4",
      backgroundColor: "#FAFAFA",
      fontFamily: "Roboto",
      buttonStyle: "square",
      borderRadius: "small",
    },
  },
];

const fontOptions = [
  "Inter",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Lato",
  "Nunito",
  "Playfair Display",
  "Montserrat",
  "Merriweather",
  "Raleway",
];

const categories = [
  "All",
  "Elegant",
  "Professional",
  "Creative",
  "Nature",
  "Minimal",
];

const backgroundPresets = [
  { name: "Warm Cream", color: "#FFF7E8" },
  { name: "Soft Pink", color: "#FCE7F3" },
  { name: "Sky Blue", color: "#E0F2FE" },
  { name: "Mint", color: "#D1FAE5" },
  { name: "Lavender", color: "#EDE9FE" },
  { name: "Peach", color: "#FFEDD5" },
  { name: "Dark", color: "#27272A" },
  { name: "White", color: "#FFFFFF" },
];

export default function FormThemeSettings({
  theme,
  onChange,
  onSave,
  isSaving = false,
}: Props) {
  const [localTheme, setLocalTheme] = useState<FormTheme>(
    theme ?? defaultTheme
  );

  const [activeCategory, setActiveCategory] = useState("All");
  const [fontSearch, setFontSearch] = useState("");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    setLocalTheme(theme ?? defaultTheme);
  }, [theme]);

  // Load selected Google Font
  useEffect(() => {
    const linkId = "formflow-google-font";

    let link = document.getElementById(
      linkId
    ) as HTMLLinkElement | null;

    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const fontName = localTheme.fontFamily.replace(/ /g, "+");

    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
  }, [localTheme.fontFamily]);

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

  // Upload custom background image
  function handleBackgroundImageUpload(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setImageError("Only JPG, PNG and WEBP images are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      setImageError("Image size must be less than 1 MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") return;

      const updated = {
        ...localTheme,
        backgroundImage: reader.result,
        backgroundImageName: file.name,
      };

      setLocalTheme(updated);
      onChange(updated);
      setImageError("");
    };

    reader.onerror = () => {
      setImageError("Unable to read image. Please try again.");
    };

    reader.readAsDataURL(file);

    e.target.value = "";
  }

  function removeBackgroundImage() {
    const updated = {
      ...localTheme,
      backgroundImage: undefined,
      backgroundImageName: undefined,
    };

    setLocalTheme(updated);
    onChange(updated);
    setImageError("");
  }

  function applyPreset(preset: FormTheme) {
    setLocalTheme(preset);
    onChange(preset);
    setImageError("");
  }

  function resetTheme() {
    applyPreset({ ...defaultTheme });
    setActiveCategory("All");
  }

  function applyBackgroundColor(color: string) {
    const updated = {
      ...localTheme,
      backgroundColor: color,
      backgroundStyle: "solid" as const,
      backgroundImage: undefined,
      backgroundImageName: undefined,
    };

    setLocalTheme(updated);
    onChange(updated);
    setImageError("");
  }

  const filteredThemes =
    activeCategory === "All"
      ? builtInThemes
      : builtInThemes.filter(
          (item) => item.category === activeCategory
        );

  const isPresetSelected = (preset: FormTheme) =>
    JSON.stringify(localTheme) === JSON.stringify(preset);

  const previewRadius =
    localTheme.borderRadius === "small"
      ? "6px"
      : localTheme.borderRadius === "large"
        ? "22px"
        : "12px";

  const buttonRadius =
    localTheme.buttonStyle === "pill"
      ? "9999px"
      : localTheme.buttonStyle === "square"
        ? "0px"
        : "8px";

  const previewBackground = localTheme.backgroundStyle === "gradient"
    ? `linear-gradient(135deg, ${localTheme.backgroundColor}, ${localTheme.secondaryColor})`
    : localTheme.backgroundColor;

  const backgroundPreviewStyle = localTheme.backgroundImage
    ? {
        backgroundColor: localTheme.backgroundColor,
        backgroundImage: `url("${localTheme.backgroundImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {
        background: previewBackground,
      };

  return (
    <div className="space-y-8 rounded-xl border bg-white p-5 sm:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            Theme Customization
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose a built-in theme or create your own.
          </p>
        </div>

        <button
          type="button"
          onClick={resetTheme}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Reset to Default
        </button>
      </div>

      {/* Built-in Themes */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Built-in Themes</h3>
          <p className="text-sm text-gray-500">
            Select a ready-made design for your form.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeCategory === category
                  ? "border-black bg-black text-white"
                  : "hover:bg-gray-100"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredThemes.map((item) => {
            const selected = isPresetSelected(item.theme);

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => applyPreset(item.theme)}
                className={`overflow-hidden rounded-xl border-2 text-left transition hover:shadow-md ${
                  selected
                    ? "border-black ring-2 ring-gray-200"
                    : "border-gray-200"
                }`}
              >
                <div
                  className="space-y-3 p-4"
                  style={{
                    background:
                      item.theme.backgroundStyle === "gradient"
                        ? `linear-gradient(135deg, ${item.theme.backgroundColor}, ${item.theme.secondaryColor})`
                        : item.theme.backgroundColor,
                  }}
                >
                  <div
                    className="h-2 w-16 rounded-full"
                    style={{
                      backgroundColor: item.theme.secondaryColor,
                    }}
                  />

                  <div
                    className="rounded-lg bg-white p-3 shadow-sm"
                    style={{
                      borderRadius:
                        item.theme.borderRadius === "small"
                          ? "6px"
                          : item.theme.borderRadius === "large"
                            ? "18px"
                            : "12px",
                    }}
                  >
                    <div
                      className="mb-3 h-2 w-24 rounded"
                      style={{
                        backgroundColor: item.theme.primaryColor,
                      }}
                    />
                    <div className="mb-2 h-2 w-full rounded bg-gray-200" />
                    <div className="h-2 w-2/3 rounded bg-gray-200" />

                    <div
                      className="mt-4 h-8 w-20"
                      style={{
                        backgroundColor: item.theme.primaryColor,
                        borderRadius:
                          item.theme.buttonStyle === "pill"
                            ? "9999px"
                            : item.theme.buttonStyle === "square"
                              ? "0"
                              : "8px",
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.description}
                    </p>
                  </div>

                  {selected && (
                    <span className="rounded-full bg-black px-3 py-1 text-xs text-white">
                      Selected
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="border-t" />

      {/* Custom Colors */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Custom Colors</h3>
          <p className="text-sm text-gray-500">
            Fine-tune your selected theme.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["primaryColor", "Primary Color"],
              ["secondaryColor", "Secondary Color"],
              ["backgroundColor", "Background Color"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-medium">
                {label}
              </label>

              <div className="flex items-center gap-2 rounded-lg border p-2">
                <input
                  type="color"
                  value={localTheme[key]}
                  onChange={(e) =>
                    updateTheme(key, e.target.value)
                  }
                  className="h-9 w-12 cursor-pointer"
                />

                <span className="text-sm text-gray-600">
                  {localTheme[key].toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Google Fonts */}
      <section>
        <label className="mb-2 block text-sm font-semibold">
          Google Fonts
        </label>

        <input
          type="text"
          placeholder="Search Google Fonts..."
          value={fontSearch}
          onChange={(e) => setFontSearch(e.target.value)}
          className="mb-2 w-full rounded-lg border p-3"
        />

        <select
          value={localTheme.fontFamily}
          onChange={(e) =>
            updateTheme("fontFamily", e.target.value)
          }
          className="w-full rounded-lg border p-3"
        >
          {fontOptions
            .filter((font) =>
              font.toLowerCase().includes(fontSearch.toLowerCase())
            )
            .map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
        </select>

        <p
          className="mt-3 text-sm text-gray-600"
          style={{ fontFamily: localTheme.fontFamily }}
        >
          The quick brown fox jumps over the lazy dog.
        </p>

        <p className="mt-2 text-xs text-gray-500">
          Only Google Fonts are available in this font library.
        </p>
      </section>

      {/* Button Style */}
      <section>
        <label className="mb-3 block text-sm font-semibold">
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
      </section>

      {/* Border Radius */}
      <section>
        <label className="mb-2 block text-sm font-semibold">
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
          className="w-full rounded-lg border p-3"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </section>

      {/* Background Image Upload */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">
            Custom Background Image
          </h3>
          <p className="text-sm text-gray-500">
            Upload your own background image for your form.
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 text-center transition hover:border-black hover:bg-gray-50">
          <span className="text-3xl">🖼️</span>

          <span className="mt-3 font-semibold">
            Click to upload background
          </span>

          <span className="mt-1 text-xs text-gray-500">
            JPG, PNG or WEBP · Maximum 1 MB
          </span>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleBackgroundImageUpload}
            className="hidden"
          />
        </label>

        {imageError && (
          <p className="text-sm text-red-600">{imageError}</p>
        )}

        {localTheme.backgroundImage && (
          <div className="space-y-3 rounded-xl border p-4">
            <div
              className="h-40 rounded-lg border"
              style={{
                backgroundImage: `url("${localTheme.backgroundImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="break-all text-sm text-gray-600">
                {localTheme.backgroundImageName || "Uploaded image"}
              </p>

              <button
                type="button"
                onClick={removeBackgroundImage}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Remove Image
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Background Presets */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">
            Background Presets
          </h3>
          <p className="text-sm text-gray-500">
            Choose a background color instead of an image.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {backgroundPresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyBackgroundColor(preset.color)}
              className={`overflow-hidden rounded-xl border-2 text-left ${
                !localTheme.backgroundImage &&
                localTheme.backgroundColor === preset.color
                  ? "border-black ring-2 ring-gray-200"
                  : "border-gray-200"
              }`}
            >
              <div
                className="h-16"
                style={{ backgroundColor: preset.color }}
              />
              <p className="p-2 text-sm font-medium">
                {preset.name}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Background Style */}
      <section>
        <label className="mb-3 block text-sm font-semibold">
          Background Style
        </label>

        <div className="flex flex-wrap gap-2">
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
      </section>

      {/* Live Preview */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Live Preview</h3>
          <p className="text-sm text-gray-500">
            Preview your custom form appearance.
          </p>
        </div>

        <div
          className="space-y-4 border p-6 transition-all"
          style={{
            ...backgroundPreviewStyle,
            fontFamily: localTheme.fontFamily,
            borderRadius: previewRadius,
          }}
        >
          <div className="mx-auto max-w-md space-y-4 rounded-xl bg-white p-5 shadow-sm">
            <h3
              className="text-xl font-bold"
              style={{ color: localTheme.primaryColor }}
            >
              Your Form Preview
            </h3>

            <p className="text-sm text-gray-600">
              Tell us a little about yourself.
            </p>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Your Name
              </label>

              <div
                className="rounded-lg border p-3 text-sm text-gray-400"
                style={{ borderRadius: previewRadius }}
              >
                Enter your name...
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Email Address
              </label>

              <div
                className="rounded-lg border p-3 text-sm text-gray-400"
                style={{ borderRadius: previewRadius }}
              >
                Enter your email...
              </div>
            </div>

            <button
              type="button"
              className="px-6 py-3 text-sm font-medium text-white"
              style={{
                backgroundColor: localTheme.primaryColor,
                borderRadius: buttonRadius,
              }}
            >
              Submit
            </button>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <p className="text-xs text-gray-500">
          Changes are applied to the editor preview.
          Save to persist your theme.
        </p>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-lg bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Theme"}
        </button>
      </div>
    </div>
  );
}
