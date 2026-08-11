import {
    Repeat2,
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

const BILLING_FREQUENCIES = [
    "monthly",
    "quarterly",
    "semi_annual",
    "annual"
];

const LATE_FEE_TYPES = [
    "none",
    "fixed",
    "percentage"
];

const emptyForm = () => ({
    start_date: "",
    end_date: "",
    currency_code: "",
    rent_amount: "",
    billing_frequency: "",
    payment_due_day: "",
    grace_period_days: "",
    security_deposit_amount: "",
    late_fee_type: "",
    late_fee_value: "",
    notes: ""
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
    "Unable to create lease renewal.";

const dateOnly = value => {
    if (!value) {
        return "";
    }

    return String(value).slice(0, 10);
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

function FieldLabel({
    htmlFor,
    required = false,
    children
}) {
    return (
        <label
            htmlFor={htmlFor}
            className="
                mb-2 block
                text-sm font-semibold
                text-slate-700
            "
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

const toForm = lease => {
    const financial =
        lease?.financial_terms || {};

    return {
        start_date: "",
        end_date: "",
        currency_code:
            financial.currency_code || "TZS",
        rent_amount:
            financial.rent_amount ?? "",
        billing_frequency:
            financial.billing_frequency ||
            "monthly",
        payment_due_day:
            financial.payment_due_day ?? 1,
        grace_period_days:
            financial.grace_period_days ?? 0,
        security_deposit_amount:
            financial.security_deposit_amount ??
            0,
        late_fee_type:
            financial.late_fee_type || "none",
        late_fee_value:
            financial.late_fee_value ?? 0,
        notes: ""
    };
};

function RenewLeaseModal({
    open,
    lease,
    onClose,
    onRenewed
}) {
    const [leaseDetail, setLeaseDetail] =
        useState(null);
    const [form, setForm] =
        useState(emptyForm);

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
                setForm(emptyForm());

                const response =
                    await apiClient.get(
                        `/leases/${lease.public_id}`
                    );

                if (cancelled) {
                    return;
                }

                const detail =
                    response?.data?.data
                        ?.lease || null;

                if (!detail) {
                    setError(
                        "Lease details could not be loaded."
                    );
                    return;
                }

                if (
                    ![
                        "active",
                        "expired"
                    ].includes(detail.status)
                ) {
                    setError(
                        "Only active or expired leases can be renewed."
                    );
                }

                setLeaseDetail(detail);
                setForm(toForm(detail));
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

    const update = (field, value) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));

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
                "active",
                "expired"
            ].includes(leaseDetail.status)
        ) {
            setError(
                "Only active or expired leases can be renewed."
            );
            return;
        }

        const sourceEndDate =
            dateOnly(leaseDetail.end_date);

        if (!form.start_date) {
            setError(
                "Renewal start date is required."
            );
            return;
        }

        if (!form.end_date) {
            setError(
                "Renewal end date is required."
            );
            return;
        }

        if (
            form.start_date <=
            sourceEndDate
        ) {
            setError(
                "Renewal start date must be after the source lease end date."
            );
            return;
        }

        if (
            form.end_date <=
            form.start_date
        ) {
            setError(
                "Renewal end date must be after the renewal start date."
            );
            return;
        }

        const currencyCode =
            String(
                form.currency_code || ""
            ).trim().toUpperCase();

        if (
            !/^[A-Z]{3}$/.test(
                currencyCode
            )
        ) {
            setError(
                "Currency code must contain exactly three uppercase letters."
            );
            return;
        }

        const rentAmount =
            Number(form.rent_amount);

        if (
            !Number.isFinite(rentAmount) ||
            rentAmount <= 0
        ) {
            setError(
                "Rent amount must be greater than zero."
            );
            return;
        }

        const paymentDueDay =
            Number(form.payment_due_day);

        if (
            !Number.isInteger(
                paymentDueDay
            ) ||
            paymentDueDay < 1 ||
            paymentDueDay > 28
        ) {
            setError(
                "Payment due day must be an integer between 1 and 28."
            );
            return;
        }

        const gracePeriodDays =
            Number(
                form.grace_period_days
            );

        if (
            !Number.isInteger(
                gracePeriodDays
            ) ||
            gracePeriodDays < 0 ||
            gracePeriodDays > 30
        ) {
            setError(
                "Grace period days must be an integer between 0 and 30."
            );
            return;
        }

        const securityDepositAmount =
            Number(
                form.security_deposit_amount
            );

        if (
            !Number.isFinite(
                securityDepositAmount
            ) ||
            securityDepositAmount < 0
        ) {
            setError(
                "Security deposit amount must be zero or greater."
            );
            return;
        }

        const lateFeeValue =
            Number(form.late_fee_value);

        if (
            !Number.isFinite(
                lateFeeValue
            ) ||
            lateFeeValue < 0
        ) {
            setError(
                "Late fee value must be zero or greater."
            );
            return;
        }

        if (
            form.late_fee_type ===
                "none" &&
            lateFeeValue !== 0
        ) {
            setError(
                "Late fee value must be zero when late fee type is none."
            );
            return;
        }

        if (
            (
                form.late_fee_type ===
                    "fixed" ||
                form.late_fee_type ===
                    "percentage"
            ) &&
            lateFeeValue <= 0
        ) {
            setError(
                "Late fee value must be greater than zero when a late fee is enabled."
            );
            return;
        }

        if (
            form.late_fee_type ===
                "percentage" &&
            lateFeeValue > 100
        ) {
            setError(
                "Percentage late fee cannot exceed 100."
            );
            return;
        }

        const notes =
            String(
                form.notes || ""
            ).trim();

        if (notes.length > 2000) {
            setError(
                "Notes cannot exceed 2000 characters."
            );
            return;
        }

        const payload = {
            start_date:
                form.start_date,
            end_date:
                form.end_date,
            currency_code:
                currencyCode,
            rent_amount:
                rentAmount,
            billing_frequency:
                form.billing_frequency,
            payment_due_day:
                paymentDueDay,
            grace_period_days:
                gracePeriodDays,
            security_deposit_amount:
                securityDepositAmount,
            late_fee_type:
                form.late_fee_type,
            late_fee_value:
                lateFeeValue,
            notes:
                notes || null
        };

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.post(
                    `/leases/${leaseDetail.public_id}/renew`,
                    payload
                );

            await onRenewed(
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

    const financial =
        leaseDetail?.financial_terms || {};

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
            aria-labelledby="renew-lease-title"
        >
            <div
                className="
                    max-h-[92vh]
                    w-full max-w-3xl
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
                            id="renew-lease-title"
                            className="
                                text-xl font-bold
                                text-slate-950
                            "
                        >
                            Renew Lease
                        </h2>

                        <p
                            className="
                                mt-1 text-sm
                                text-slate-500
                            "
                        >
                            Create a new draft lease
                            linked to the current lease.
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
                        <div className="space-y-6">
                            <div
                                className="
                                    rounded-2xl
                                    border border-blue-200
                                    bg-blue-50
                                    px-4 py-4
                                    text-sm
                                    text-blue-800
                                "
                            >
                                Renewal creates a
                                completely new
                                <strong>
                                    {" "}Draft lease
                                </strong>.
                                Owner, property, unit
                                and tenant are inherited
                                from the source lease and
                                cannot be changed here.
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
                                        Source Lease
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {leaseDetail.lease_number}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Source Status
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {humanize(
                                            leaseDetail.status
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Source End Date
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
                                        {leaseDetail.owner
                                            ?.display_name ||
                                            "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Property
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {leaseDetail.property
                                            ?.property_name ||
                                            leaseDetail.property
                                                ?.property_code ||
                                            "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Unit
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {leaseDetail.unit
                                            ?.unit_name ||
                                            leaseDetail.unit
                                                ?.unit_code ||
                                            "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Tenant
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {leaseDetail.tenant
                                            ?.display_name ||
                                            "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Current Rent
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {financial.currency_code ||
                                            ""}
                                        {" "}
                                        {financial.rent_amount ??
                                            "—"}
                                    </p>
                                </div>
                            </div>

                            <div
                                className="
                                    grid gap-5
                                    md:grid-cols-2
                                "
                            >
                                <div>
                                    <FieldLabel
                                        htmlFor="renew_start_date"
                                        required
                                    >
                                        Renewal Start Date
                                    </FieldLabel>

                                    <input
                                        id="renew_start_date"
                                        type="date"
                                        required
                                        min={
                                            leaseDetail.end_date
                                                ? dateOnly(
                                                    new Date(
                                                        new Date(
                                                            dateOnly(
                                                                leaseDetail.end_date
                                                            )
                                                        ).getTime() +
                                                        86400000
                                                    ).toISOString()
                                                )
                                                : undefined
                                        }
                                        value={
                                            form.start_date
                                        }
                                        onChange={event =>
                                            update(
                                                "start_date",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_end_date"
                                        required
                                    >
                                        Renewal End Date
                                    </FieldLabel>

                                    <input
                                        id="renew_end_date"
                                        type="date"
                                        required
                                        min={
                                            form.start_date ||
                                            undefined
                                        }
                                        value={
                                            form.end_date
                                        }
                                        onChange={event =>
                                            update(
                                                "end_date",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_currency_code"
                                        required
                                    >
                                        Currency
                                    </FieldLabel>

                                    <input
                                        id="renew_currency_code"
                                        required
                                        maxLength={3}
                                        value={
                                            form.currency_code
                                        }
                                        onChange={event =>
                                            update(
                                                "currency_code",
                                                event.target.value
                                                    .toUpperCase()
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_rent_amount"
                                        required
                                    >
                                        Rent Amount
                                    </FieldLabel>

                                    <input
                                        id="renew_rent_amount"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        required
                                        value={
                                            form.rent_amount
                                        }
                                        onChange={event =>
                                            update(
                                                "rent_amount",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_billing_frequency"
                                        required
                                    >
                                        Billing Frequency
                                    </FieldLabel>

                                    <select
                                        id="renew_billing_frequency"
                                        required
                                        value={
                                            form.billing_frequency
                                        }
                                        onChange={event =>
                                            update(
                                                "billing_frequency",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    >
                                        {BILLING_FREQUENCIES.map(
                                            item => (
                                                <option
                                                    key={item}
                                                    value={item}
                                                >
                                                    {humanize(
                                                        item
                                                    )}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_payment_due_day"
                                        required
                                    >
                                        Payment Due Day
                                    </FieldLabel>

                                    <input
                                        id="renew_payment_due_day"
                                        type="number"
                                        min="1"
                                        max="28"
                                        step="1"
                                        required
                                        value={
                                            form.payment_due_day
                                        }
                                        onChange={event =>
                                            update(
                                                "payment_due_day",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_grace_period_days"
                                        required
                                    >
                                        Grace Period Days
                                    </FieldLabel>

                                    <input
                                        id="renew_grace_period_days"
                                        type="number"
                                        min="0"
                                        max="30"
                                        step="1"
                                        required
                                        value={
                                            form.grace_period_days
                                        }
                                        onChange={event =>
                                            update(
                                                "grace_period_days",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_security_deposit"
                                        required
                                    >
                                        Security Deposit
                                    </FieldLabel>

                                    <input
                                        id="renew_security_deposit"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={
                                            form
                                                .security_deposit_amount
                                        }
                                        onChange={event =>
                                            update(
                                                "security_deposit_amount",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_late_fee_type"
                                        required
                                    >
                                        Late Fee Type
                                    </FieldLabel>

                                    <select
                                        id="renew_late_fee_type"
                                        required
                                        value={
                                            form.late_fee_type
                                        }
                                        onChange={event => {
                                            const value =
                                                event.target.value;

                                            setForm(current => ({
                                                ...current,
                                                late_fee_type:
                                                    value,
                                                late_fee_value:
                                                    value === "none"
                                                        ? "0"
                                                        : current
                                                            .late_fee_value
                                            }));

                                            if (error) {
                                                setError("");
                                            }
                                        }}
                                        className={
                                            inputClass
                                        }
                                    >
                                        {LATE_FEE_TYPES.map(
                                            item => (
                                                <option
                                                    key={item}
                                                    value={item}
                                                >
                                                    {humanize(
                                                        item
                                                    )}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="renew_late_fee_value"
                                        required
                                    >
                                        Late Fee Value
                                    </FieldLabel>

                                    <input
                                        id="renew_late_fee_value"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        disabled={
                                            form.late_fee_type ===
                                            "none"
                                        }
                                        value={
                                            form.late_fee_value
                                        }
                                        onChange={event =>
                                            update(
                                                "late_fee_value",
                                                event.target.value
                                            )
                                        }
                                        className={
                                            inputClass
                                        }
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <FieldLabel htmlFor="renew_notes">
                                        Renewal Notes
                                    </FieldLabel>

                                    <textarea
                                        id="renew_notes"
                                        rows="4"
                                        maxLength={2000}
                                        value={
                                            form.notes
                                        }
                                        onChange={event =>
                                            update(
                                                "notes",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional notes for the renewal draft"
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
                            leftIcon={Repeat2}
                            loading={submitting}
                            disabled={
                                loading ||
                                !leaseDetail
                            }
                        >
                            Create Renewal Draft
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RenewLeaseModal;
