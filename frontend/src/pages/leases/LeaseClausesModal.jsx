import {
    PencilLine,
    Plus,
    RefreshCw,
    Save,
    FileText,
    Layers3,
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

const emptyForm = () => ({
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
    "Unable to manage lease clauses.";

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);
};

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

function LeaseClausesModal({
    open,
    lease,
    onClose
}) {
    const [clauses, setClauses] =
        useState([]);
    const [form, setForm] =
        useState(emptyForm);
    const [editingClause, setEditingClause] =
        useState(null);
    const [loading, setLoading] =
        useState(false);
    const [submitting, setSubmitting] =
        useState(false);
    const [deletingId, setDeletingId] =
        useState("");
    const [error, setError] =
        useState("");
    const [success, setSuccess] =
        useState("");

    const [ownerPublicId, setOwnerPublicId] =
        useState("");
    const [templates, setTemplates] =
        useState([]);
    const [selectedTemplateId, setSelectedTemplateId] =
        useState("");
    const [templatesLoading, setTemplatesLoading] =
        useState(false);
    const [applyingTemplate, setApplyingTemplate] =
        useState(false);

    const editable =
        lease?.status === "draft";

    const nextDisplayOrder =
        useMemo(() => {
            if (clauses.length === 0) {
                return 1;
            }

            return Math.max(
                ...clauses.map(
                    clause =>
                        Number(
                            clause.display_order
                        ) || 0
                )
            ) + 1;
        }, [clauses]);

    const loadClauses = async () => {
        if (!lease?.public_id) {
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response =
                await apiClient.get(
                    `/leases/${lease.public_id}/clauses`
                );

            const rows =
                response?.data?.data
                    ?.clauses;

            setClauses(
                Array.isArray(rows)
                    ? rows
                    : []
            );
        } catch (requestError) {
            setClauses([]);
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setLoading(false);
        }
    };

    const resolveOwnerPublicId =
        async () => {
            const existingOwnerPublicId =
                lease?.owner?.public_id ||
                lease?.owner_public_id ||
                "";

            if (existingOwnerPublicId) {
                setOwnerPublicId(
                    existingOwnerPublicId
                );
                return existingOwnerPublicId;
            }

            try {
                const response =
                    await apiClient.get(
                        `/leases/${lease.public_id}`
                    );

                const resolved =
                    response?.data?.data
                        ?.lease?.owner
                        ?.public_id ||
                    "";

                setOwnerPublicId(
                    resolved
                );

                return resolved;
            } catch {
                setOwnerPublicId("");
                return "";
            }
        };

    const loadActiveTemplates =
        async requestedOwnerPublicId => {
            if (!requestedOwnerPublicId) {
                setTemplates([]);
                setSelectedTemplateId("");
                return;
            }

            try {
                setTemplatesLoading(true);

                const response =
                    await apiClient.get(
                        "/lease-clause-templates",
                        {
                            params: {
                                owner_public_id:
                                    requestedOwnerPublicId,
                                status:
                                    "active"
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

                const currentExists =
                    Array.isArray(rows) &&
                    rows.some(
                        template =>
                            template.public_id ===
                            selectedTemplateId
                    );

                if (!currentExists) {
                    setSelectedTemplateId("");
                }
            } catch (requestError) {
                setTemplates([]);
                setSelectedTemplateId("");
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setTemplatesLoading(false);
            }
        };

    const loadTemplateContext =
        async () => {
            if (!editable) {
                setOwnerPublicId("");
                setTemplates([]);
                setSelectedTemplateId("");
                return;
            }

            const resolvedOwnerPublicId =
                await resolveOwnerPublicId();

            if (resolvedOwnerPublicId) {
                await loadActiveTemplates(
                    resolvedOwnerPublicId
                );
            }
        };

    useEffect(() => {
        if (!open || !lease?.public_id) {
            return;
        }

        setEditingClause(null);
        setForm(emptyForm());
        setError("");
        setSuccess("");
        setOwnerPublicId("");
        setTemplates([]);
        setSelectedTemplateId("");
        loadClauses();
        loadTemplateContext();
    }, [
        open,
        lease?.public_id
    ]);

    useEffect(() => {
        if (
            !editingClause &&
            open
        ) {
            setForm(current => ({
                ...current,
                display_order:
                    String(
                        nextDisplayOrder
                    )
            }));
        }
    }, [
        nextDisplayOrder,
        editingClause,
        open
    ]);

    if (!open || !lease) {
        return null;
    }

    const update = (
        field,
        value
    ) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));
    };

    const resetEditor = () => {
        setEditingClause(null);
        setForm({
            ...emptyForm(),
            display_order:
                String(nextDisplayOrder)
        });
    };

    const startEdit = clause => {
        setEditingClause(clause);
        setError("");
        setSuccess("");
        setForm({
            clause_category:
                clause.clause_category,
            title:
                clause.title || "",
            clause_text:
                clause.clause_text || "",
            is_mandatory:
                clause.is_mandatory === true,
            display_order:
                String(
                    clause.display_order ?? 1
                )
        });
    };

    const submit = async event => {
        event.preventDefault();

        if (!editable) {
            setError(
                "Contract clauses are frozen because this lease is no longer in Draft status."
            );
            return;
        }

        const title =
            form.title.trim();
        const clauseText =
            form.clause_text.trim();
        const displayOrder =
            Number(form.display_order);

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
                form.clause_category,
            title,
            clause_text:
                clauseText,
            is_mandatory:
                form.is_mandatory,
            display_order:
                displayOrder
        };

        try {
            setSubmitting(true);
            setError("");
            setSuccess("");

            if (editingClause) {
                await apiClient.patch(
                    `/leases/${lease.public_id}/clauses/${editingClause.public_id}`,
                    payload
                );

                setSuccess(
                    "Contract clause updated successfully."
                );
            } else {
                await apiClient.post(
                    `/leases/${lease.public_id}/clauses`,
                    payload
                );

                setSuccess(
                    "Contract clause added successfully."
                );
            }

            resetEditor();
            await loadClauses();
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    const removeClause = async clause => {
        if (!editable) {
            return;
        }

        const confirmed =
            window.confirm(
                `Remove contract clause \"${clause.title}\"? This performs a soft delete and keeps the audit record.`
            );

        if (!confirmed) {
            return;
        }

        try {
            setDeletingId(
                clause.public_id
            );
            setError("");
            setSuccess("");

            await apiClient.delete(
                `/leases/${lease.public_id}/clauses/${clause.public_id}`
            );

            if (
                editingClause?.public_id ===
                    clause.public_id
            ) {
                resetEditor();
            }

            setSuccess(
                "Contract clause removed successfully."
            );
            await loadClauses();
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setDeletingId("");
        }
    };

    const applyTemplate = async () => {
        if (!editable) {
            setError(
                "Templates can only be applied while the lease is in Draft status."
            );
            return;
        }

        if (clauses.length > 0) {
            setError(
                "Remove the active lease clauses before applying a template."
            );
            return;
        }

        if (!selectedTemplateId) {
            setError(
                "Select an active owner template first."
            );
            return;
        }

        try {
            setApplyingTemplate(true);
            setError("");
            setSuccess("");

            const response =
                await apiClient.post(
                    `/leases/${lease.public_id}/apply-clause-template`,
                    {
                        template_public_id:
                            selectedTemplateId
                    }
                );

            const copiedCount =
                response?.data?.data
                    ?.copied_count;

            setSuccess(
                Number.isInteger(
                    copiedCount
                )
                    ? `${copiedCount} template clause${copiedCount === 1 ? "" : "s"} copied into this Draft lease successfully.`
                    : "Owner clause template applied successfully."
            );

            setSelectedTemplateId("");
            resetEditor();
            await loadClauses();
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setApplyingTemplate(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lease-clauses-title"
        >
            <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
                <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <FileText className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="lease-clauses-title"
                                className="text-xl font-bold text-slate-950"
                            >
                                Terms & Conditions
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {lease.lease_number}
                                {" · "}
                                {humanize(
                                    lease.status
                                )}
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close terms and conditions"
                        icon={X}
                        onClick={onClose}
                        disabled={
                            submitting ||
                            applyingTemplate ||
                            Boolean(deletingId)
                        }
                    />
                </div>

                <div className="space-y-6 p-6">
                    {editable ? (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
                            This lease is still <strong>Draft</strong>. Contract clauses can be added, edited or removed until the lease is scheduled.
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            These contract terms are <strong>frozen</strong>. The lease is no longer Draft, so clauses are view-only.
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        >
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {success}
                        </div>
                    )}

                    {editable && (
                        <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                    <Layers3 className="h-4 w-4" />
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-950">
                                        Apply Owner Template
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Copy an active reusable template into this Draft lease as an independent contractual snapshot.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                                <div>
                                    <FieldLabel
                                        htmlFor="lease_clause_template"
                                    >
                                        Active Template
                                    </FieldLabel>

                                    <select
                                        id="lease_clause_template"
                                        value={
                                            selectedTemplateId
                                        }
                                        onChange={event =>
                                            setSelectedTemplateId(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            templatesLoading ||
                                            applyingTemplate ||
                                            clauses.length > 0 ||
                                            !ownerPublicId
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">
                                            {templatesLoading
                                                ? "Loading templates..."
                                                : templates.length === 0
                                                    ? "No active templates available"
                                                    : "Select template"}
                                        </option>

                                        {templates.map(
                                            template => (
                                                <option
                                                    key={
                                                        template.public_id
                                                    }
                                                    value={
                                                        template.public_id
                                                    }
                                                >
                                                    {template.name}
                                                    {" · "}
                                                    {template.item_count ||
                                                        0}
                                                    {" clauses"}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <Button
                                    type="button"
                                    leftIcon={Layers3}
                                    onClick={applyTemplate}
                                    loading={
                                        applyingTemplate
                                    }
                                    disabled={
                                        clauses.length > 0 ||
                                        !selectedTemplateId ||
                                        templatesLoading
                                    }
                                >
                                    Apply Template
                                </Button>
                            </div>

                            {clauses.length > 0 && (
                                <p className="mt-3 text-xs font-medium text-amber-700">
                                    This Draft already has active clauses. Remove them before applying a template to prevent accidental duplication.
                                </p>
                            )}

                            {!templatesLoading &&
                                ownerPublicId &&
                                templates.length === 0 && (
                                    <p className="mt-3 text-xs text-slate-500">
                                        No active owner templates are available yet. Use the Leases page “Clause Templates” manager to create one.
                                    </p>
                                )}
                        </section>
                    )}

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="font-bold text-slate-950">
                                    Contract Clauses
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {clauses.length}{" "}
                                    active clause
                                    {clauses.length === 1 ? "" : "s"}
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RefreshCw}
                                onClick={loadClauses}
                                disabled={loading}
                            >
                                Refresh
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-slate-500">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading contract clauses...
                            </div>
                        ) : clauses.length === 0 ? (
                            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                                <FileText className="mx-auto h-8 w-8 text-slate-300" />
                                <p className="mt-3 font-semibold text-slate-700">
                                    No contract clauses yet
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    {editable
                                        ? "Add the first term or restriction below."
                                        : "No active contractual clauses were recorded for this lease."}
                                </p>
                            </div>
                        ) : (
                            <div className="mt-5 space-y-3">
                                {clauses.map(
                                    clause => (
                                        <article
                                            key={clause.public_id}
                                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                                                            {humanize(
                                                                clause.clause_category
                                                            )}
                                                        </span>

                                                        <span className={
                                                            clause.is_mandatory
                                                                ? "inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-100"
                                                                : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                                                        }>
                                                            {clause.is_mandatory
                                                                ? "Mandatory"
                                                                : "Optional"}
                                                        </span>

                                                        <span className="text-xs font-medium text-slate-400">
                                                            Order {clause.display_order}
                                                        </span>
                                                    </div>

                                                    <h4 className="mt-3 font-bold text-slate-900">
                                                        {clause.title}
                                                    </h4>

                                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                                        {clause.clause_text}
                                                    </p>

                                                    <p className="mt-3 text-xs text-slate-400">
                                                        Updated {formatDateTime(
                                                            clause.updated_at
                                                        )}
                                                    </p>
                                                </div>

                                                {editable && (
                                                    <div className="flex gap-2">
                                                        <IconButton
                                                            label={`Edit ${clause.title}`}
                                                            icon={PencilLine}
                                                            variant="secondary"
                                                            onClick={() =>
                                                                startEdit(
                                                                    clause
                                                                )
                                                            }
                                                            disabled={
                                                                submitting ||
                                                                Boolean(deletingId)
                                                            }
                                                        />

                                                        <IconButton
                                                            label={`Remove ${clause.title}`}
                                                            icon={Trash2}
                                                            variant="secondary"
                                                            onClick={() =>
                                                                removeClause(
                                                                    clause
                                                                )
                                                            }
                                                            disabled={
                                                                submitting ||
                                                                Boolean(deletingId)
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </article>
                                    )
                                )}
                            </div>
                        )}
                    </section>

                    {editable && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-5 flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-slate-950">
                                        {editingClause
                                            ? "Edit Contract Clause"
                                            : "Add Contract Clause"}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Write the contractual wording exactly as it should appear in the lease agreement.
                                    </p>
                                </div>

                                {editingClause && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={resetEditor}
                                        disabled={submitting}
                                    >
                                        Cancel Edit
                                    </Button>
                                )}
                            </div>

                            <form
                                onSubmit={submit}
                                className="grid gap-5 md:grid-cols-2"
                            >
                                <div>
                                    <FieldLabel
                                        htmlFor="lease_clause_category"
                                        required
                                    >
                                        Category
                                    </FieldLabel>

                                    <select
                                        id="lease_clause_category"
                                        required
                                        value={
                                            form.clause_category
                                        }
                                        onChange={event =>
                                            update(
                                                "clause_category",
                                                event.target.value
                                            )
                                        }
                                        disabled={submitting}
                                        className={inputClass}
                                    >
                                        {CLAUSE_CATEGORIES.map(
                                            category => (
                                                <option
                                                    key={category}
                                                    value={category}
                                                >
                                                    {humanize(category)}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="lease_clause_order"
                                        required
                                    >
                                        Display Order
                                    </FieldLabel>

                                    <input
                                        id="lease_clause_order"
                                        type="number"
                                        min="1"
                                        max="10000"
                                        step="1"
                                        required
                                        value={form.display_order}
                                        onChange={event =>
                                            update(
                                                "display_order",
                                                event.target.value
                                            )
                                        }
                                        disabled={submitting}
                                        className={inputClass}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <FieldLabel
                                        htmlFor="lease_clause_title"
                                        required
                                    >
                                        Clause Title
                                    </FieldLabel>

                                    <input
                                        id="lease_clause_title"
                                        required
                                        maxLength={200}
                                        value={form.title}
                                        onChange={event =>
                                            update(
                                                "title",
                                                event.target.value
                                            )
                                        }
                                        disabled={submitting}
                                        placeholder="e.g. Subletting Restriction"
                                        className={inputClass}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <FieldLabel
                                        htmlFor="lease_clause_text"
                                        required
                                    >
                                        Contractual Wording
                                    </FieldLabel>

                                    <textarea
                                        id="lease_clause_text"
                                        required
                                        maxLength={10000}
                                        rows={6}
                                        value={form.clause_text}
                                        onChange={event =>
                                            update(
                                                "clause_text",
                                                event.target.value
                                            )
                                        }
                                        disabled={submitting}
                                        placeholder="Write the full term, limitation or agreement here..."
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={
                                                form.is_mandatory
                                            }
                                            onChange={event =>
                                                update(
                                                    "is_mandatory",
                                                    event.target.checked
                                                )
                                            }
                                            disabled={submitting}
                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />

                                        <span>
                                            <span className="block text-sm font-semibold text-slate-800">
                                                Mandatory Contract Term
                                            </span>
                                            <span className="mt-0.5 block text-xs text-slate-500">
                                                Marks this clause as a required term of the agreement.
                                            </span>
                                        </span>
                                    </label>
                                </div>

                                <div className="md:col-span-2 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={resetEditor}
                                        disabled={submitting}
                                    >
                                        Clear
                                    </Button>

                                    <Button
                                        type="submit"
                                        leftIcon={
                                            editingClause
                                                ? Save
                                                : Plus
                                        }
                                        loading={submitting}
                                    >
                                        {editingClause
                                            ? "Save Clause"
                                            : "Add Clause"}
                                    </Button>
                                </div>
                            </form>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LeaseClausesModal;
