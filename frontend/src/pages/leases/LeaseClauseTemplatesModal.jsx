import {
    FileText,
    PencilLine,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    X
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import {
    Button,
    IconButton
} from "../../components/ui/Button";

const CLAUSE_CATEGORIES = [
    "pets",
    "subletting",
    "utilities",
    "maintenance",
    "occupancy",
    "property_use",
    "alterations",
    "notice",
    "termination",
    "deposit",
    "access_inspection",
    "smoking",
    "noise",
    "parking",
    "insurance_liability",
    "custom"
];

const templateEmptyForm = () => ({
    name: "",
    description: "",
    status: "active"
});

const itemEmptyForm = () => ({
    clause_category: "custom",
    title: "",
    clause_text: "",
    is_mandatory: true,
    display_order: "1"
});

const humanize = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to manage lease clause templates.";

const inputClass = `
    h-11 w-full rounded-xl
    border border-slate-200
    bg-slate-50 px-3.5
    text-sm text-slate-800
    outline-none transition
    focus:border-blue-500
    focus:bg-white
    focus:ring-4
    focus:ring-blue-100
    disabled:cursor-not-allowed
    disabled:opacity-60
`;

function FieldLabel({
    htmlFor,
    required = false,
    children
}) {
    return (
        <label
            htmlFor={htmlFor}
            className="mb-2 block text-sm font-semibold text-slate-700"
        >
            {children}
            {required && (
                <span className="text-rose-500">
                    {" "}*
                </span>
            )}
        </label>
    );
}

function LeaseClauseTemplatesModal({
    open,
    onClose
}) {
    const [owners, setOwners] =
        useState([]);
    const [ownerPublicId, setOwnerPublicId] =
        useState("");
    const [templates, setTemplates] =
        useState([]);
    const [selectedTemplateId, setSelectedTemplateId] =
        useState("");
    const [selectedTemplate, setSelectedTemplate] =
        useState(null);

    const [templateForm, setTemplateForm] =
        useState(templateEmptyForm);
    const [editingTemplate, setEditingTemplate] =
        useState(null);

    const [itemForm, setItemForm] =
        useState(itemEmptyForm);
    const [editingItem, setEditingItem] =
        useState(null);

    const [ownersLoading, setOwnersLoading] =
        useState(false);
    const [templatesLoading, setTemplatesLoading] =
        useState(false);
    const [detailLoading, setDetailLoading] =
        useState(false);
    const [templateSubmitting, setTemplateSubmitting] =
        useState(false);
    const [itemSubmitting, setItemSubmitting] =
        useState(false);
    const [deletingTemplateId, setDeletingTemplateId] =
        useState("");
    const [deletingItemId, setDeletingItemId] =
        useState("");

    const [error, setError] =
        useState("");
    const [success, setSuccess] =
        useState("");

    const selectedOwner =
        useMemo(
            () =>
                owners.find(
                    owner =>
                        owner.public_id ===
                        ownerPublicId
                ) || null,
            [
                owners,
                ownerPublicId
            ]
        );

    const nextItemOrder =
        useMemo(() => {
            const items =
                selectedTemplate?.items;

            if (
                !Array.isArray(items) ||
                items.length === 0
            ) {
                return 1;
            }

            return Math.max(
                ...items.map(
                    item =>
                        Number(
                            item.display_order
                        ) || 0
                )
            ) + 1;
        }, [selectedTemplate]);

    const resetTemplateEditor = () => {
        setEditingTemplate(null);
        setTemplateForm(
            templateEmptyForm()
        );
    };

    const resetItemEditor = () => {
        setEditingItem(null);
        setItemForm({
            ...itemEmptyForm(),
            display_order:
                String(nextItemOrder)
        });
    };

    const loadOwners = async () => {
        try {
            setOwnersLoading(true);
            setError("");

            const response =
                await apiClient.get(
                    "/owners",
                    {
                        params: {
                            page: 1,
                            limit: 100,
                            status: "active"
                        }
                    }
                );

            const rows =
                Array.isArray(
                    response?.data?.data
                )
                    ? response.data.data
                    : [];

            const activeOwners =
                rows.filter(
                    owner =>
                        owner.status ===
                        "active"
                );

            setOwners(activeOwners);

            if (
                activeOwners.length === 1
            ) {
                setOwnerPublicId(
                    activeOwners[0]
                        .public_id
                );
            }
        } catch (requestError) {
            setOwners([]);
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setOwnersLoading(false);
        }
    };

    const loadTemplates = async (
        requestedOwnerPublicId =
            ownerPublicId
    ) => {
        if (!requestedOwnerPublicId) {
            setTemplates([]);
            setSelectedTemplateId("");
            setSelectedTemplate(null);
            return;
        }

        try {
            setTemplatesLoading(true);
            setError("");

            const response =
                await apiClient.get(
                    "/lease-clause-templates",
                    {
                        params: {
                            owner_public_id:
                                requestedOwnerPublicId
                        }
                    }
                );

            const rows =
                response?.data?.data
                    ?.templates;

            setTemplates(
                Array.isArray(rows)
                    ? rows
                    : []
            );

            const stillExists =
                Array.isArray(rows) &&
                rows.some(
                    template =>
                        template.public_id ===
                        selectedTemplateId
                );

            if (!stillExists) {
                setSelectedTemplateId("");
                setSelectedTemplate(null);
                resetItemEditor();
            }
        } catch (requestError) {
            setTemplates([]);
            setSelectedTemplateId("");
            setSelectedTemplate(null);
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setTemplatesLoading(false);
        }
    };

    const loadTemplateDetail = async (
        templatePublicId
    ) => {
        if (!templatePublicId) {
            setSelectedTemplate(null);
            return;
        }

        try {
            setDetailLoading(true);
            setError("");

            const response =
                await apiClient.get(
                    `/lease-clause-templates/${templatePublicId}`
                );

            setSelectedTemplate(
                response?.data?.data
                    ?.template || null
            );
        } catch (requestError) {
            setSelectedTemplate(null);
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        setError("");
        setSuccess("");
        setTemplates([]);
        setSelectedTemplateId("");
        setSelectedTemplate(null);
        resetTemplateEditor();
        setItemForm(itemEmptyForm());
        setEditingItem(null);
        setOwnerPublicId("");
        loadOwners();
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        setError("");
        setSuccess("");
        setSelectedTemplateId("");
        setSelectedTemplate(null);
        resetTemplateEditor();
        setItemForm(itemEmptyForm());
        setEditingItem(null);

        if (ownerPublicId) {
            loadTemplates(
                ownerPublicId
            );
        } else {
            setTemplates([]);
        }
    }, [
        ownerPublicId,
        open
    ]);

    useEffect(() => {
        if (
            !editingItem &&
            selectedTemplate
        ) {
            setItemForm(current => ({
                ...current,
                display_order:
                    String(
                        nextItemOrder
                    )
            }));
        }
    }, [
        nextItemOrder,
        editingItem,
        selectedTemplate
    ]);

    if (!open) {
        return null;
    }

    const startTemplateEdit =
        template => {
            setEditingTemplate(
                template
            );
            setTemplateForm({
                name:
                    template.name || "",
                description:
                    template.description || "",
                status:
                    template.status ||
                    "active"
            });
            setError("");
            setSuccess("");
        };

    const submitTemplate =
        async event => {
            event.preventDefault();

            if (!ownerPublicId) {
                setError(
                    "Select an owner first."
                );
                return;
            }

            const name =
                templateForm.name.trim();
            const description =
                templateForm
                    .description
                    .trim();

            if (!name) {
                setError(
                    "Template name is required."
                );
                return;
            }

            const payload = {
                name,
                status:
                    templateForm.status
            };

            if (description) {
                payload.description =
                    description;
            } else if (
                editingTemplate
            ) {
                payload.description =
                    null;
            }

            try {
                setTemplateSubmitting(true);
                setError("");
                setSuccess("");

                if (editingTemplate) {
                    await apiClient.patch(
                        `/lease-clause-templates/${editingTemplate.public_id}`,
                        payload
                    );

                    setSuccess(
                        "Template updated successfully."
                    );
                } else {
                    await apiClient.post(
                        "/lease-clause-templates",
                        {
                            owner_public_id:
                                ownerPublicId,
                            ...payload
                        }
                    );

                    setSuccess(
                        "Template created successfully."
                    );
                }

                resetTemplateEditor();
                await loadTemplates(
                    ownerPublicId
                );
            } catch (requestError) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setTemplateSubmitting(false);
            }
        };

    const removeTemplate =
        async template => {
            const confirmed =
                window.confirm(
                    `Remove template "${template.name}"? This performs a soft delete and preserves its audit history.`
                );

            if (!confirmed) {
                return;
            }

            try {
                setDeletingTemplateId(
                    template.public_id
                );
                setError("");
                setSuccess("");

                await apiClient.delete(
                    `/lease-clause-templates/${template.public_id}`
                );

                if (
                    selectedTemplateId ===
                        template.public_id
                ) {
                    setSelectedTemplateId("");
                    setSelectedTemplate(null);
                }

                if (
                    editingTemplate?.public_id ===
                        template.public_id
                ) {
                    resetTemplateEditor();
                }

                setSuccess(
                    "Template removed successfully."
                );

                await loadTemplates(
                    ownerPublicId
                );
            } catch (requestError) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setDeletingTemplateId("");
            }
        };

    const selectTemplate =
        async template => {
            setSelectedTemplateId(
                template.public_id
            );
            setEditingItem(null);
            setItemForm(
                itemEmptyForm()
            );
            setSuccess("");
            await loadTemplateDetail(
                template.public_id
            );
        };

    const startItemEdit = item => {
        setEditingItem(item);
        setItemForm({
            clause_category:
                item.clause_category,
            title:
                item.title || "",
            clause_text:
                item.clause_text || "",
            is_mandatory:
                item.is_mandatory ===
                true,
            display_order:
                String(
                    item.display_order ??
                    1
                )
        });
        setError("");
        setSuccess("");
    };

    const submitItem =
        async event => {
            event.preventDefault();

            if (
                !selectedTemplateId
            ) {
                setError(
                    "Select a template first."
                );
                return;
            }

            const title =
                itemForm.title.trim();
            const clauseText =
                itemForm
                    .clause_text
                    .trim();
            const displayOrder =
                Number(
                    itemForm
                        .display_order
                );

            if (!title) {
                setError(
                    "Clause title is required."
                );
                return;
            }

            if (!clauseText) {
                setError(
                    "Clause text is required."
                );
                return;
            }

            if (
                !Number.isInteger(
                    displayOrder
                ) ||
                displayOrder < 1 ||
                displayOrder > 10000
            ) {
                setError(
                    "Display order must be between 1 and 10000."
                );
                return;
            }

            const payload = {
                clause_category:
                    itemForm
                        .clause_category,
                title,
                clause_text:
                    clauseText,
                is_mandatory:
                    itemForm
                        .is_mandatory,
                display_order:
                    displayOrder
            };

            try {
                setItemSubmitting(true);
                setError("");
                setSuccess("");

                if (editingItem) {
                    await apiClient.patch(
                        `/lease-clause-templates/${selectedTemplateId}/items/${editingItem.public_id}`,
                        payload
                    );

                    setSuccess(
                        "Template clause updated successfully."
                    );
                } else {
                    await apiClient.post(
                        `/lease-clause-templates/${selectedTemplateId}/items`,
                        payload
                    );

                    setSuccess(
                        "Template clause added successfully."
                    );
                }

                setEditingItem(null);
                setItemForm(
                    itemEmptyForm()
                );

                await Promise.all([
                    loadTemplateDetail(
                        selectedTemplateId
                    ),
                    loadTemplates(
                        ownerPublicId
                    )
                ]);
            } catch (requestError) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setItemSubmitting(false);
            }
        };

    const removeItem =
        async item => {
            if (!selectedTemplateId) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Remove template clause "${item.title}"? This performs a soft delete.`
                );

            if (!confirmed) {
                return;
            }

            try {
                setDeletingItemId(
                    item.public_id
                );
                setError("");
                setSuccess("");

                await apiClient.delete(
                    `/lease-clause-templates/${selectedTemplateId}/items/${item.public_id}`
                );

                if (
                    editingItem?.public_id ===
                        item.public_id
                ) {
                    setEditingItem(null);
                    setItemForm(
                        itemEmptyForm()
                    );
                }

                setSuccess(
                    "Template clause removed successfully."
                );

                await Promise.all([
                    loadTemplateDetail(
                        selectedTemplateId
                    ),
                    loadTemplates(
                        ownerPublicId
                    )
                ]);
            } catch (requestError) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setDeletingItemId("");
            }
        };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lease-clause-templates-title"
        >
            <div className="max-h-[95vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
                <div className="sticky top-0 z-30 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                            <FileText className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="lease-clause-templates-title"
                                className="text-xl font-bold text-slate-950"
                            >
                                Owner Clause Templates
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Maintain reusable contractual terms that can be copied into Draft leases.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close clause templates"
                        icon={X}
                        onClick={onClose}
                        disabled={
                            templateSubmitting ||
                            itemSubmitting ||
                            Boolean(
                                deletingTemplateId
                            ) ||
                            Boolean(
                                deletingItemId
                            )
                        }
                    />
                </div>

                <div className="space-y-6 p-6">
                    <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm text-violet-800">
                        Templates are reusable owner definitions. Applying one to a Draft lease creates an independent clause snapshot; later template edits do not change existing lease terms.
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        >
                            {error}
                        </div>
                    )}

                    {success && (
                        <div
                            role="status"
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                        >
                            {success}
                        </div>
                    )}

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <div>
                                <FieldLabel
                                    htmlFor="lease_template_owner"
                                    required
                                >
                                    Owner
                                </FieldLabel>

                                <select
                                    id="lease_template_owner"
                                    value={
                                        ownerPublicId
                                    }
                                    onChange={event =>
                                        setOwnerPublicId(
                                            event.target.value
                                        )
                                    }
                                    disabled={
                                        ownersLoading ||
                                        templateSubmitting ||
                                        itemSubmitting
                                    }
                                    className={inputClass}
                                >
                                    <option value="">
                                        {ownersLoading
                                            ? "Loading owners..."
                                            : "Select owner"}
                                    </option>

                                    {owners.map(
                                        owner => (
                                            <option
                                                key={
                                                    owner.public_id
                                                }
                                                value={
                                                    owner.public_id
                                                }
                                            >
                                                {owner.display_name ||
                                                    owner.legal_name ||
                                                    owner.public_id}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RefreshCw}
                                onClick={() =>
                                    loadTemplates(
                                        ownerPublicId
                                    )
                                }
                                disabled={
                                    !ownerPublicId ||
                                    templatesLoading
                                }
                            >
                                Refresh Templates
                            </Button>
                        </div>

                        {selectedOwner && (
                            <p className="mt-3 text-xs text-slate-500">
                                Managing templates for{" "}
                                <strong>
                                    {selectedOwner.display_name ||
                                        selectedOwner.legal_name ||
                                        selectedOwner.public_id}
                                </strong>
                            </p>
                        )}
                    </section>

                    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
                        <div className="space-y-6">
                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-slate-950">
                                            Templates
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {templates.length}{" "}
                                            available
                                        </p>
                                    </div>
                                </div>

                                {!ownerPublicId ? (
                                    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                        Select an owner to load templates.
                                    </div>
                                ) : templatesLoading ? (
                                    <div className="mt-5 flex min-h-[120px] items-center justify-center gap-2 text-sm text-slate-500">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Loading templates...
                                    </div>
                                ) : templates.length === 0 ? (
                                    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                                        <FileText className="mx-auto h-7 w-7 text-slate-300" />
                                        <p className="mt-2 font-semibold text-slate-700">
                                            No templates yet
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Create the first reusable lease terms template below.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-5 space-y-3">
                                        {templates.map(
                                            template => {
                                                const selected =
                                                    selectedTemplateId ===
                                                    template.public_id;

                                                return (
                                                    <div
                                                        key={
                                                            template.public_id
                                                        }
                                                        className={`rounded-2xl border p-4 transition ${
                                                            selected
                                                                ? "border-blue-300 bg-blue-50/60"
                                                                : "border-slate-200 bg-slate-50/60"
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                selectTemplate(
                                                                    template
                                                                )
                                                            }
                                                            className="w-full text-left"
                                                        >
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-semibold text-slate-900">
                                                                    {template.name}
                                                                </span>

                                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                                                                    template.status ===
                                                                    "active"
                                                                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                                                        : "bg-slate-100 text-slate-600 ring-slate-200"
                                                                }`}>
                                                                    {humanize(
                                                                        template.status
                                                                    )}
                                                                </span>
                                                            </div>

                                                            <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                                                                {template.description ||
                                                                    "No description"}
                                                            </p>

                                                            <p className="mt-2 text-xs font-medium text-slate-500">
                                                                {template.item_count ||
                                                                    0}{" "}
                                                                clause
                                                                {Number(
                                                                    template.item_count
                                                                ) === 1
                                                                    ? ""
                                                                    : "s"}
                                                            </p>
                                                        </button>

                                                        <div className="mt-3 flex justify-end gap-2 border-t border-slate-200/70 pt-3">
                                                            <IconButton
                                                                label={`Edit ${template.name}`}
                                                                icon={PencilLine}
                                                                onClick={() =>
                                                                    startTemplateEdit(
                                                                        template
                                                                    )
                                                                }
                                                                disabled={
                                                                    Boolean(
                                                                        deletingTemplateId
                                                                    )
                                                                }
                                                            />

                                                            <IconButton
                                                                label={`Delete ${template.name}`}
                                                                icon={Trash2}
                                                                onClick={() =>
                                                                    removeTemplate(
                                                                        template
                                                                    )
                                                                }
                                                                loading={
                                                                    deletingTemplateId ===
                                                                    template.public_id
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                )}
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-slate-950">
                                            {editingTemplate
                                                ? "Edit Template"
                                                : "Create Template"}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Define the reusable template metadata.
                                        </p>
                                    </div>

                                    {editingTemplate && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={
                                                resetTemplateEditor
                                            }
                                            disabled={
                                                templateSubmitting
                                            }
                                        >
                                            Cancel Edit
                                        </Button>
                                    )}
                                </div>

                                <form
                                    onSubmit={
                                        submitTemplate
                                    }
                                    className="mt-5 space-y-4"
                                >
                                    <div>
                                        <FieldLabel
                                            htmlFor="lease_template_name"
                                            required
                                        >
                                            Template Name
                                        </FieldLabel>

                                        <input
                                            id="lease_template_name"
                                            required
                                            maxLength={200}
                                            value={
                                                templateForm.name
                                            }
                                            onChange={event =>
                                                setTemplateForm(
                                                    current => ({
                                                        ...current,
                                                        name:
                                                            event.target.value
                                                    })
                                                )
                                            }
                                            disabled={
                                                !ownerPublicId ||
                                                templateSubmitting
                                            }
                                            placeholder="e.g. Standard Residential Lease Terms"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <FieldLabel
                                            htmlFor="lease_template_status"
                                            required
                                        >
                                            Status
                                        </FieldLabel>

                                        <select
                                            id="lease_template_status"
                                            value={
                                                templateForm.status
                                            }
                                            onChange={event =>
                                                setTemplateForm(
                                                    current => ({
                                                        ...current,
                                                        status:
                                                            event.target.value
                                                    })
                                                )
                                            }
                                            disabled={
                                                !ownerPublicId ||
                                                templateSubmitting
                                            }
                                            className={inputClass}
                                        >
                                            <option value="active">
                                                Active
                                            </option>
                                            <option value="inactive">
                                                Inactive
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <FieldLabel
                                            htmlFor="lease_template_description"
                                        >
                                            Description
                                        </FieldLabel>

                                        <textarea
                                            id="lease_template_description"
                                            rows={4}
                                            maxLength={2000}
                                            value={
                                                templateForm.description
                                            }
                                            onChange={event =>
                                                setTemplateForm(
                                                    current => ({
                                                        ...current,
                                                        description:
                                                            event.target.value
                                                    })
                                                )
                                            }
                                            disabled={
                                                !ownerPublicId ||
                                                templateSubmitting
                                            }
                                            placeholder="Describe when this template should be used..."
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={
                                                resetTemplateEditor
                                            }
                                            disabled={
                                                templateSubmitting
                                            }
                                        >
                                            Clear
                                        </Button>

                                        <Button
                                            type="submit"
                                            leftIcon={
                                                editingTemplate
                                                    ? Save
                                                    : Plus
                                            }
                                            loading={
                                                templateSubmitting
                                            }
                                            disabled={
                                                !ownerPublicId
                                            }
                                        >
                                            {editingTemplate
                                                ? "Save Template"
                                                : "Create Template"}
                                        </Button>
                                    </div>
                                </form>
                            </section>
                        </div>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            {!selectedTemplateId ? (
                                <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                                    <div>
                                        <FileText className="mx-auto h-9 w-9 text-slate-300" />
                                        <p className="mt-3 font-semibold text-slate-700">
                                            Select a template
                                        </p>
                                        <p className="mt-1 max-w-sm text-sm text-slate-500">
                                            Choose a template from the left to manage its ordered contractual clauses.
                                        </p>
                                    </div>
                                </div>
                            ) : detailLoading ? (
                                <div className="flex min-h-[500px] items-center justify-center gap-2 text-sm text-slate-500">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Loading template clauses...
                                </div>
                            ) : selectedTemplate ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-950">
                                                {selectedTemplate.name}
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {selectedTemplate.description ||
                                                    "No description"}
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            leftIcon={RefreshCw}
                                            onClick={() =>
                                                loadTemplateDetail(
                                                    selectedTemplateId
                                                )
                                            }
                                            disabled={
                                                detailLoading
                                            }
                                        >
                                            Refresh
                                        </Button>
                                    </div>

                                    <div>
                                        <div className="flex items-end justify-between gap-3">
                                            <div>
                                                <h4 className="font-bold text-slate-900">
                                                    Template Clauses
                                                </h4>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {selectedTemplate.items?.length ||
                                                        0}{" "}
                                                    active clause
                                                    {(selectedTemplate.items?.length ||
                                                        0) === 1
                                                        ? ""
                                                        : "s"}
                                                </p>
                                            </div>
                                        </div>

                                        {!selectedTemplate.items?.length ? (
                                            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                                                No clauses yet. Add the first reusable clause below.
                                            </div>
                                        ) : (
                                            <div className="mt-4 space-y-3">
                                                {selectedTemplate.items.map(
                                                    item => (
                                                        <article
                                                            key={
                                                                item.public_id
                                                            }
                                                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                                                        >
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                                                                            {humanize(
                                                                                item.clause_category
                                                                            )}
                                                                        </span>

                                                                        {item.is_mandatory && (
                                                                            <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                                                                                Mandatory
                                                                            </span>
                                                                        )}

                                                                        <span className="text-xs font-medium text-slate-400">
                                                                            Order{" "}
                                                                            {item.display_order}
                                                                        </span>
                                                                    </div>

                                                                    <h5 className="mt-3 font-semibold text-slate-900">
                                                                        {item.title}
                                                                    </h5>

                                                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                                                        {item.clause_text}
                                                                    </p>
                                                                </div>

                                                                <div className="flex shrink-0 items-center gap-2">
                                                                    <IconButton
                                                                        label={`Edit ${item.title}`}
                                                                        icon={PencilLine}
                                                                        onClick={() =>
                                                                            startItemEdit(
                                                                                item
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            Boolean(
                                                                                deletingItemId
                                                                            )
                                                                        }
                                                                    />

                                                                    <IconButton
                                                                        label={`Delete ${item.title}`}
                                                                        icon={Trash2}
                                                                        onClick={() =>
                                                                            removeItem(
                                                                                item
                                                                            )
                                                                        }
                                                                        loading={
                                                                            deletingItemId ===
                                                                            item.public_id
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                        </article>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-slate-100 pt-5">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <h4 className="font-bold text-slate-900">
                                                    {editingItem
                                                        ? "Edit Template Clause"
                                                        : "Add Template Clause"}
                                                </h4>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    These words are copied into the lease when the template is applied.
                                                </p>
                                            </div>

                                            {editingItem && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={
                                                        resetItemEditor
                                                    }
                                                    disabled={
                                                        itemSubmitting
                                                    }
                                                >
                                                    Cancel Edit
                                                </Button>
                                            )}
                                        </div>

                                        <form
                                            onSubmit={
                                                submitItem
                                            }
                                            className="mt-5 grid gap-5 md:grid-cols-2"
                                        >
                                            <div>
                                                <FieldLabel
                                                    htmlFor="template_item_category"
                                                    required
                                                >
                                                    Category
                                                </FieldLabel>

                                                <select
                                                    id="template_item_category"
                                                    value={
                                                        itemForm.clause_category
                                                    }
                                                    onChange={event =>
                                                        setItemForm(
                                                            current => ({
                                                                ...current,
                                                                clause_category:
                                                                    event.target.value
                                                            })
                                                        )
                                                    }
                                                    disabled={
                                                        itemSubmitting
                                                    }
                                                    className={inputClass}
                                                >
                                                    {CLAUSE_CATEGORIES.map(
                                                        category => (
                                                            <option
                                                                key={
                                                                    category
                                                                }
                                                                value={
                                                                    category
                                                                }
                                                            >
                                                                {humanize(
                                                                    category
                                                                )}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </div>

                                            <div>
                                                <FieldLabel
                                                    htmlFor="template_item_order"
                                                    required
                                                >
                                                    Display Order
                                                </FieldLabel>

                                                <input
                                                    id="template_item_order"
                                                    type="number"
                                                    min="1"
                                                    max="10000"
                                                    step="1"
                                                    required
                                                    value={
                                                        itemForm.display_order
                                                    }
                                                    onChange={event =>
                                                        setItemForm(
                                                            current => ({
                                                                ...current,
                                                                display_order:
                                                                    event.target.value
                                                            })
                                                        )
                                                    }
                                                    disabled={
                                                        itemSubmitting
                                                    }
                                                    className={inputClass}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <FieldLabel
                                                    htmlFor="template_item_title"
                                                    required
                                                >
                                                    Clause Title
                                                </FieldLabel>

                                                <input
                                                    id="template_item_title"
                                                    required
                                                    maxLength={200}
                                                    value={
                                                        itemForm.title
                                                    }
                                                    onChange={event =>
                                                        setItemForm(
                                                            current => ({
                                                                ...current,
                                                                title:
                                                                    event.target.value
                                                            })
                                                        )
                                                    }
                                                    disabled={
                                                        itemSubmitting
                                                    }
                                                    placeholder="e.g. Subletting Restriction"
                                                    className={inputClass}
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <FieldLabel
                                                    htmlFor="template_item_text"
                                                    required
                                                >
                                                    Contractual Wording
                                                </FieldLabel>

                                                <textarea
                                                    id="template_item_text"
                                                    required
                                                    maxLength={10000}
                                                    rows={6}
                                                    value={
                                                        itemForm.clause_text
                                                    }
                                                    onChange={event =>
                                                        setItemForm(
                                                            current => ({
                                                                ...current,
                                                                clause_text:
                                                                    event.target.value
                                                            })
                                                        )
                                                    }
                                                    disabled={
                                                        itemSubmitting
                                                    }
                                                    placeholder="Write the reusable contractual wording here..."
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            itemForm.is_mandatory
                                                        }
                                                        onChange={event =>
                                                            setItemForm(
                                                                current => ({
                                                                    ...current,
                                                                    is_mandatory:
                                                                        event.target.checked
                                                                })
                                                            )
                                                        }
                                                        disabled={
                                                            itemSubmitting
                                                        }
                                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />

                                                    <span>
                                                        <span className="block text-sm font-semibold text-slate-800">
                                                            Mandatory Contract Term
                                                        </span>
                                                        <span className="mt-0.5 block text-xs text-slate-500">
                                                            Marks the reusable clause as mandatory when copied.
                                                        </span>
                                                    </span>
                                                </label>
                                            </div>

                                            <div className="md:col-span-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={
                                                        resetItemEditor
                                                    }
                                                    disabled={
                                                        itemSubmitting
                                                    }
                                                >
                                                    Clear
                                                </Button>

                                                <Button
                                                    type="submit"
                                                    leftIcon={
                                                        editingItem
                                                            ? Save
                                                            : Plus
                                                    }
                                                    loading={
                                                        itemSubmitting
                                                    }
                                                >
                                                    {editingItem
                                                        ? "Save Template Clause"
                                                        : "Add Template Clause"}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-500">
                                    Unable to load the selected template.
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LeaseClauseTemplatesModal;
