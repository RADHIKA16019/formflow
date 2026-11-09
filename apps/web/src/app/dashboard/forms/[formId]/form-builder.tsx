"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import FormLimitsSettings from "@/components/form-limits-settings";
import FormThemeSettings, {
  type FormTheme,
} from "@/components/form-theme-settings";  


import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";

import { trpc } from "@/utils/trpc";

import SortableQuestionCard from "./components/sortable-question-card";
import QuestionPreview from "./components/question-preview";

import {
  questionTypes,
  type QuestionType,
  type LogicOperator,
  type QuestionConfig,
  type QuestionCardData,
  type AnswerValue,
  type PreviewAnswers,
} from "./components/types";

import {
  getConfig,
  getOperators,
  calculateVisibleQuestions,
} from "./components/helpers";

export default function FormBuilder() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState<FormTheme>({
  primaryColor: "#B7B09E",
  secondaryColor: "#CFC6B1",
  backgroundColor: "#EBE2CC",
  fontFamily: "Inter",
  buttonStyle: "rounded",
  borderRadius: "medium",
  backgroundStyle: "solid",
});
  const [type, setType] = useState<QuestionType>("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState(["Option 1", "Option 2"]);
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("5");

  const [logicEnabled, setLogicEnabled] = useState(false);
  const [logicAction, setLogicAction] = useState<"show" | "hide">("show");
  const [logicQuestionId, setLogicQuestionId] = useState("");
  const [logicOperator, setLogicOperator] = useState<LogicOperator>("equals");
  const [logicValue, setLogicValue] = useState("");

  const [previewAnswers, setPreviewAnswers] = useState<PreviewAnswers>({});
  const [shareOrigin, setShareOrigin] = useState("");

useEffect(() => {
  setShareOrigin(window.location.origin);
}, []);
  const [previewPageNumber, setPreviewPageNumber] = useState(1);

  const [selectedPageNumber, setSelectedPageNumber] = useState(1);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [editingPageTitle, setEditingPageTitle] = useState("");
  const [editingPageDescription, setEditingPageDescription] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const utils = trpc.useUtils();
  const deleteFormMutation = trpc.deleteForm.useMutation({
  onSuccess: async () => {
    await utils.getMyForms.invalidate();
    router.push("/dashboard/forms");
  },
});

  const {
    data: form,
    isLoading: isFormLoading,
    isError: isFormError,
  } = trpc.getFormById.useQuery({ formId });

  const {
    data: questions,
    isLoading: areQuestionsLoading,
    isError: areQuestionsError,
  } = trpc.getQuestionsByForm.useQuery({ formId });

  const {
    data: pages,
    isLoading: arePagesLoading,
    isError: arePagesError,
  } = trpc.getPages.useQuery({ formId });

  const questionList = useMemo(
    () =>
      [...(questions ?? [])].sort(
        (a, b) =>
          a.pageNumber - b.pageNumber || a.position - b.position
      ) as QuestionCardData[],
    [questions]
  );

  const pageList = useMemo(
    () =>
      [...(pages ?? [])].sort((a, b) => a.pageNumber - b.pageNumber),
    [pages]
  );

  const currentPage = pageList.find(
    (page) => page.pageNumber === selectedPageNumber
  );

  useEffect(() => {
    if (pageList.length > 0 && !pageList.some(
      (page) => page.pageNumber === selectedPageNumber
    )) {
      setSelectedPageNumber(pageList[0].pageNumber);
    }
  }, [pageList, selectedPageNumber]);

  useEffect(() => {
    if (currentPage) {
      setEditingPageTitle(currentPage.title);
      setEditingPageDescription(currentPage.description ?? "");
    }
  }, [currentPage?.id, currentPage?.title, currentPage?.description]);

  const currentPageQuestions = questionList.filter(
    (question) => question.pageNumber === selectedPageNumber
  );

  const visiblePreviewQuestions = useMemo(
    () => calculateVisibleQuestions(questionList, previewAnswers),
    [questionList, previewAnswers]
  );

  const visibleQuestionIds = useMemo(
    () => visiblePreviewQuestions.map((question) => question.id).join("|"),
    [visiblePreviewQuestions]
  );

  useEffect(() => {
    const visibleIds = new Set(
      visibleQuestionIds ? visibleQuestionIds.split("|") : []
    );

    setPreviewAnswers((current) => {
      const updated = { ...current };
      let changed = false;

      for (const questionId of Object.keys(updated)) {
        if (!visibleIds.has(questionId)) {
          delete updated[questionId];
          changed = true;
        }
      }

      return changed ? updated : current;
    });
  }, [visibleQuestionIds]);

  const visiblePreviewPages = pageList.filter((page) =>
    visiblePreviewQuestions.some(
      (question) => question.pageNumber === page.pageNumber
    )
  );

  const currentPreviewPageQuestions = visiblePreviewQuestions.filter(
    (question) => question.pageNumber === previewPageNumber
  );

  const previewPageIndex = visiblePreviewPages.findIndex(
  (page) => page.pageNumber === previewPageNumber
);

const previewProgress =
  previewPageIndex >= 0 && visiblePreviewPages.length > 0
    ? ((previewPageIndex + 1) / visiblePreviewPages.length) * 100
    : 0;

useEffect(() => {
  if (!isPreviewOpen || visiblePreviewPages.length === 0) return;

  const currentPageIsVisible = visiblePreviewPages.some(
    (page) => page.pageNumber === previewPageNumber
  );

  if (!currentPageIsVisible) {
    setPreviewPageNumber(visiblePreviewPages[0].pageNumber);
  }
}, [isPreviewOpen, visiblePreviewPages, previewPageNumber]);

  const refreshQuestions = async () => {
    await utils.getQuestionsByForm.invalidate({ formId });
  };

  const refreshPages = async () => {
    await utils.getPages.invalidate({ formId });
  };

  const refreshForm = async () => {
    await utils.getFormById.invalidate({ formId });
    await utils.getMyForms.invalidate();
  };

  const createPageMutation = trpc.createPage.useMutation({
    onSuccess: async () => {
      const nextPageNumber =
        Math.max(0, ...pageList.map((page) => page.pageNumber)) + 1;

      await refreshPages();
      setSelectedPageNumber(nextPageNumber);
      setNewPageTitle("");
    },
  });

  const updatePageMutation = trpc.updatePage.useMutation({
    onSuccess: refreshPages,
  });

  const deletePageMutation = trpc.deletePage.useMutation({
    onSuccess: async () => {
      await Promise.all([refreshPages(), refreshQuestions()]);
    },
  });

  const reorderPagesMutation = trpc.reorderPages.useMutation({
    onSuccess: refreshPages,
  });

  const moveQuestionMutation = trpc.moveQuestionToPage.useMutation({
    onSuccess: refreshQuestions,
  });

  const createQuestionMutation = trpc.createQuestion.useMutation({
    onSuccess: async () => {
      await refreshQuestions();
      resetFields();
    },
  });

  const updateQuestionMutation = trpc.updateQuestion.useMutation({
    onSuccess: async () => {
      await refreshQuestions();
      resetFields();
    },
  });

  const deleteQuestionMutation = trpc.deleteQuestion.useMutation({
    onSuccess: refreshQuestions,
  });

  const reorderQuestionsMutation = trpc.reorderQuestions.useMutation({
    onSuccess: refreshQuestions,
  });

  const publishMutation = trpc.publishForm.useMutation({
    onSuccess: refreshForm,
  });

  const unpublishMutation = trpc.unpublishForm.useMutation({
    onSuccess: refreshForm,
  });

  const visibilityMutation = trpc.updateFormVisibility.useMutation({
    onSuccess: refreshForm,
  });
useEffect(() => {
  if (form?.theme) {
    setTheme(form.theme as FormTheme);
  }
}, [form?.theme]);
const updateThemeMutation = trpc.updateForm.useMutation({
  onSuccess: async () => {
    await refreshForm();
  },
});

const saveTheme = () => {
  if (!form) return;

  updateThemeMutation.mutate({
    formId,
    title: form.title,
    description: form.description ?? "",
    theme,
  });
};
  function resetFields() {
    setTitle("");
    setDescription("");
    setType("text");
    setRequired(false);
    setOptions(["Option 1", "Option 2"]);
    setMin("1");
    setMax("5");
    setLogicEnabled(false);
    setLogicAction("show");
    setLogicQuestionId("");
    setLogicOperator("equals");
    setLogicValue("");
    setEditingQuestionId(null);
    setIsModalOpen(false);
  }

  const editingQuestionIndex = editingQuestionId
  ? questionList.findIndex(
      (question) => question.id === editingQuestionId
    )
  : -1;

const nextPageQuestionIndex = questionList.findIndex(
  (question) => question.pageNumber > selectedPageNumber
);

const currentQuestionIndex = editingQuestionId
  ? editingQuestionIndex
  : nextPageQuestionIndex === -1
    ? questionList.length
    : nextPageQuestionIndex;

const availableLogicQuestions = questionList.slice(
  0,
  Math.max(currentQuestionIndex, 0)
);

  const selectedLogicQuestion = availableLogicQuestions.find(
    (question) => question.id === logicQuestionId
  );

  const selectedLogicQuestionType =
    selectedLogicQuestion?.type as QuestionType | undefined;

  const logicOperators = selectedLogicQuestionType
    ? getOperators(selectedLogicQuestionType)
    : [];

  const handleLogicQuestionChange = (questionId: string) => {
    setLogicQuestionId(questionId);

    const source = availableLogicQuestions.find(
      (question) => question.id === questionId
    );

    if (!source) {
      setLogicValue("");
      return;
    }

    const sourceType = source.type as QuestionType;
    const sourceConfig = getConfig(source.config);

    setLogicOperator(
      sourceType === "checkbox" ? "contains" : "equals"
    );

    if (
      (sourceType === "select" || sourceType === "checkbox") &&
      sourceConfig.options?.length
    ) {
      setLogicValue(sourceConfig.options[0]);
    } else {
      setLogicValue("");
    }
  };

  const openCreateModal = () => {
    resetFields();
    createQuestionMutation.reset();
    updateQuestionMutation.reset();
    setIsModalOpen(true);
  };

  const openEditModal = (
    question: QuestionCardData
  ) => {
    const config = getConfig(question.config);

    setEditingQuestionId(question.id);
    setTitle(question.title);
    setDescription(question.description ?? "");
    setType(question.type as QuestionType);
    setRequired(question.required);
    setOptions(config.options ?? ["Option 1", "Option 2"]);
    setMin(String(config.min ?? 1));
    setMax(String(config.max ?? 5));

    setLogicEnabled(Boolean(config.logic));
    setLogicAction(config.logic?.action ?? "show");
    setLogicQuestionId(config.logic?.questionId ?? "");
    setLogicOperator(config.logic?.operator ?? "equals");
    setLogicValue(String(config.logic?.value ?? ""));

    createQuestionMutation.reset();
    updateQuestionMutation.reset();
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);
    setOptions(["Option 1", "Option 2"]);
    setMin("1");
    setMax("5");
  };

  const buildConfig = (): QuestionConfig => {
    const config: QuestionConfig = {};

    if (type === "select" || type === "checkbox") {
      config.options = options.map((option) => option.trim()).filter(Boolean);
    }

    if (type === "number" || type === "rating") {
      config.min = Number(min);
      config.max = Number(max);
    }

    if (logicEnabled && selectedLogicQuestion) {
      const sourceType = selectedLogicQuestion.type as QuestionType;

      config.logic = {
        action: logicAction,
        questionId: logicQuestionId,
        operator: logicOperator,
        value:
          sourceType === "number" || sourceType === "rating"
            ? Number(logicValue)
            : logicValue,
      };
    }

    return config;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const config = buildConfig();

    if (editingQuestionId) {
      updateQuestionMutation.mutate({
        questionId: editingQuestionId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        required,
        config,
        pageNumber: questionList.find(
          (question) => question.id === editingQuestionId
        )?.pageNumber ?? selectedPageNumber,
      });
    } else {
      createQuestionMutation.mutate({
        formId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        required,
        config,
        pageNumber: selectedPageNumber,
      });
    }
  };

  const handleDelete = (questionId: string) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      deleteQuestionMutation.mutate({ questionId });
    }
  };
  const handleDeleteForm = () => {
  const confirmed = window.confirm(
    `Are you sure you want to delete "${form?.title ?? "this form"}"? All associated form data may also be affected. This action cannot be undone.`
  );

  if (confirmed) {
    deleteFormMutation.mutate({ formId });
  }
};

  const handleQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = currentPageQuestions.findIndex(
      (question) => question.id === active.id
    );

    const newIndex = currentPageQuestions.findIndex(
      (question) => question.id === over.id
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const updated = arrayMove(currentPageQuestions, oldIndex, newIndex);

    reorderQuestionsMutation.mutate({
      formId,
      questionIds: updated.map((question) => question.id),
    });
  };

  const handlePageDragEnd = (direction: -1 | 1) => {
    const currentIndex = pageList.findIndex(
      (page) => page.pageNumber === selectedPageNumber
    );

    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= pageList.length) {
      return;
    }

    const updated = [...pageList];
    const [movedPage] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, movedPage);

    reorderPagesMutation.mutate({
      formId,
      pageIds: updated.map((page) => page.id),
    });
  };

  const handleSavePageDetails = () => {
    if (!currentPage || !editingPageTitle.trim()) return;

    updatePageMutation.mutate({
      pageId: currentPage.id,
      title: editingPageTitle.trim(),
      description: editingPageDescription.trim() || undefined,
    });
  };

  const handleDeletePage = () => {
    if (!currentPage || pageList.length <= 1) return;

    const confirmed = window.confirm(
      `Delete "${currentPage.title}"? Its questions will be moved to another page.`
    );

    if (confirmed) {
      deletePageMutation.mutate({ pageId: currentPage.id });
    }
  };

  const handleCopyShareLink = async () => {
    if (!form?.slug) return;

    const shareUrl = `${window.location.origin}/forms/${form.slug}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsLinkCopied(true);
      setCopyError("");
    } catch {
      setIsLinkCopied(false);
      setCopyError("Unable to copy link. Please copy it manually.");
    }
  };

  const handleDownloadQrCode = () => {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "#form-qr-code canvas"
  );

  if (!canvas || !form?.slug) return;

  const pngUrl = canvas.toDataURL("image/png");
  const downloadLink = document.createElement("a");

  downloadLink.href = pngUrl;
  downloadLink.download = `${form.slug}-qr-code.png`;
  downloadLink.click();
};

  const openPreview = () => {
    setPreviewAnswers({});
    setPreviewPageNumber(
      visiblePreviewPages[0]?.pageNumber ?? pageList[0]?.pageNumber ?? 1
    );
    setIsPreviewOpen(true);
  };

  const isSaving =
    createQuestionMutation.isPending || updateQuestionMutation.isPending;

  const mutationError =
    createQuestionMutation.error?.message ||
    updateQuestionMutation.error?.message;

  const hasInvalidOptions =
    (type === "select" || type === "checkbox") &&
    options.map((option) => option.trim()).filter(Boolean).length < 2;

  const hasInvalidRange =
    (type === "number" || type === "rating") &&
    (min === "" ||
      max === "" ||
      !Number.isFinite(Number(min)) ||
      !Number.isFinite(Number(max)) ||
      Number(min) > Number(max));

  const hasInvalidLogic =
    logicEnabled &&
    (!logicQuestionId ||
      !selectedLogicQuestion ||
      !logicValue.trim() ||
      ((selectedLogicQuestionType === "number" ||
        selectedLogicQuestionType === "rating") &&
        !Number.isFinite(Number(logicValue))));

  if (isFormLoading || areQuestionsLoading || arePagesLoading) {
    return <div className="p-8 text-sm text-muted">Loading form builder...</div>;
  }

  if (isFormError || !form) {
    return <div className="p-8 text-sm text-red-600">Form not found.</div>;
  }

  if (areQuestionsError || !questions || arePagesError || !pages) {
    return (
      <div className="p-8 text-sm text-red-600">
        Failed to load form questions or pages.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex flex-col justify-between gap-5 border-b border-border px-6 py-6 sm:flex-row sm:items-center sm:px-10">
        <div>
          <p className="text-sm text-muted">FormFlow / Form Builder</p>
          <h1 className="mt-2 text-2xl font-semibold">{form.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {form.description || "No description added."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                form.status === "published"
                  ? "bg-green-50 text-green-700"
                  : "bg-cream text-foreground"
              }`}
            >
              {form.status === "published" ? "Published" : "Draft"}
            </span>

            <select
              value={form.visibility}
              disabled={visibilityMutation.isPending}
              onChange={(e) =>
                visibilityMutation.mutate({
                  formId,
                  visibility: e.target.value as "public" | "unlisted",
                })
              }
              className="rounded-lg border border-border bg-white px-3 py-3 text-sm"
            >
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>

            {form.status === "published" ? (
              <button
                type="button"
                onClick={() => unpublishMutation.mutate({ formId })}
                disabled={unpublishMutation.isPending}
                className="rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:bg-cream disabled:opacity-50"
              >
                {unpublishMutation.isPending ? "Unpublishing..." : "Unpublish"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  publishMutation.mutate({
                    formId,
                    visibility: form.visibility,
                  })
                }
                disabled={publishMutation.isPending || questions.length === 0}
                className="rounded-lg bg-[#302E29] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#514D45] disabled:opacity-50"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish Form"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openPreview}
            className="rounded-lg border border-border px-5 py-3 text-sm font-semibold transition hover:bg-cream"
          >
            ◉ Preview Form
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-[#CFC6B1] px-5 py-3 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E]"
          >
            + Add Question
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign(`/dashboard/forms/${formId}/responses`)
            }
            className="rounded-lg border border-[#DED6C1] px-5 py-3 text-sm font-semibold text-[#302E29] transition hover:bg-cream"
          >
            View Responses →
          </button>
          <button
  type="button"
  onClick={handleDeleteForm}
  disabled={deleteFormMutation.isPending}
  className="rounded-lg border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
>
  {deleteFormMutation.isPending ? "Deleting..." : "Delete Form"}
</button>
        </div>
      </header>

      {form.status === "published" && form.slug && (
  <div className="border-b border-border bg-[#FAF9F6] px-6 py-6 sm:px-10">
    <div className="mx-auto grid max-w-3xl gap-6 rounded-2xl border border-[#E8DFD4] bg-white p-6 shadow-sm md:grid-cols-[1fr_auto] md:items-center">

      <div>
        <p className="text-sm font-semibold text-green-700">
          Your form is live!
        </p>

        <h2 className="mt-2 text-xl font-bold text-[#30251F]">
          Share Your Form
        </h2>

        <p className="mt-2 text-sm text-[#82766D]">
          Share this link or let respondents scan your QR code.
        </p>

        <p className="mt-4 break-all rounded-lg bg-[#F8F6F0] p-3 text-sm text-[#594333]">
          {shareOrigin
            ? `${shareOrigin}/forms/${form.slug}`
            : `/forms/${form.slug}`}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="rounded-lg border border-[#DED6C1] px-4 py-2.5 text-sm font-semibold text-[#302E29] transition hover:bg-cream"
          >
            {isLinkCopied ? "Copied!" : "Copy Link"}
          </button>

          <button
            type="button"
            onClick={handleDownloadQrCode}
            disabled={!shareOrigin}
            className="rounded-lg bg-[#A47755] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#896342] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download QR Code
          </button>
        </div>

        {copyError && (
          <p className="mt-2 text-xs text-red-600">
            {copyError}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center rounded-xl bg-[#F8F6F0] p-5">
        <p className="mb-3 text-sm font-semibold text-[#594333]">
          Scan to Open Form
        </p>

        {shareOrigin ? (
          <div id="form-qr-code" className="rounded-lg bg-white p-3">
            <QRCodeCanvas
              value={`${shareOrigin}/forms/${form.slug}`}
              size={180}
              level="H"
              includeMargin
            />
          </div>
        ) : (
          <div className="flex h-[204px] w-[204px] items-center justify-center text-sm text-[#82766D]">
            Generating QR...
          </div>
        )}

        <p className="mt-3 text-xs text-[#82766D]">
          Scan using your phone camera
        </p>
      </div>

    </div>
  </div>
)}

      {(publishMutation.isError ||
        unpublishMutation.isError ||
        visibilityMutation.isError ||
  deleteFormMutation.isError ) && (
        <p className="px-6 pt-3 text-sm text-red-600 sm:px-10">
          {publishMutation.error?.message ||
            unpublishMutation.error?.message ||
            visibilityMutation.error?.message ||
            deleteFormMutation.error?.message}
        </p>
      )}

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
        <div className="mb-8">
  <FormThemeSettings
    theme={theme}
    onChange={setTheme}
    onSave={saveTheme}
    isSaving={updateThemeMutation.isPending}
  />

  {updateThemeMutation.isError && (
    <p className="mt-2 text-sm text-red-600">
      {updateThemeMutation.error.message}
    </p>
  )}

  {updateThemeMutation.isSuccess && (
    <p className="mt-2 text-sm text-green-600">
      Theme saved successfully!
    </p>
  )}
</div>
        {/* Form expiry and response limits */}
<div className="mb-8">
  <FormLimitsSettings
    formId={formId}
    title={form.title}
    description={form.description}
    expiresAt={form.expiresAt}
    responseLimit={form.responseLimit}
  />
</div>
        <div className="mb-8">
          <h2 className="text-lg font-semibold">Form Structure</h2>
          <p className="mt-1 text-sm text-muted">
            Organize your questions into pages. Respondents will navigate one
            page at a time.
          </p>
        </div>

        {/* Page navigation and management */}
        <section className="mb-8 rounded-2xl border border-[#DED6C1] bg-[#FAF9F6] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Form Pages</h3>
              <p className="mt-1 text-xs text-muted">
                {pageList.length} {pageList.length === 1 ? "page" : "pages"} in
                this form
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                createPageMutation.mutate({
                  formId,
                  title:
                    newPageTitle.trim() ||
                    `Page ${pageList.length + 1}`,
                })
              }
              disabled={createPageMutation.isPending}
              className="rounded-lg bg-[#302E29] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#514D45] disabled:opacity-50"
            >
              {createPageMutation.isPending ? "Creating..." : "+ Add Page"}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              maxLength={200}
              placeholder={`New page title (default: Page ${pageList.length + 1})`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
            />
            <span className="self-center text-xs text-muted">
              Optional custom title
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {pageList.map((page) => (
              <button
                type="button"
                key={page.id}
                onClick={() => setSelectedPageNumber(page.pageNumber)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                  selectedPageNumber === page.pageNumber
                    ? "border-[#8A7652] bg-[#DED6C1] text-[#302E29]"
                    : "border-border bg-white text-muted hover:border-[#B7B09E]"
                }`}
              >
                {page.pageNumber}. {page.title}
                <span className="ml-2 text-xs opacity-70">
                  (
                  {
                    questionList.filter(
                      (question) => question.pageNumber === page.pageNumber
                    ).length
                  }
                  )
                </span>
              </button>
            ))}
          </div>

          {currentPage && (
            <div className="mt-5 border-t border-[#DED6C1] pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Page settings</h4>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageDragEnd(-1)}
                    disabled={
                      selectedPageNumber === pageList[0]?.pageNumber ||
                      reorderPagesMutation.isPending
                    }
                    title="Move page left"
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePageDragEnd(1)}
                    disabled={
                      selectedPageNumber ===
                        pageList[pageList.length - 1]?.pageNumber ||
                      reorderPagesMutation.isPending
                    }
                    title="Move page right"
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    →
                  </button>

                  <button
                    type="button"
                    onClick={handleDeletePage}
                    disabled={
                      pageList.length <= 1 || deletePageMutation.isPending
                    }
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40"
                  >
                    {deletePageMutation.isPending ? "Deleting..." : "Delete Page"}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  value={editingPageTitle}
                  onChange={(e) => setEditingPageTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Page title"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                />

                <textarea
                  value={editingPageDescription}
                  onChange={(e) => setEditingPageDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Page description (optional)"
                  className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                />

                <button
                  type="button"
                  onClick={handleSavePageDetails}
                  disabled={
                    updatePageMutation.isPending ||
                    !editingPageTitle.trim() ||
                    (editingPageTitle === currentPage.title &&
                      editingPageDescription ===
                        (currentPage.description ?? ""))
                  }
                  className="rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold transition hover:bg-cream disabled:opacity-40"
                >
                  {updatePageMutation.isPending ? "Saving..." : "Save Page Details"}
                </button>
              </div>
            </div>
          )}

          {(createPageMutation.isError ||
            updatePageMutation.isError ||
            deletePageMutation.isError ||
            reorderPagesMutation.isError) && (
            <p className="mt-3 text-sm text-red-600">
              {createPageMutation.error?.message ||
                updatePageMutation.error?.message ||
                deletePageMutation.error?.message ||
                reorderPagesMutation.error?.message}
            </p>
          )}
        </section>

        {/* Questions for selected page */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {currentPage?.title ?? "Questions"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Add and organize questions on this page.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-[#CFC6B1] px-4 py-2.5 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E]"
          >
            + Add Question
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            {currentPageQuestions.length} Questions on this page
          </span>
          {currentPageQuestions.length > 1 && (
            <span className="text-xs text-muted">Drag to reorder</span>
          )}
        </div>

        {currentPageQuestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CFC6B1] px-6 py-16 text-center">
            <div className="text-4xl text-[#B7B09E]">+</div>
            <h3 className="mt-4 font-semibold">This page is empty</h3>
            <p className="mt-2 text-sm text-muted">
              Add a question to get started on this page.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#B7B09E]"
            >
              Add Question
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleQuestionDragEnd}
          >
            <SortableContext
              items={currentPageQuestions.map((question) => question.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {currentPageQuestions.map((question, index) => {
                  const config = getConfig(question.config);
                  const sourceQuestion = questionList.find(
                    (item) => item.id === config.logic?.questionId
                  );

                  const logicDescription = config.logic
                    ? `${config.logic.action === "show" ? "Show" : "Hide"} when "${sourceQuestion?.title ?? "Previous question"}" ${config.logic.operator === "equals" ? "equals" : config.logic.operator === "notEquals" ? "does not equal" : "contains"} "${config.logic.value}"`
                    : undefined;

                  return (
                    <SortableQuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      pages={pageList.map((page) => ({
                        id: page.id,
                        pageNumber: page.pageNumber,
                        title: page.title,
                      }))}
                      onEdit={() => openEditModal(question)}
                      onDelete={() => handleDelete(question.id)}
                      onMove={(pageNumber) =>
                        moveQuestionMutation.mutate({
                          formId,
                          questionId: question.id,
                          pageNumber,
                        })
                      }
                      isDeleting={deleteQuestionMutation.isPending}
                      isMoving={moveQuestionMutation.isPending}
                      logicDescription={logicDescription}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {(deleteQuestionMutation.isError ||
          reorderQuestionsMutation.isError ||
          moveQuestionMutation.isError) && (
          <p className="mt-4 text-sm text-red-600">
            {deleteQuestionMutation.error?.message ||
              reorderQuestionsMutation.error?.message ||
              moveQuestionMutation.error?.message}
          </p>
        )}

        {(reorderQuestionsMutation.isPending ||
          moveQuestionMutation.isPending) && (
          <p className="mt-4 text-sm text-muted">Saving changes...</p>
        )}

        <div className="mt-8 border-t border-border pt-5">
          <p className="text-xs text-muted">
            Form total: {questionList.length} questions across {pageList.length}{" "}
            pages.
          </p>
        </div>
      </main>

      {/* Question create/edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-[2px]">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingQuestionId ? "Edit question" : "Add a question"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  This question belongs to {currentPage?.title ?? "this page"}.
                </p>
              </div>

              <button
                type="button"
                onClick={resetFields}
                className="text-2xl text-muted transition hover:text-foreground"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. What is your name?"
                  maxLength={200}
                  required
                  className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a short description (optional)"
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question type
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    handleTypeChange(e.target.value as QuestionType)
                  }
                  className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm outline-none focus:border-[#B7B09E]"
                >
                  {questionTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {(type === "select" || type === "checkbox") && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium">Options</label>
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[index] = e.target.value;
                          setOptions(updated);
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="min-w-0 flex-1 rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                      />
                      <button
                        type="button"
                        disabled={options.length <= 2}
                        onClick={() =>
                          setOptions(options.filter((_, i) => i !== index))
                        }
                        className="rounded-lg border border-border px-3 text-sm text-muted hover:bg-cream disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={options.length >= 50}
                    onClick={() =>
                      setOptions([...options, `Option ${options.length + 1}`])
                    }
                    className="text-sm font-medium text-muted hover:text-foreground disabled:opacity-40"
                  >
                    + Add option
                  </button>
                </div>
              )}

              {(type === "number" || type === "rating") && (
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {type === "rating" ? "Rating range" : "Number range"}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        Minimum
                      </label>
                      <input
                        type="number"
                        value={min}
                        onChange={(e) => setMin(e.target.value)}
                        required
                        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        Maximum
                      </label>
                      <input
                        type="number"
                        value={max}
                        onChange={(e) => setMax(e.target.value)}
                        required
                        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                      />
                    </div>
                  </div>
                  {min !== "" && max !== "" && Number(min) > Number(max) && (
                    <p className="mt-2 text-xs text-red-600">
                      Minimum cannot exceed maximum.
                    </p>
                  )}
                </div>
              )}

              {/* Conditional logic */}
              <div className="rounded-xl border border-[#DED6C1] bg-[#FAF9F6] p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="enable-logic"
                    type="checkbox"
                    checked={logicEnabled}
                    onChange={(e) => setLogicEnabled(e.target.checked)}
                    disabled={availableLogicQuestions.length === 0}
                    className="mt-1 size-4 accent-[#8A7652]"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="enable-logic"
                      className="cursor-pointer text-sm font-semibold"
                    >
                      Enable Conditional Logic
                    </label>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Control when this question appears based on an earlier
                      answer.
                    </p>
                  </div>
                </div>

                {availableLogicQuestions.length === 0 && (
                  <p className="mt-3 text-xs text-muted">
                    Add an earlier question before configuring conditional
                    logic.
                  </p>
                )}

                {logicEnabled && availableLogicQuestions.length > 0 && (
                  <div className="mt-5 space-y-4 border-t border-[#DED6C1] pt-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-muted">
                        ACTION
                      </label>
                      <select
                        value={logicAction}
                        onChange={(e) =>
                          setLogicAction(e.target.value as "show" | "hide")
                        }
                        className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="show">Show this question</option>
                        <option value="hide">Hide this question</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-muted">
                        WHEN THIS QUESTION
                      </label>
                      <select
                        value={logicQuestionId}
                        onChange={(e) =>
                          handleLogicQuestionChange(e.target.value)
                        }
                        required={logicEnabled}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">Choose a previous question</option>
                        {availableLogicQuestions.map((question) => (
                          <option key={question.id} value={question.id}>
                            {question.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedLogicQuestion && (
                      <>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-muted">
                            CONDITION
                          </label>
                          <select
                            value={logicOperator}
                            onChange={(e) =>
                              setLogicOperator(e.target.value as LogicOperator)
                            }
                            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                          >
                            {logicOperators.map((operator) => (
                              <option key={operator.value} value={operator.value}>
                                {operator.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-muted">
                            ANSWER VALUE
                          </label>
                          {(selectedLogicQuestionType === "select" ||
                            selectedLogicQuestionType === "checkbox") &&
                          getConfig(selectedLogicQuestion.config).options
                            ?.length ? (
                            <select
                              value={logicValue}
                              onChange={(e) => setLogicValue(e.target.value)}
                              required={logicEnabled}
                              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                            >
                              <option value="">Choose an answer</option>
                              {getConfig(selectedLogicQuestion.config).options?.map(
                                (option, index) => (
                                  <option key={index} value={option}>
                                    {option}
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <input
                              type={
                                selectedLogicQuestionType === "number" ||
                                selectedLogicQuestionType === "rating"
                                  ? "number"
                                  : selectedLogicQuestionType === "date"
                                    ? "date"
                                    : "text"
                              }
                              value={logicValue}
                              onChange={(e) => setLogicValue(e.target.value)}
                              placeholder="Enter the answer to match"
                              required={logicEnabled}
                              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                            />
                          )}
                        </div>
                      </>
                    )}

                    <p className="rounded-lg bg-white p-3 text-xs leading-relaxed text-muted">
                      This question will{" "}
                      <strong>
                        {logicAction === "show" ? "appear" : "be hidden"}
                      </strong>{" "}
                      when the selected previous question matches your
                      condition.
                    </p>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="size-4 accent-[#B7B09E]"
                />
                Make this question required
              </label>

              {mutationError && (
                <p className="text-sm text-red-600">{mutationError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetFields}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    !title.trim() ||
                    hasInvalidOptions ||
                    hasInvalidRange ||
                    hasInvalidLogic
                  }
                  className="rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving
                    ? "Saving..."
                    : editingQuestionId
                      ? "Update Question"
                      : "Add Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-page interactive preview */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 px-3 py-6 backdrop-blur-[2px] sm:px-6">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-[#FAF9F6] shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4 sm:px-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  FormFlow Preview
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  Respondent view
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                aria-label="Close preview"
                className="flex size-9 items-center justify-center rounded-lg text-xl text-muted transition hover:bg-cream hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-8 sm:px-10 sm:py-10">
              <div className="mb-8 border-b border-border pb-6">
                <h1 className="text-2xl font-semibold">{form.title}</h1>
                {form.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {form.description}
                  </p>
                )}
              </div>

              {questionList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CFC6B1] p-8 text-center">
                  <p className="font-medium">Your form has no questions yet.</p>
                  <p className="mt-2 text-sm text-muted">
                    Add questions to see them in the preview.
                  </p>
                </div>
              ) : visiblePreviewQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CFC6B1] p-8 text-center">
                  <p className="text-sm text-muted">
                    No questions are currently visible.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>
                        Page {previewPageIndex + 1} of {visiblePreviewPages.length}
                      </span>
                      <span>
                        {currentPreviewPageQuestions.length} questions
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#DED6C1]">
                      <div
                        className="h-full rounded-full bg-[#8A7652] transition-all"
                        style={{
                          width:  `${previewProgress}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold">
                      {pageList.find(
                        (page) => page.pageNumber === previewPageNumber
                      )?.title ?? "Page"}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {
                        pageList.find(
                          (page) => page.pageNumber === previewPageNumber
                        )?.description
                      }
                    </p>
                  </div>

                  {currentPreviewPageQuestions.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#CFC6B1] p-5 text-sm text-muted">
                      No questions are visible on this page.
                    </p>
                  ) : (
                    <div className="space-y-8">
                      {currentPreviewPageQuestions.map((question, index) => (
                        <QuestionPreview
                          key={question.id}
                          question={question}
                          index={index}
                          answer={previewAnswers[question.id]}
                          onChange={(value) =>
                            setPreviewAnswers((current) => ({
                              ...current,
                              [question.id]: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
                    <button
                      type="button"
                      disabled={previewPageIndex <= 0}
                      onClick={() => {
  const previous = visiblePreviewPages[previewPageIndex - 1];

  if (previous) {
    setPreviewPageNumber(previous.pageNumber);
  }
}}
                      className="rounded-lg border border-border px-5 py-3 text-sm font-semibold disabled:opacity-40"
                    >
                      ← Previous
                    </button>

                    <button
                      type="button"
                      disabled={
  previewPageIndex === visiblePreviewPages.length - 1
}
                      onClick={() => {
  const next = visiblePreviewPages[previewPageIndex + 1];

  if (next) {
    setPreviewPageNumber(next.pageNumber);
  }
}}
                      className="rounded-lg bg-[#CFC6B1] px-6 py-3 text-sm font-semibold text-[#302E29] disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}

              <p className="mt-6 text-center text-xs text-muted">
                Interactive preview only. Responses cannot be submitted or
                saved.
              </p>
            </div>

            <div className="flex justify-end border-t border-border bg-white px-5 py-4 sm:px-8">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-cream"
              >
                Back to editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
