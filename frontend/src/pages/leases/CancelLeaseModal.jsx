import {
    Ban,
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
    "Unable to cancel lease.";

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

function CancelLeaseModal({
    open,
    lease,
    onClose,
    onCancelled
}) {
    const [leaseDetail, setLeaseDetail] =
        useState(null);
    const [reason, setReason] =
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
                setReason("");
                setLeaseDetail(null);

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

    const updateReason = value => {
        setReason(value);

        if (error) {
            setError("");
        }
    };

    const submit = async event => {
        event.preventDefault();

        if (!leaseDetail) {
            setError(
                "Lease details are not available."
            );
            return;
        }

        if (
            ![
                "draft",
                "scheduled"
            ].includes(
                leaseDetail.status
            )
        ) {
            setError(
                "Only draft or scheduled leases can be cancelled."
            );
            return;
        }

        const cancellationReason =
            reason.trim();

        if (
            cancellationReason.length < 5 ||
            cancellationReason.length > 1000
        ) {
            setError(
                "Cancellation reason must contain between 5 and 1000 characters."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/leases/${leaseDetail.public_id}/cancel`,
                    {
                        cancellation_reason:
                            cancellationReason
                    }
                );

            await onCancelled(
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
            aria-labelledby="cancel-lease-title"
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
                            id="cancel-lease-title"
                            className="
                                text-xl font-bold
                                text-slate-950
                            "
                        >
                            Cancel Lease
                        </h2>

                        <p
                            className="
                                mt-1 text-sm
                                text-slate-500
                            "
                        >
                            Cancel{" "}
                            <span className="font-medium">
                                {lease.lease_number}
                            </span>{" "}
                            before it becomes an active lease.
                        </p>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        onClick={onClose}
                        disabled={submitting}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="p-6"
                >
                    <div
                        className="
                            mb-6 rounded-2xl
                            border border-rose-200
                            bg-rose-50
                            px-4 py-3
                            text-sm text-rose-800
                        "
                    >
                        Cancellation is a lifecycle action.
                        Only Draft or Scheduled leases can be
                        cancelled. The backend remains the
                        authority for permissions and lease
                        integrity checks.
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
                            <Ban
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
                                        Current Status
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {String(
                                            leaseDetail.status || "—"
                                        )
                                            .replaceAll("_", " ")
                                            .replace(/\b\w/g, c =>
                                                c.toUpperCase()
                                            )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Owner
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {owner?.display_name || "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Tenant
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {tenant?.display_name || "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Property / Unit
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {property?.property_name || "—"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {unit?.unit_name || unit?.unit_code || "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Start Date
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {formatDate(
                                            leaseDetail.start_date
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        End Date
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-slate-900">
                                        {formatDate(
                                            leaseDetail.end_date
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="lease_cancellation_reason"
                                    className="mb-2 block text-sm font-semibold text-slate-700"
                                >
                                    Cancellation Reason
                                    <span className="text-rose-500">
                                        {" "}*
                                    </span>
                                </label>

                                <textarea
                                    id="lease_cancellation_reason"
                                    required
                                    rows="5"
                                    minLength={5}
                                    maxLength={1000}
                                    value={reason}
                                    onChange={event =>
                                        updateReason(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Explain why this lease is being cancelled."
                                    className="
                                        w-full resize-y
                                        rounded-xl
                                        border border-slate-200
                                        bg-slate-50
                                        px-3.5 py-3
                                        text-sm text-slate-800
                                        outline-none transition
                                        focus:border-blue-500
                                        focus:bg-white
                                        focus:ring-4
                                        focus:ring-blue-100
                                    "
                                />

                                <p className="mt-1 text-xs text-slate-400">
                                    {reason.trim().length}/1000 characters
                                </p>
                            </div>

                            {leaseDetail.status === "scheduled" && (
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
                                    A scheduled lease may have reserved
                                    its unit. The backend will safely
                                    recalculate the unit status when this
                                    lease is cancelled.
                                </div>
                            )}
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
                            disabled={submitting}
                        >
                            Keep Lease
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={Ban}
                            loading={submitting}
                            disabled={
                                loading ||
                                !leaseDetail
                            }
                        >
                            Cancel Lease
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CancelLeaseModal;
