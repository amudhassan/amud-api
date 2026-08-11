import {
    CalendarDays,
    X
} from "lucide-react";
import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import {
    Button,
    IconButton
} from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to schedule lease.";

const toDateTimeLocal = value => {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const offset =
        date.getTimezoneOffset() * 60000;

    return new Date(
        date.getTime() - offset
    )
        .toISOString()
        .slice(0, 16);
};

const toIsoTimestamp = value => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
};

const formatDate = value => {
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
            day: "2-digit"
        }
    ).format(date);
};

const formatDateTime = value => {
    if (!value) {
        return "Not signed yet";
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
`;

function ScheduleLeaseModal({
    open,
    lease,
    onClose,
    onScheduled
}) {
    const [leaseDetail, setLeaseDetail] =
        useState(null);
    const [signedAt, setSignedAt] =
        useState("");
    const [loading, setLoading] =
        useState(false);
    const [submitting, setSubmitting] =
        useState(false);
    const [error, setError] =
        useState("");

    useEffect(() => {
        let cancelled = false;

        const loadLease = async () => {
            if (!open || !lease?.public_id) {
                return;
            }

            try {
                setLoading(true);
                setError("");
                setLeaseDetail(null);
                setSignedAt("");

                const response =
                    await apiClient.get(
                        `/leases/${lease.public_id}`
                    );

                const detail =
                    response?.data?.data
                        ?.lease || null;

                if (cancelled) {
                    return;
                }

                if (!detail) {
                    setError(
                        "Lease details could not be loaded."
                    );
                    return;
                }

                setLeaseDetail(detail);
                setSignedAt(
                    toDateTimeLocal(
                        detail?.lifecycle
                            ?.signed_at
                    )
                );
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadLease();

        return () => {
            cancelled = true;
        };
    }, [
        open,
        lease?.public_id
    ]);

    if (!open || !lease) {
        return null;
    }

    const submit = async event => {
        event.preventDefault();

        if (!leaseDetail) {
            setError(
                "Lease details are not available."
            );
            return;
        }

        if (
            leaseDetail.status !== "draft"
        ) {
            setError(
                "Only draft leases can be scheduled."
            );
            return;
        }

        const existingSignedAt =
            leaseDetail?.lifecycle
                ?.signed_at || null;

        const payload = {};

        if (signedAt) {
            const normalizedSignedAt =
                toIsoTimestamp(signedAt);

            if (!normalizedSignedAt) {
                setError(
                    "Signed at must be a valid date and time."
                );
                return;
            }

            if (
                new Date(
                    normalizedSignedAt
                ).getTime() >
                Date.now()
            ) {
                setError(
                    "Lease signature timestamp cannot be in the future."
                );
                return;
            }

            payload.signed_at =
                normalizedSignedAt;
        } else if (!existingSignedAt) {
            setError(
                "Lease must be signed before it can be scheduled."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/leases/${leaseDetail.public_id}/schedule`,
                    payload
                );

            await onScheduled(
                response?.data?.data || {}
            );
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

    const owner =
        leaseDetail?.owner || null;
    const property =
        leaseDetail?.property || null;
    const unit =
        leaseDetail?.unit || null;
    const tenant =
        leaseDetail?.tenant || null;

    return (
        <div
            className="
                fixed inset-0 z-50
                flex items-center
                justify-center
                bg-slate-950/45
                p-4
                backdrop-blur-[2px]
            "
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-lease-title"
        >
            <div
                className="
                    max-h-[92vh]
                    w-full max-w-2xl
                    overflow-y-auto
                    rounded-3xl
                    border border-slate-200
                    bg-white
                    shadow-2xl
                "
            >
                <div
                    className="
                        sticky top-0 z-10
                        flex items-start
                        justify-between
                        gap-4
                        border-b
                        border-slate-200
                        bg-white
                        px-6 py-5
                    "
                >
                    <div>
                        <h2
                            id="schedule-lease-title"
                            className="
                                text-xl font-bold
                                text-slate-950
                            "
                        >
                            Schedule Lease
                        </h2>

                        <p
                            className="
                                mt-1 text-sm
                                text-slate-500
                            "
                        >
                            Move{" "}
                            <span className="font-medium">
                                {
                                    lease.lease_number
                                }
                            </span>{" "}
                            from Draft to Scheduled.
                        </p>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        onClick={onClose}
                        disabled={
                            submitting
                        }
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="p-6"
                >
                    <div
                        className="
                            mb-6 rounded-2xl
                            border border-violet-200
                            bg-violet-50
                            px-4 py-3
                            text-sm text-violet-800
                        "
                    >
                        Scheduling is a controlled
                        lifecycle action. The backend
                        will re-check owner, property,
                        unit, tenant relationship,
                        signature, start date and lease
                        conflicts before changing the
                        status.
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="
                                mb-6 rounded-2xl
                                border border-rose-200
                                bg-rose-50
                                px-4 py-3
                                text-sm text-rose-700
                            "
                        >
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div
                            className="
                                flex min-h-[220px]
                                items-center
                                justify-center
                                gap-2
                                text-sm
                                text-slate-500
                            "
                        >
                            <CalendarDays
                                className="
                                    h-4 w-4
                                    animate-pulse
                                "
                            />
                            Loading lease details...
                        </div>
                    ) : leaseDetail ? (
                        <div className="space-y-6">
                            <div
                                className="
                                    grid gap-4
                                    rounded-2xl
                                    border
                                    border-slate-200
                                    bg-slate-50/70
                                    p-4
                                    sm:grid-cols-2
                                "
                            >
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Owner
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {
                                            owner?.display_name ||
                                            "—"
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Tenant
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {
                                            tenant?.display_name ||
                                            "—"
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Property
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {
                                            property?.property_name ||
                                            "—"
                                        }
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {
                                            property?.property_code ||
                                            ""
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Unit
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {
                                            unit?.unit_name ||
                                            unit?.unit_code ||
                                            "—"
                                        }
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Status:{" "}
                                        {
                                            unit?.operational_status ||
                                            "—"
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Start Date
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {
                                            formatDate(
                                                leaseDetail.start_date
                                            )
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        End Date
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {
                                            formatDate(
                                                leaseDetail.end_date
                                            )
                                        }
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="schedule_signed_at"
                                    className="
                                        mb-2 block
                                        text-sm font-semibold
                                        text-slate-700
                                    "
                                >
                                    Signed At{" "}
                                    <span className="text-rose-500">
                                        *
                                    </span>
                                </label>

                                <input
                                    id="schedule_signed_at"
                                    type="datetime-local"
                                    value={signedAt}
                                    onChange={event => {
                                        setSignedAt(
                                            event.target.value
                                        );
                                        if (error) {
                                            setError("");
                                        }
                                    }}
                                    className={
                                        inputClass
                                    }
                                />

                                <p
                                    className="
                                        mt-2 text-xs
                                        text-slate-500
                                    "
                                >
                                    Current signature:{" "}
                                    {formatDateTime(
                                        leaseDetail
                                            ?.lifecycle
                                            ?.signed_at
                                    )}
                                </p>
                            </div>

                            <div
                                className="
                                    rounded-2xl
                                    border border-amber-200
                                    bg-amber-50
                                    px-4 py-3
                                    text-sm
                                    text-amber-800
                                "
                            >
                                If the selected unit is
                                currently Available, a
                                successful schedule action
                                will reserve it. Existing
                                Reserved or Occupied status
                                is preserved by the backend.
                            </div>
                        </div>
                    ) : null}

                    <div
                        className="
                            mt-7 flex
                            flex-col-reverse gap-2
                            border-t
                            border-slate-200
                            pt-5
                            sm:flex-row
                            sm:justify-end
                        "
                    >
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={
                                submitting
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={
                                CalendarDays
                            }
                            loading={
                                submitting
                            }
                            disabled={
                                loading ||
                                !leaseDetail
                            }
                        >
                            Schedule Lease
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ScheduleLeaseModal;
