import {
    CalendarClock,
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

const toIsoTimestamp = value => {
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
    "Unable to update maintenance SLA targets.";

const makeForm = request => ({
    target_review_at:
        toLocalDateTimeValue(
            request?.sla
                ?.target_review_at
        ),
    target_work_start_at:
        toLocalDateTimeValue(
            request?.sla
                ?.target_work_start_at
        ),
    target_resolution_at:
        toLocalDateTimeValue(
            request?.sla
                ?.target_resolution_at
        ),
    reason: ""
});

function UpdateMaintenanceSlaTargetsModal({
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

    const original =
        useMemo(
            () => ({
                target_review_at:
                    toLocalDateTimeValue(
                        maintenanceRequest
                            ?.sla
                            ?.target_review_at
                    ),
                target_work_start_at:
                    toLocalDateTimeValue(
                        maintenanceRequest
                            ?.sla
                            ?.target_work_start_at
                    ),
                target_resolution_at:
                    toLocalDateTimeValue(
                        maintenanceRequest
                            ?.sla
                            ?.target_resolution_at
                    )
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

            const changedFields = [
                "target_review_at",
                "target_work_start_at",
                "target_resolution_at"
            ].filter(
                field =>
                    form[field] !==
                    original[field]
            );

            if (
                changedFields.length === 0
            ) {
                setError(
                    "Change at least one SLA target before saving."
                );
                return;
            }

            for (
                const field of
                changedFields
            ) {
                if (!form[field]) {
                    setError(
                        "An existing SLA target cannot be cleared through this operation. Enter a new future date and time."
                    );
                    return;
                }
            }

            const changedIso = {};

            for (
                const field of
                changedFields
            ) {
                const iso =
                    toIsoTimestamp(
                        form[field]
                    );

                if (!iso) {
                    setError(
                        "One of the changed SLA targets contains an invalid date and time."
                    );
                    return;
                }

                if (
                    new Date(
                        iso
                    ).getTime() <=
                    Date.now()
                ) {
                    setError(
                        "Every changed SLA target must be in the future."
                    );
                    return;
                }

                changedIso[field] =
                    iso;
            }

            const finalReviewAt =
                toIsoTimestamp(
                    form.target_review_at
                );

            const finalWorkStartAt =
                toIsoTimestamp(
                    form.target_work_start_at
                );

            const finalResolutionAt =
                toIsoTimestamp(
                    form.target_resolution_at
                );

            if (
                finalReviewAt &&
                finalWorkStartAt &&
                new Date(
                    finalReviewAt
                ).getTime() >
                    new Date(
                        finalWorkStartAt
                    ).getTime()
            ) {
                setError(
                    "Target Review cannot be after Target Work Start."
                );
                return;
            }

            if (
                finalWorkStartAt &&
                finalResolutionAt &&
                new Date(
                    finalWorkStartAt
                ).getTime() >
                    new Date(
                        finalResolutionAt
                    ).getTime()
            ) {
                setError(
                    "Target Work Start cannot be after Target Resolution."
                );
                return;
            }

            if (
                finalReviewAt &&
                finalResolutionAt &&
                new Date(
                    finalReviewAt
                ).getTime() >
                    new Date(
                        finalResolutionAt
                    ).getTime()
            ) {
                setError(
                    "Target Review cannot be after Target Resolution."
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
                    "SLA target change reason must contain between 5 and 2000 characters."
                );
                return;
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

                await apiClient.patch(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}/sla-targets`,
                    {
                        expected_updated_at:
                            maintenanceRequest.updated_at,
                        ...changedIso,
                        reason
                    },
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
                className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Update SLA Targets
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Change one or more future review, work-start or resolution targets.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close SLA target modal"
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

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                            Only changed SLA fields are sent to the API. Any changed target must be a future date and time.
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Target Review
                                </span>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.target_review_at
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "target_review_at",
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
                                    Target Work Start
                                </span>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.target_work_start_at
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "target_work_start_at",
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
                                    Target Resolution
                                </span>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.target_resolution_at
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "target_resolution_at",
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
                                    Change Reason *
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
                                    placeholder="Explain why the SLA target is being changed..."
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
                        leftIcon={CalendarClock}
                        disabled={
                            submitting
                        }
                    >
                        {submitting
                            ? "Updating..."
                            : "Update SLA Targets"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default UpdateMaintenanceSlaTargetsModal;
