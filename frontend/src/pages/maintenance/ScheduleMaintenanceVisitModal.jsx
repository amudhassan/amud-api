import {
    CalendarPlus,
    X
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const VISIT_TYPES = [
    "inspection",
    "repair",
    "follow_up",
    "completion_check",
    "other"
];

const ACCESS_INSTRUCTIONS = [
    "contact_first",
    "tenant_must_be_present",
    "authorized_entry"
];

const inputClassName = `
    mt-2 w-full rounded-xl
    border border-slate-300
    bg-white px-3 py-2.5
    text-sm text-slate-900
    outline-none transition
    placeholder:text-slate-400
    focus:border-blue-500
    focus:ring-2
    focus:ring-blue-100
    disabled:cursor-not-allowed
    disabled:bg-slate-100
    disabled:text-slate-500
`;

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
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
    ).format(parsed);
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to schedule maintenance visit.";

const toIsoTimestamp = value => {
    if (!value) {
        return null;
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }

    return parsed.toISOString();
};

const emptyForm = () => ({
    visit_type: "inspection",
    scheduled_start_at: "",
    scheduled_end_at: "",
    visit_purpose: "",
    access_instruction: "",
    requires_tenant_confirmation:
        false
});

function FieldLabel({
    children,
    required = false
}) {
    return (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {children}

            {required && (
                <span className="text-rose-500">
                    {" "}*
                </span>
            )}
        </span>
    );
}

function ScheduleMaintenanceVisitModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onScheduled
}) {
    const [
        form,
        setForm
    ] = useState(
        emptyForm
    );

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const currentAssignment =
        maintenanceRequest
            ?.current_assignment ||
        null;

    const assignmentLabel =
        useMemo(
            () => {
                if (!currentAssignment) {
                    return "No assignment linked";
                }

                if (
                    currentAssignment
                        .assignment_type ===
                    "internal_technician"
                ) {
                    return (
                        currentAssignment
                            .technician
                            ?.full_name ||
                        "Internal Technician"
                    );
                }

                return (
                    currentAssignment
                        .provider
                        ?.company_name ||
                    currentAssignment
                        .provider
                        ?.vendor_name ||
                    currentAssignment
                        .provider
                        ?.display_name ||
                    "External Vendor"
                );
            },
            [
                currentAssignment
            ]
        );

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            emptyForm()
        );
        setError("");
        setSubmitting(false);
    }, [
        open,
        maintenanceRequest
            ?.public_id
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !submitting
                ) {
                    onClose();
                }
            };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [
        onClose,
        open,
        submitting
    ]);

    if (
        !open ||
        !maintenanceRequest
    ) {
        return null;
    }

    const update = (
        field,
        value
    ) => {
        setForm(
            current => ({
                ...current,
                [field]: value
            })
        );

        if (error) {
            setError("");
        }
    };

    const validate = () => {
        if (
            ![
                "reported",
                "under_review",
                "assigned",
                "in_progress",
                "on_hold"
            ].includes(
                maintenanceRequest.status
            )
        ) {
            return "This maintenance request is not eligible for a new visit.";
        }

        if (
            !maintenanceRequest.updated_at
        ) {
            return "Maintenance request updated-at timestamp is missing. Close and reopen the request.";
        }

        if (!form.visit_type) {
            return "Visit type is required.";
        }

        const start =
            toIsoTimestamp(
                form.scheduled_start_at
            );

        const end =
            toIsoTimestamp(
                form.scheduled_end_at
            );

        if (!start) {
            return "Scheduled start date and time is required.";
        }

        if (!end) {
            return "Scheduled end date and time is required.";
        }

        if (
            new Date(end).getTime() <=
            new Date(start).getTime()
        ) {
            return "Scheduled end must be after scheduled start.";
        }

        const purpose =
            form.visit_purpose.trim();

        if (
            purpose.length < 3 ||
            purpose.length > 5000
        ) {
            return "Visit purpose must contain between 3 and 5000 characters.";
        }

        return "";
    };

    const submit =
        async event => {
            event.preventDefault();

            const validationError =
                validate();

            if (validationError) {
                setError(
                    validationError
                );
                return;
            }

            const payload = {
                expected_request_status:
                    maintenanceRequest.status,
                expected_request_updated_at:
                    maintenanceRequest.updated_at,
                visit_type:
                    form.visit_type,
                scheduled_start_at:
                    toIsoTimestamp(
                        form.scheduled_start_at
                    ),
                scheduled_end_at:
                    toIsoTimestamp(
                        form.scheduled_end_at
                    ),
                visit_purpose:
                    form.visit_purpose.trim(),
                requires_tenant_confirmation:
                    Boolean(
                        form.requires_tenant_confirmation
                    )
            };

            if (
                currentAssignment
                    ?.public_id
            ) {
                payload.assignment_public_id =
                    currentAssignment.public_id;
            }

            if (
                form.access_instruction
            ) {
                payload.access_instruction =
                    form.access_instruction;
            }

            try {
                setSubmitting(true);
                setError("");

                const config = {};

                if (accessContext) {
                    config.params = {
                        access_context:
                            accessContext
                    };
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}/visits`,
                    payload,
                    config
                );

                onScheduled();
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Schedule Maintenance Visit
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceRequest.request_number ||
                                maintenanceRequest.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close schedule visit"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-5">
                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            <p className="font-semibold">
                                Current request state
                            </p>

                            <p className="mt-1 text-xs leading-5">
                                Status:{" "}
                                <strong>
                                    {formatLabel(
                                        maintenanceRequest.status
                                    )}
                                </strong>
                                {" • "}Updated:{" "}
                                <strong>
                                    {formatDateTime(
                                        maintenanceRequest.updated_at
                                    )}
                                </strong>
                            </p>

                            <p className="mt-1 text-xs leading-5">
                                Assignment:{" "}
                                <strong>
                                    {assignmentLabel}
                                </strong>
                                {currentAssignment
                                    ?.status
                                    ? ` • ${formatLabel(
                                          currentAssignment.status
                                      )}`
                                    : ""}
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <FieldLabel required>
                                    Visit Type
                                </FieldLabel>

                                <select
                                    value={
                                        form.visit_type
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "visit_type",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                >
                                    {VISIT_TYPES.map(
                                        value => (
                                            <option
                                                key={
                                                    value
                                                }
                                                value={
                                                    value
                                                }
                                            >
                                                {
                                                    formatLabel(
                                                        value
                                                    )
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Access Instruction
                                </FieldLabel>

                                <select
                                    value={
                                        form.access_instruction
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "access_instruction",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                >
                                    <option value="">
                                        None
                                    </option>

                                    {ACCESS_INSTRUCTIONS.map(
                                        value => (
                                            <option
                                                key={
                                                    value
                                                }
                                                value={
                                                    value
                                                }
                                            >
                                                {
                                                    formatLabel(
                                                        value
                                                    )
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Scheduled Start
                                </FieldLabel>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.scheduled_start_at
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "scheduled_start_at",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                />
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Scheduled End
                                </FieldLabel>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.scheduled_end_at
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "scheduled_end_at",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                />
                            </label>

                            <label className="block md:col-span-2">
                                <FieldLabel required>
                                    Visit Purpose
                                </FieldLabel>

                                <textarea
                                    value={
                                        form.visit_purpose
                                    }
                                    disabled={
                                        submitting
                                    }
                                    minLength={3}
                                    maxLength={5000}
                                    rows={5}
                                    placeholder="Describe what should be inspected, repaired or verified during this visit..."
                                    onChange={
                                        event =>
                                            update(
                                                "visit_purpose",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={`${inputClassName} min-h-32 resize-y`}
                                />

                                <p className="mt-1 text-right text-xs text-slate-400">
                                    {
                                        form
                                            .visit_purpose
                                            .length
                                    }
                                    /5000
                                </p>
                            </label>

                            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                                <input
                                    type="checkbox"
                                    checked={
                                        form.requires_tenant_confirmation
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "requires_tenant_confirmation",
                                                event
                                                    .target
                                                    .checked
                                            )
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                />

                                <span>
                                    <span className="block text-sm font-semibold text-slate-800">
                                        Require tenant confirmation
                                    </span>

                                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                                        Enable this when the tenant must confirm the scheduled visit before operational work proceeds.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={CalendarPlus}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Scheduling..."
                            : "Schedule Visit"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ScheduleMaintenanceVisitModal;
