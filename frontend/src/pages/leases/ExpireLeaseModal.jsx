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
    "Unable to expire lease.";

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

function ExpireLeaseModal({
    open,
    lease,
    onClose,
    onExpired
}) {
    const [leaseDetail, setLeaseDetail] =
        useState(null);
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

    const submit = async event => {
        event.preventDefault();

        if (!leaseDetail) {
            setError(
                "Lease details are not available."
            );
            return;
        }

        if (
            leaseDetail.status !==
            "active"
        ) {
            setError(
                "Only active leases can be expired."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/leases/${leaseDetail.public_id}/expire`,
                    {}
                );

            await onExpired(
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
            aria-labelledby="expire-lease-title"
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
                            id="expire-lease-title"
                            className="
                                text-xl font-bold
                                text-slate-950
                            "
                        >
                            Expire Lease
                        </h2>

                        <p
                            className="
                                mt-1 text-sm
                                text-slate-500
                            "
                        >
                            Close an active lease after
                            its contractual end date has
                            passed.
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
                                flex min-h-48
                                items-center
                                justify-center
                                text-sm
                                text-slate-500
                            "
                        >
                            Loading lease details...
                        </div>
                    ) : leaseDetail ? (
                        <div className="space-y-5">
                            <div
                                className="
                                    rounded-2xl
                                    border border-amber-200
                                    bg-amber-50
                                    px-4 py-4
                                    text-sm
                                    text-amber-800
                                "
                            >
                                Expiry is allowed only
                                when the lease is still
                                active and its end date
                                has already passed.
                                The backend remains the
                                final authority for this
                                lifecycle transition.
                            </div>

                            <div
                                className="
                                    grid gap-4
                                    rounded-2xl
                                    border border-slate-200
                                    bg-slate-50
                                    p-4
                                    sm:grid-cols-2
                                "
                            >
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Lease
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {leaseDetail.lease_number}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Status
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {leaseDetail.status}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Start Date
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {formatDate(
                                            leaseDetail.start_date
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        End Date
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {formatDate(
                                            leaseDetail.end_date
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Owner
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {owner?.display_name || "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Tenant
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {tenant?.display_name || "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Property
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {property?.property_name ||
                                            property?.property_code ||
                                            "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Unit
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {unit?.unit_name ||
                                            unit?.unit_code ||
                                            "—"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="
                                rounded-2xl
                                border border-slate-200
                                bg-slate-50
                                px-4 py-6
                                text-sm text-slate-500
                            "
                        >
                            Lease details are not
                            available.
                        </div>
                    )}

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
                            variant="secondary"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={CalendarDays}
                            loading={submitting}
                            disabled={
                                loading ||
                                !leaseDetail
                            }
                        >
                            Confirm Expiry
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ExpireLeaseModal;
