import {
    PencilLine,
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

const CATEGORIES = [
    "plumbing",
    "electrical",
    "appliance",
    "structural",
    "roofing",
    "painting",
    "doors_windows",
    "security",
    "water_supply",
    "sanitation",
    "pest_control",
    "internet_communication",
    "cleaning",
    "common_area",
    "other"
];

const PRIORITIES = [
    "low",
    "medium",
    "high",
    "emergency"
];

const IMPACT_LEVELS = [
    "no_operational_impact",
    "partially_restricted",
    "uninhabitable"
];

const ACCESS_INSTRUCTIONS = [
    "",
    "contact_first",
    "tenant_must_be_present",
    "authorized_entry"
];

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const toLocalDateTimeValue = value => {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return "";
    }

    const local = new Date(
        parsed.getTime() -
        parsed.getTimezoneOffset() *
            60 *
            1000
    );

    return local
        .toISOString()
        .slice(0, 16);
};

const toIsoTimestampOrNull = value => {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }

    return parsed.toISOString();
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to update maintenance request.";

const makeForm = request => ({
    title:
        request?.title || "",
    description:
        request?.description || "",
    category:
        request?.category || "",
    priority:
        request?.priority || "",
    impact_level:
        request?.impact_level || "",
    location_details:
        request?.location_details || "",
    problem_started_at:
        toLocalDateTimeValue(
            request?.problem_started_at
        ),
    preferred_visit_at:
        toLocalDateTimeValue(
            request?.preferred_visit_at
        ),
    access_instruction:
        request?.access_instruction || "",
    reason: ""
});

function EditMaintenanceRequestModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onUpdated
}) {
    const [
        form,
        setForm
    ] = useState(() =>
        makeForm(
            maintenanceRequest
        )
    );

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            makeForm(
                maintenanceRequest
            )
        );
        setSubmitting(false);
        setError("");
    }, [
        maintenanceRequest,
        open
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

    const update =
        (field, value) => {
            setForm(
                current => ({
                    ...current,
                    [field]:
                        value
                })
            );

            if (error) {
                setError("");
            }
        };

    const original =
        useMemo(
            () => ({
                title:
                    maintenanceRequest
                        ?.title || "",
                description:
                    maintenanceRequest
                        ?.description || "",
                category:
                    maintenanceRequest
                        ?.category || "",
                priority:
                    maintenanceRequest
                        ?.priority || "",
                impact_level:
                    maintenanceRequest
                        ?.impact_level || "",
                location_details:
                    maintenanceRequest
                        ?.location_details ||
                    "",
                problem_started_at:
                    toLocalDateTimeValue(
                        maintenanceRequest
                            ?.problem_started_at
                    ),
                preferred_visit_at:
                    toLocalDateTimeValue(
                        maintenanceRequest
                            ?.preferred_visit_at
                    ),
                access_instruction:
                    maintenanceRequest
                        ?.access_instruction ||
                    ""
            }),
            [
                maintenanceRequest
            ]
        );

    if (
        !open ||
        !maintenanceRequest
    ) {
        return null;
    }

    const submit =
        async event => {
            event.preventDefault();

            if (
                [
                    "closed",
                    "rejected",
                    "cancelled"
                ].includes(
                    maintenanceRequest
                        .status
                )
            ) {
                setError(
                    "Terminal maintenance requests are read-only."
                );
                return;
            }

            if (
                !maintenanceRequest
                    .updated_at
            ) {
                setError(
                    "Maintenance request updated-at timestamp is missing. Close and reopen the request."
                );
                return;
            }

            const title =
                form.title.trim();

            const description =
                form.description.trim();

            if (
                title.length < 3 ||
                title.length > 255
            ) {
                setError(
                    "Title must contain between 3 and 255 characters."
                );
                return;
            }

            if (
                description.length <
                    10 ||
                description.length >
                    5000
            ) {
                setError(
                    "Description must contain between 10 and 5000 characters."
                );
                return;
            }

            if (
                !CATEGORIES.includes(
                    form.category
                )
            ) {
                setError(
                    "Select a valid maintenance category."
                );
                return;
            }

            if (
                !PRIORITIES.includes(
                    form.priority
                )
            ) {
                setError(
                    "Select a valid maintenance priority."
                );
                return;
            }

            if (
                !IMPACT_LEVELS.includes(
                    form.impact_level
                )
            ) {
                setError(
                    "Select a valid impact level."
                );
                return;
            }

            const location =
                form.location_details.trim();

            if (
                location.length > 500
            ) {
                setError(
                    "Location details cannot exceed 500 characters."
                );
                return;
            }

            if (
                form.access_instruction &&
                !ACCESS_INSTRUCTIONS.includes(
                    form.access_instruction
                )
            ) {
                setError(
                    "Select a valid access instruction."
                );
                return;
            }

            const problemStartedAt =
                toIsoTimestampOrNull(
                    form.problem_started_at
                );

            const preferredVisitAt =
                toIsoTimestampOrNull(
                    form.preferred_visit_at
                );

            if (
                form.problem_started_at &&
                !problemStartedAt
            ) {
                setError(
                    "Problem start date and time is invalid."
                );
                return;
            }

            if (
                problemStartedAt &&
                new Date(
                    problemStartedAt
                ).getTime() >
                    Date.now()
            ) {
                setError(
                    "Problem start date and time cannot be in the future."
                );
                return;
            }

            if (
                form.preferred_visit_at &&
                !preferredVisitAt
            ) {
                setError(
                    "Preferred visit date and time is invalid."
                );
                return;
            }

            if (
                preferredVisitAt &&
                new Date(
                    preferredVisitAt
                ).getTime() <=
                    Date.now()
            ) {
                setError(
                    "Preferred visit date and time must be in the future."
                );
                return;
            }

            if (
                problemStartedAt &&
                preferredVisitAt &&
                new Date(
                    problemStartedAt
                ).getTime() >=
                    new Date(
                        preferredVisitAt
                    ).getTime()
            ) {
                setError(
                    "Preferred visit date and time must be after the problem start date and time."
                );
                return;
            }

            const reason =
                form.reason.trim();

            if (
                reason.length < 5 ||
                reason.length > 2000
            ) {
                setError(
                    "Update reason must contain between 5 and 2000 characters."
                );
                return;
            }

            const body = {
                expected_updated_at:
                    maintenanceRequest
                        .updated_at,
                reason
            };

            const currentValues = {
                title,
                description,
                category:
                    form.category,
                priority:
                    form.priority,
                impact_level:
                    form.impact_level,
                location_details:
                    location,
                problem_started_at:
                    form.problem_started_at,
                preferred_visit_at:
                    form.preferred_visit_at,
                access_instruction:
                    form.access_instruction
            };

            const changedFields = [];

            Object.keys(
                currentValues
            ).forEach(field => {
                if (
                    currentValues[field] !==
                    original[field]
                ) {
                    changedFields.push(
                        field
                    );
                }
            });

            if (
                changedFields.length === 0
            ) {
                setError(
                    "Change at least one maintenance request field before saving."
                );
                return;
            }

            changedFields.forEach(
                field => {
                    switch (field) {
                        case "location_details":
                            body.location_details =
                                location ||
                                null;
                            break;

                        case "problem_started_at":
                            body.problem_started_at =
                                problemStartedAt;
                            break;

                        case "preferred_visit_at":
                            body.preferred_visit_at =
                                preferredVisitAt;
                            break;

                        case "access_instruction":
                            body.access_instruction =
                                form.access_instruction ||
                                null;
                            break;

                        default:
                            body[field] =
                                currentValues[
                                    field
                                ];
                            break;
                    }
                }
            );

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

                await apiClient.patch(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}`,
                    body,
                    config
                );

                onUpdated();
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Edit Maintenance Request
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Update operational request details while preserving the request identity and audit history.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close edit maintenance request modal"
                        disabled={
                            submitting
                        }
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

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Title *
                                </span>

                                <input
                                    type="text"
                                    value={
                                        form.title
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={255}
                                    onChange={
                                        event =>
                                            update(
                                                "title",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Description *
                                </span>

                                <textarea
                                    value={
                                        form.description
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={5000}
                                    rows={5}
                                    onChange={
                                        event =>
                                            update(
                                                "description",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Category *
                                </span>

                                <select
                                    value={
                                        form.category
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "category",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {CATEGORIES.map(
                                        item => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {formatLabel(
                                                    item
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Priority *
                                </span>

                                <select
                                    value={
                                        form.priority
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "priority",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {PRIORITIES.map(
                                        item => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {formatLabel(
                                                    item
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Impact Level *
                                </span>

                                <select
                                    value={
                                        form.impact_level
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "impact_level",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {IMPACT_LEVELS.map(
                                        item => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {formatLabel(
                                                    item
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Access Instruction
                                </span>

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
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {ACCESS_INSTRUCTIONS.map(
                                        item => (
                                            <option
                                                key={
                                                    item ||
                                                    "none"
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {item
                                                    ? formatLabel(
                                                          item
                                                      )
                                                    : "None"}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Location Details
                                </span>

                                <input
                                    type="text"
                                    value={
                                        form.location_details
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={500}
                                    placeholder="Optional location details"
                                    onChange={
                                        event =>
                                            update(
                                                "location_details",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Problem Started
                                </span>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.problem_started_at
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "problem_started_at",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Preferred Visit
                                </span>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.preferred_visit_at
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "preferred_visit_at",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Update Reason *
                                </span>

                                <textarea
                                    value={
                                        form.reason
                                    }
                                    disabled={
                                        submitting
                                    }
                                    minLength={5}
                                    maxLength={2000}
                                    rows={4}
                                    placeholder="Explain why these request details are being changed..."
                                    onChange={
                                        event =>
                                            update(
                                                "reason",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <p className="mt-1 text-right text-xs text-slate-400">
                                    {
                                        form.reason
                                            .length
                                    }
                                    /2000
                                </p>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            submitting
                        }
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={PencilLine}
                        disabled={
                            submitting
                        }
                    >
                        {submitting
                            ? "Saving..."
                            : "Save Changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default EditMaintenanceRequestModal;
