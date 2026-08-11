import {
    Eye,
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
    "Unable to load lease details.";

const humanize = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

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

const formatMoney = (
    value,
    currencyCode
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return String(value);
    }

    try {
        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency:
                    currencyCode ||
                    "TZS",
                maximumFractionDigits: 2
            }
        ).format(amount);
    } catch {
        return `${currencyCode || ""} ${amount.toLocaleString()}`.trim();
    }
};

function DataItem({
    label,
    value,
    mono = false
}) {
    return (
        <div>
            <p
                className="
                    text-xs font-semibold
                    uppercase tracking-wide
                    text-slate-400
                "
            >
                {label}
            </p>

            <p
                className={`
                    mt-1 break-words
                    text-sm text-slate-800
                    ${mono
                        ? "font-mono text-xs"
                        : ""
                    }
                `}
            >
                {value ?? "—"}
            </p>
        </div>
    );
}

function Section({
    title,
    children
}) {
    return (
        <section
            className="
                rounded-2xl
                border border-slate-200
                bg-white p-5
            "
        >
            <h3
                className="
                    mb-4 text-sm
                    font-bold text-slate-900
                "
            >
                {title}
            </h3>

            {children}
        </section>
    );
}

function LeaseDetailModal({
    open,
    lease,
    onClose
}) {
    const [detail, setDetail] =
        useState(null);
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");
    const [clauses, setClauses] =
        useState([]);
    const [clausesLoading, setClausesLoading] =
        useState(false);
    const [clausesError, setClausesError] =
        useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (
                !open ||
                !lease?.public_id
            ) {
                return;
            }

            try {
                setLoading(true);
                setError("");
                setDetail(null);
                setClauses([]);
                setClausesError("");

                const response =
                    await apiClient.get(
                        `/leases/${lease.public_id}`
                    );

                if (cancelled) {
                    return;
                }

                const fetchedLease =
                    response?.data?.data
                        ?.lease || null;

                if (!fetchedLease) {
                    setError(
                        "Lease details could not be loaded."
                    );
                    return;
                }

                setDetail(
                    fetchedLease
                );

                try {
                    setClausesLoading(true);
                    setClausesError("");

                    const clausesResponse =
                        await apiClient.get(
                            `/leases/${lease.public_id}/clauses`
                        );

                    if (cancelled) {
                        return;
                    }

                    const clauseRows =
                        clausesResponse?.data?.data
                            ?.clauses;

                    setClauses(
                        Array.isArray(clauseRows)
                            ? clauseRows
                            : []
                    );
                } catch (clausesRequestError) {
                    if (!cancelled) {
                        setClauses([]);
                        setClausesError(
                            getErrorMessage(
                                clausesRequestError
                            )
                        );
                    }
                } finally {
                    if (!cancelled) {
                        setClausesLoading(false);
                    }
                }
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

        load();

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

    const finance =
        detail?.financial_terms || null;

    const lifecycle =
        detail?.lifecycle || {};

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
            aria-labelledby="lease-detail-title"
        >
            <div
                className="
                    max-h-[92vh]
                    w-full max-w-4xl
                    overflow-y-auto
                    rounded-3xl
                    border border-slate-200
                    bg-slate-50
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
                        <div
                            className="
                                flex items-center
                                gap-2
                            "
                        >
                            <Eye
                                className="
                                    h-5 w-5
                                    text-blue-600
                                "
                            />

                            <h2
                                id="lease-detail-title"
                                className="
                                    text-xl font-bold
                                    text-slate-950
                                "
                            >
                                Lease Details
                            </h2>
                        </div>

                        <p
                            className="
                                mt-1 text-sm
                                text-slate-500
                            "
                        >
                            Complete lease,
                            relationship, financial
                            and lifecycle information
                            permitted for your access.
                        </p>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        onClick={onClose}
                        disabled={loading}
                    />
                </div>

                <div className="p-6">
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
                                flex min-h-64
                                items-center
                                justify-center
                                text-sm
                                text-slate-500
                            "
                        >
                            Loading lease details...
                        </div>
                    ) : detail ? (
                        <div
                            className="
                                space-y-5
                            "
                        >
                            <Section title="Lease Overview">
                                <div
                                    className="
                                        grid gap-5
                                        sm:grid-cols-2
                                        lg:grid-cols-4
                                    "
                                >
                                    <DataItem
                                        label="Lease Number"
                                        value={
                                            detail
                                                .lease_number
                                        }
                                    />

                                    <DataItem
                                        label="Status"
                                        value={humanize(
                                            detail.status
                                        )}
                                    />

                                    <DataItem
                                        label="Start Date"
                                        value={formatDate(
                                            detail.start_date
                                        )}
                                    />

                                    <DataItem
                                        label="End Date"
                                        value={formatDate(
                                            detail.end_date
                                        )}
                                    />

                                    <div className="sm:col-span-2 lg:col-span-4">
                                        <DataItem
                                            label="Public ID"
                                            value={
                                                detail.public_id
                                            }
                                            mono
                                        />
                                    </div>

                                    {detail
                                        .renewed_from_lease_public_id && (
                                        <div className="sm:col-span-2 lg:col-span-4">
                                            <DataItem
                                                label="Renewed From Lease"
                                                value={
                                                    detail
                                                        .renewed_from_lease_public_id
                                                }
                                                mono
                                            />
                                        </div>
                                    )}
                                </div>
                            </Section>

                            <Section title="Parties & Rental Context">
                                <div
                                    className="
                                        grid gap-5
                                        sm:grid-cols-2
                                        lg:grid-cols-4
                                    "
                                >
                                    <DataItem
                                        label="Owner"
                                        value={
                                            detail.owner
                                                ?.display_name ||
                                            "—"
                                        }
                                    />

                                    <DataItem
                                        label="Owner Type"
                                        value={humanize(
                                            detail.owner
                                                ?.owner_type
                                        )}
                                    />

                                    <DataItem
                                        label="Owner Status"
                                        value={humanize(
                                            detail.owner
                                                ?.status
                                        )}
                                    />

                                    <DataItem
                                        label="Owner Public ID"
                                        value={
                                            detail.owner
                                                ?.public_id ||
                                            "—"
                                        }
                                        mono
                                    />

                                    <DataItem
                                        label="Tenant"
                                        value={
                                            detail.tenant
                                                ?.display_name ||
                                            "—"
                                        }
                                    />

                                    <DataItem
                                        label="Tenant Type"
                                        value={humanize(
                                            detail.tenant
                                                ?.tenant_type
                                        )}
                                    />

                                    <DataItem
                                        label="Tenant Status"
                                        value={humanize(
                                            detail.tenant
                                                ?.status
                                        )}
                                    />

                                    <DataItem
                                        label="Tenant Public ID"
                                        value={
                                            detail.tenant
                                                ?.public_id ||
                                            "—"
                                        }
                                        mono
                                    />

                                    <DataItem
                                        label="Property"
                                        value={
                                            detail.property
                                                ?.property_name ||
                                            detail.property
                                                ?.property_code ||
                                            "—"
                                        }
                                    />

                                    <DataItem
                                        label="Property Code"
                                        value={
                                            detail.property
                                                ?.property_code ||
                                            "—"
                                        }
                                    />

                                    <DataItem
                                        label="Property Status"
                                        value={humanize(
                                            detail.property
                                                ?.operational_status
                                        )}
                                    />

                                    <DataItem
                                        label="Property Public ID"
                                        value={
                                            detail.property
                                                ?.public_id ||
                                            "—"
                                        }
                                        mono
                                    />

                                    <DataItem
                                        label="Unit"
                                        value={
                                            detail.unit
                                                ?.unit_name ||
                                            detail.unit
                                                ?.unit_code ||
                                            "—"
                                        }
                                    />

                                    <DataItem
                                        label="Unit Code"
                                        value={
                                            detail.unit
                                                ?.unit_code ||
                                            "—"
                                        }
                                    />

                                    <DataItem
                                        label="Unit Type"
                                        value={humanize(
                                            detail.unit
                                                ?.unit_type
                                        )}
                                    />

                                    <DataItem
                                        label="Unit Status"
                                        value={humanize(
                                            detail.unit
                                                ?.operational_status
                                        )}
                                    />
                                </div>
                            </Section>

                            <Section title="Financial Terms">
                                {detail
                                    .can_view_finances &&
                                finance ? (
                                    <div
                                        className="
                                            grid gap-5
                                            sm:grid-cols-2
                                            lg:grid-cols-4
                                        "
                                    >
                                        <DataItem
                                            label="Rent Amount"
                                            value={formatMoney(
                                                finance.rent_amount,
                                                finance.currency_code
                                            )}
                                        />

                                        <DataItem
                                            label="Currency"
                                            value={
                                                finance
                                                    .currency_code
                                            }
                                        />

                                        <DataItem
                                            label="Billing Frequency"
                                            value={humanize(
                                                finance
                                                    .billing_frequency
                                            )}
                                        />

                                        <DataItem
                                            label="Payment Due Day"
                                            value={
                                                finance
                                                    .payment_due_day
                                            }
                                        />

                                        <DataItem
                                            label="Grace Period"
                                            value={
                                                `${finance
                                                    .grace_period_days} day(s)`
                                            }
                                        />

                                        <DataItem
                                            label="Security Deposit"
                                            value={formatMoney(
                                                finance
                                                    .security_deposit_amount,
                                                finance
                                                    .currency_code
                                            )}
                                        />

                                        <DataItem
                                            label="Late Fee Type"
                                            value={humanize(
                                                finance
                                                    .late_fee_type
                                            )}
                                        />

                                        <DataItem
                                            label="Late Fee Value"
                                            value={
                                                finance
                                                    .late_fee_type ===
                                                "percentage"
                                                    ? `${finance
                                                        .late_fee_value}%`
                                                    : formatMoney(
                                                        finance
                                                            .late_fee_value,
                                                        finance
                                                            .currency_code
                                                    )
                                            }
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="
                                            rounded-xl
                                            border border-slate-200
                                            bg-slate-50
                                            px-4 py-3
                                            text-sm
                                            text-slate-600
                                        "
                                    >
                                        Financial terms are
                                        restricted for this
                                        user.
                                    </div>
                                )}
                            </Section>

                            <Section title="Contract Terms & Conditions">
                                {clausesLoading ? (
                                    <div className="flex min-h-[120px] items-center justify-center gap-2 text-sm text-slate-500">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                                        Loading contractual clauses...
                                    </div>
                                ) : clausesError ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        {clausesError}
                                    </div>
                                ) : clauses.length === 0 ? (
                                    <p className="text-sm text-slate-500">
                                        No active contractual clauses are recorded for this lease.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {clauses.map(
                                            clause => (
                                                <article
                                                    key={clause.public_id}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                                >
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

                                                    <h4 className="mt-3 text-sm font-bold text-slate-900">
                                                        {clause.title}
                                                    </h4>

                                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                                        {clause.clause_text}
                                                    </p>
                                                </article>
                                            )
                                        )}
                                    </div>
                                )}
                            </Section>

                            <Section title="Lifecycle History">
                                <div
                                    className="
                                        grid gap-5
                                        sm:grid-cols-2
                                        lg:grid-cols-4
                                    "
                                >
                                    <DataItem
                                        label="Signed At"
                                        value={formatDateTime(
                                            lifecycle
                                                .signed_at
                                        )}
                                    />

                                    <DataItem
                                        label="Scheduled At"
                                        value={formatDateTime(
                                            lifecycle
                                                .scheduled_at
                                        )}
                                    />

                                    <DataItem
                                        label="Activated At"
                                        value={formatDateTime(
                                            lifecycle
                                                .activated_at
                                        )}
                                    />

                                    <DataItem
                                        label="Expired At"
                                        value={formatDateTime(
                                            lifecycle
                                                .expired_at
                                        )}
                                    />

                                    <DataItem
                                        label="Terminated At"
                                        value={formatDateTime(
                                            lifecycle
                                                .terminated_at
                                        )}
                                    />

                                    <DataItem
                                        label="Cancelled At"
                                        value={formatDateTime(
                                            lifecycle
                                                .cancelled_at
                                        )}
                                    />

                                    {lifecycle
                                        .termination_reason && (
                                        <div className="sm:col-span-2 lg:col-span-4">
                                            <DataItem
                                                label="Termination Reason"
                                                value={
                                                    lifecycle
                                                        .termination_reason
                                                }
                                            />
                                        </div>
                                    )}

                                    {lifecycle
                                        .cancellation_reason && (
                                        <div className="sm:col-span-2 lg:col-span-4">
                                            <DataItem
                                                label="Cancellation Reason"
                                                value={
                                                    lifecycle
                                                        .cancellation_reason
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            </Section>

                            <Section title="Notes & Audit">
                                <div
                                    className="
                                        grid gap-5
                                        sm:grid-cols-2
                                    "
                                >
                                    <div className="sm:col-span-2">
                                        <DataItem
                                            label="Internal Notes"
                                            value={
                                                detail.notes ||
                                                "No notes available."
                                            }
                                        />
                                    </div>

                                    <DataItem
                                        label="Created At"
                                        value={formatDateTime(
                                            detail.created_at
                                        )}
                                    />

                                    <DataItem
                                        label="Updated At"
                                        value={formatDateTime(
                                            detail.updated_at
                                        )}
                                    />
                                </div>
                            </Section>
                        </div>
                    ) : (
                        <div
                            className="
                                rounded-2xl
                                border border-slate-200
                                bg-white
                                px-4 py-6
                                text-sm
                                text-slate-500
                            "
                        >
                            Lease details are not
                            available.
                        </div>
                    )}

                    <div
                        className="
                            mt-7 flex
                            justify-end
                            border-t
                            border-slate-200
                            pt-5
                        "
                    >
                        <Button
                            variant="secondary"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LeaseDetailModal;
