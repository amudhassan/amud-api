import {
    PencilLine,
    RefreshCw,
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
    property_public_id: "",
    unit_public_id: "",
    tenant_public_id: "",
    start_date: "",
    end_date: "",
    signed_at: "",
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

const errorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to update lease.";

const dateOnly = value => {
    if (!value) {
        return "";
    }

    return String(value).slice(0, 10);
};

const toDateTimeLocal = value => {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const pad = number =>
        String(number).padStart(2, "0");

    return [
        date.getFullYear(),
        "-",
        pad(date.getMonth() + 1),
        "-",
        pad(date.getDate()),
        "T",
        pad(date.getHours()),
        ":",
        pad(date.getMinutes())
    ].join("");
};

const normalizeTimestamp = value => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
};

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

const toForm = lease => {
    const financial =
        lease?.financial_terms || {};

    return {
        property_public_id:
            lease?.property?.public_id || "",
        unit_public_id:
            lease?.unit?.public_id || "",
        tenant_public_id:
            lease?.tenant?.public_id || "",
        start_date:
            dateOnly(lease?.start_date),
        end_date:
            dateOnly(lease?.end_date),
        signed_at:
            toDateTimeLocal(
                lease?.lifecycle?.signed_at
            ),
        currency_code:
            financial.currency_code || "",
        rent_amount:
            financial.rent_amount ?? "",
        billing_frequency:
            financial.billing_frequency || "",
        payment_due_day:
            financial.payment_due_day ?? "",
        grace_period_days:
            financial.grace_period_days ?? "",
        security_deposit_amount:
            financial.security_deposit_amount ?? "",
        late_fee_type:
            financial.late_fee_type || "",
        late_fee_value:
            financial.late_fee_value ?? "",
        notes:
            lease?.notes || ""
    };
};

const currentValues = lease => {
    const financial =
        lease?.financial_terms || {};

    return {
        property_public_id:
            lease?.property?.public_id || "",
        unit_public_id:
            lease?.unit?.public_id || "",
        tenant_public_id:
            lease?.tenant?.public_id || "",
        start_date:
            dateOnly(lease?.start_date),
        end_date:
            dateOnly(lease?.end_date),
        signed_at:
            normalizeTimestamp(
                lease?.lifecycle?.signed_at
            ),
        currency_code:
            String(
                financial.currency_code || ""
            ).trim(),
        rent_amount:
            Number(financial.rent_amount),
        billing_frequency:
            financial.billing_frequency || "",
        payment_due_day:
            Number(financial.payment_due_day),
        grace_period_days:
            Number(
                financial.grace_period_days
            ),
        security_deposit_amount:
            Number(
                financial
                    .security_deposit_amount
            ),
        late_fee_type:
            financial.late_fee_type || "",
        late_fee_value:
            Number(financial.late_fee_value),
        notes:
            String(lease?.notes || "")
                .trim() || null
    };
};

function EditLeaseModal({
    open,
    lease,
    onClose,
    onUpdated
}) {
    const [leaseDetail, setLeaseDetail] =
        useState(null);
    const [form, setForm] =
        useState(emptyForm);

    const [properties, setProperties] =
        useState([]);
    const [units, setUnits] =
        useState([]);
    const [tenants, setTenants] =
        useState([]);

    const [
        leaseLoading,
        setLeaseLoading
    ] = useState(false);
    const [
        propertiesLoading,
        setPropertiesLoading
    ] = useState(false);
    const [
        unitsLoading,
        setUnitsLoading
    ] = useState(false);
    const [
        tenantsLoading,
        setTenantsLoading
    ] = useState(false);
    const [submitting, setSubmitting] =
        useState(false);
    const [error, setError] =
        useState("");

    const ownerPublicId =
        leaseDetail?.owner?.public_id || "";

    const selectedProperty =
        useMemo(
            () =>
                properties.find(
                    property =>
                        property.public_id ===
                        form.property_public_id
                ) || null,
            [
                form.property_public_id,
                properties
            ]
        );

    useEffect(() => {
        if (
            !open ||
            !lease?.public_id
        ) {
            return;
        }

        let cancelled = false;

        const loadLease = async () => {
            try {
                setLeaseLoading(true);
                setError("");
                setLeaseDetail(null);
                setForm(emptyForm());
                setProperties([]);
                setUnits([]);
                setTenants([]);

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
                    detail.status !== "draft"
                ) {
                    setError(
                        "Only draft leases can be edited."
                    );
                }

                setLeaseDetail(detail);
                setForm(toForm(detail));
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        errorMessage(
                            requestError
                        )
                    );
                }
            } finally {
                if (!cancelled) {
                    setLeaseLoading(false);
                }
            }
        };

        loadLease();

        return () => {
            cancelled = true;
        };
    }, [
        lease?.public_id,
        open
    ]);

    useEffect(() => {
        if (
            !open ||
            !ownerPublicId
        ) {
            return;
        }

        let cancelled = false;

        const loadOwnerContext = async () => {
            try {
                setPropertiesLoading(true);
                setTenantsLoading(true);

                const [
                    propertiesResponse,
                    tenantsResponse
                ] = await Promise.all([
                    apiClient.get(
                        "/properties",
                        {
                            params: {
                                owner_public_id:
                                    ownerPublicId,
                                page: 1,
                                limit: 100
                            }
                        }
                    ),
                    apiClient.get(
                        "/tenants",
                        {
                            params: {
                                owner_public_id:
                                    ownerPublicId,
                                status: "active",
                                relationship_status:
                                    "active",
                                page: 1,
                                limit: 100
                            }
                        }
                    )
                ]);

                if (cancelled) {
                    return;
                }

                const propertyRows =
                    Array.isArray(
                        propertiesResponse
                            ?.data?.data
                            ?.properties
                    )
                        ? propertiesResponse
                            .data.data
                            .properties
                        : [];

                const tenantRows =
                    Array.isArray(
                        tenantsResponse
                            ?.data?.data
                            ?.tenants
                    )
                        ? tenantsResponse
                            .data.data
                            .tenants
                        : [];

                setProperties(
                    propertyRows.filter(
                        property =>
                            property
                                .operational_status ===
                            "active"
                    )
                );

                setTenants(
                    tenantRows.filter(
                        tenant =>
                            tenant.status ===
                                "active" &&
                            tenant
                                .owner_relationship
                                ?.relationship_status ===
                                "active"
                    )
                );
            } catch (requestError) {
                if (!cancelled) {
                    setProperties([]);
                    setTenants([]);
                    setError(
                        errorMessage(
                            requestError
                        )
                    );
                }
            } finally {
                if (!cancelled) {
                    setPropertiesLoading(false);
                    setTenantsLoading(false);
                }
            }
        };

        loadOwnerContext();

        return () => {
            cancelled = true;
        };
    }, [
        open,
        ownerPublicId
    ]);

    useEffect(() => {
        if (
            !open ||
            !form.property_public_id
        ) {
            setUnits([]);
            return;
        }

        let cancelled = false;

        const loadUnits = async () => {
            try {
                setUnitsLoading(true);

                const response =
                    await apiClient.get(
                        `/properties/${form.property_public_id}/units`,
                        {
                            params: {
                                page: 1,
                                limit: 100
                            }
                        }
                    );

                if (cancelled) {
                    return;
                }

                const payload =
                    response?.data?.data &&
                    (
                        response.data.data
                            .units ||
                        response.data.data
                            .property
                    )
                        ? response.data.data
                        : response?.data || {};

                setUnits(
                    Array.isArray(
                        payload.units
                    )
                        ? payload.units
                        : []
                );
            } catch (requestError) {
                if (!cancelled) {
                    setUnits([]);
                    setError(
                        errorMessage(
                            requestError
                        )
                    );
                }
            } finally {
                if (!cancelled) {
                    setUnitsLoading(false);
                }
            }
        };

        loadUnits();

        return () => {
            cancelled = true;
        };
    }, [
        form.property_public_id,
        open
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

    const changeProperty = value => {
        setForm(current => ({
            ...current,
            property_public_id: value,
            unit_public_id: ""
        }));
        setUnits([]);
        setError("");
    };

    const changeLateFeeType = value => {
        setForm(current => ({
            ...current,
            late_fee_type: value,
            late_fee_value:
                value === "none"
                    ? "0"
                    : current.late_fee_type ===
                        "none"
                        ? ""
                        : current
                            .late_fee_value
        }));
        setError("");
    };

    const submit = async event => {
        event.preventDefault();

        if (
            !leaseDetail ||
            leaseDetail.status !== "draft"
        ) {
            setError(
                "Only draft leases can be edited."
            );
            return;
        }

        if (
            !leaseDetail.financial_terms
        ) {
            setError(
                "Financial terms are not available for this lease, so it cannot be edited from this form."
            );
            return;
        }

        if (!form.property_public_id) {
            setError(
                "Property is required."
            );
            return;
        }

        if (!form.unit_public_id) {
            setError(
                "Unit is required."
            );
            return;
        }

        if (!form.tenant_public_id) {
            setError(
                "Tenant is required."
            );
            return;
        }

        if (!form.start_date) {
            setError(
                "Lease start date is required."
            );
            return;
        }

        if (!form.end_date) {
            setError(
                "Lease end date is required."
            );
            return;
        }

        if (
            form.end_date <=
            form.start_date
        ) {
            setError(
                "Lease end date must be after the start date."
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
                "Payment due day must be between 1 and 28."
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
                "Grace period must be between 0 and 30 days."
            );
            return;
        }

        const securityDepositAmount =
            Number(
                form
                    .security_deposit_amount ||
                0
            );

        if (
            !Number.isFinite(
                securityDepositAmount
            ) ||
            securityDepositAmount < 0
        ) {
            setError(
                "Security deposit must be zero or greater."
            );
            return;
        }

        const lateFeeValue =
            Number(
                form.late_fee_value || 0
            );

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
                "Late fee value must be zero when late fee type is None."
            );
            return;
        }

        if (
            form.late_fee_type !==
                "none" &&
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

        const currencyCode =
            String(
                form.currency_code || ""
            )
                .trim()
                .toUpperCase();

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

        const signedAt =
            form.signed_at
                ? normalizeTimestamp(
                    form.signed_at
                )
                : null;

        if (
            form.signed_at &&
            !signedAt
        ) {
            setError(
                "Signed at must be a valid date and time."
            );
            return;
        }

        const candidate = {
            property_public_id:
                form.property_public_id,
            unit_public_id:
                form.unit_public_id,
            tenant_public_id:
                form.tenant_public_id,
            start_date:
                form.start_date,
            end_date:
                form.end_date,
            signed_at:
                signedAt,
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
                String(
                    form.notes || ""
                ).trim() || null
        };

        const current =
            currentValues(
                leaseDetail
            );

        const payload = {};

        for (
            const [
                field,
                value
            ] of Object.entries(
                candidate
            )
        ) {
            if (
                value !==
                current[field]
            ) {
                payload[field] =
                    value;
            }
        }

        if (
            Object.keys(payload)
                .length === 0
        ) {
            setError(
                "No changes were made."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/leases/${leaseDetail.public_id}`,
                    payload
                );

            await onUpdated(
                response?.data?.data ||
                null
            );
        } catch (requestError) {
            setError(
                errorMessage(
                    requestError
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    const contextLoading =
        propertiesLoading ||
        tenantsLoading;

    const formDisabled =
        leaseLoading ||
        submitting ||
        !leaseDetail ||
        leaseDetail.status !== "draft" ||
        !leaseDetail.financial_terms;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-lease-title"
        >
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div>
                        <h2
                            id="edit-lease-title"
                            className="text-xl font-bold text-slate-950"
                        >
                            Edit Draft Lease
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Update editable draft terms
                            for{" "}
                            <span className="font-medium">
                                {lease.lease_number}
                            </span>.
                        </p>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        onClick={onClose}
                        disabled={submitting}
                    />
                </div>

                {leaseLoading ? (
                    <div className="flex min-h-[360px] items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading lease details...
                    </div>
                ) : (
                    <form
                        onSubmit={submit}
                        className="p-6"
                    >
                        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Only a lease in{" "}
                            <strong>Draft</strong>{" "}
                            status can be edited.
                            The lease owner is fixed;
                            property, unit, tenant and
                            draft terms remain subject
                            to backend authorization
                            and integrity checks.
                        </div>

                        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
                            <strong>
                                Contract Terms &amp; Conditions:
                            </strong>{" "}
                            after saving these core Draft
                            details, the Terms &amp; Conditions
                            manager opens automatically so
                            contractual clauses can be reviewed
                            before the lease is scheduled.
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                            >
                                {error}
                            </div>
                        )}

                        {leaseDetail && (
                            <div className="mb-6 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                        Lease Owner
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {leaseDetail.owner?.display_name || "—"}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                        Lease Number
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {leaseDetail.lease_number}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-5 md:grid-cols-2">
                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_property"
                                    required
                                >
                                    Property
                                </FieldLabel>

                                <select
                                    id="edit_lease_property"
                                    required
                                    disabled={
                                        formDisabled ||
                                        propertiesLoading
                                    }
                                    value={
                                        form.property_public_id
                                    }
                                    onChange={event =>
                                        changeProperty(
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                >
                                    <option value="">
                                        {propertiesLoading
                                            ? "Loading properties..."
                                            : "Select property"}
                                    </option>

                                    {properties.map(
                                        property => (
                                            <option
                                                key={
                                                    property.public_id
                                                }
                                                value={
                                                    property.public_id
                                                }
                                            >
                                                {
                                                    property.property_name
                                                }{" "}
                                                —{" "}
                                                {
                                                    property.property_code
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_unit"
                                    required
                                >
                                    Unit
                                </FieldLabel>

                                <select
                                    id="edit_lease_unit"
                                    required
                                    disabled={
                                        formDisabled ||
                                        !form.property_public_id ||
                                        unitsLoading
                                    }
                                    value={
                                        form.unit_public_id
                                    }
                                    onChange={event =>
                                        update(
                                            "unit_public_id",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                >
                                    <option value="">
                                        {unitsLoading
                                            ? "Loading units..."
                                            : "Select unit"}
                                    </option>

                                    {units.map(
                                        unit => (
                                            <option
                                                key={
                                                    unit.public_id
                                                }
                                                value={
                                                    unit.public_id
                                                }
                                            >
                                                {
                                                    unit.unit_name ||
                                                    unit.unit_code
                                                }
                                                {unit.unit_name
                                                    ? ` — ${unit.unit_code}`
                                                    : ""}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <FieldLabel
                                    htmlFor="edit_lease_tenant"
                                    required
                                >
                                    Tenant
                                </FieldLabel>

                                <select
                                    id="edit_lease_tenant"
                                    required
                                    disabled={
                                        formDisabled ||
                                        tenantsLoading
                                    }
                                    value={
                                        form.tenant_public_id
                                    }
                                    onChange={event =>
                                        update(
                                            "tenant_public_id",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                >
                                    <option value="">
                                        {tenantsLoading
                                            ? "Loading tenants..."
                                            : "Select tenant"}
                                    </option>

                                    {tenants.map(
                                        tenant => (
                                            <option
                                                key={
                                                    tenant.public_id
                                                }
                                                value={
                                                    tenant.public_id
                                                }
                                            >
                                                {
                                                    tenant.display_name
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_start_date"
                                    required
                                >
                                    Start Date
                                </FieldLabel>

                                <input
                                    id="edit_lease_start_date"
                                    type="date"
                                    required
                                    disabled={formDisabled}
                                    value={
                                        form.start_date
                                    }
                                    onChange={event =>
                                        update(
                                            "start_date",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_end_date"
                                    required
                                >
                                    End Date
                                </FieldLabel>

                                <input
                                    id="edit_lease_end_date"
                                    type="date"
                                    required
                                    min={
                                        form.start_date ||
                                        undefined
                                    }
                                    disabled={formDisabled}
                                    value={
                                        form.end_date
                                    }
                                    onChange={event =>
                                        update(
                                            "end_date",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <FieldLabel htmlFor="edit_lease_signed_at">
                                    Signed At
                                </FieldLabel>

                                <input
                                    id="edit_lease_signed_at"
                                    type="datetime-local"
                                    disabled={formDisabled}
                                    value={
                                        form.signed_at
                                    }
                                    onChange={event =>
                                        update(
                                            "signed_at",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                />

                                <p className="mt-1.5 text-xs text-slate-500">
                                    Optional. Clear this
                                    field to return the
                                    draft signature time
                                    to null.
                                </p>
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_currency"
                                    required
                                >
                                    Currency Code
                                </FieldLabel>

                                <input
                                    id="edit_lease_currency"
                                    required
                                    maxLength={3}
                                    disabled={formDisabled}
                                    value={
                                        form.currency_code
                                    }
                                    onChange={event =>
                                        update(
                                            "currency_code",
                                            event.target.value.toUpperCase()
                                        )
                                    }
                                    placeholder="TZS"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_rent"
                                    required
                                >
                                    Rent Amount
                                </FieldLabel>

                                <input
                                    id="edit_lease_rent"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    disabled={formDisabled}
                                    value={
                                        form.rent_amount
                                    }
                                    onChange={event =>
                                        update(
                                            "rent_amount",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_billing_frequency"
                                    required
                                >
                                    Billing Frequency
                                </FieldLabel>

                                <select
                                    id="edit_lease_billing_frequency"
                                    required
                                    disabled={formDisabled}
                                    value={
                                        form.billing_frequency
                                    }
                                    onChange={event =>
                                        update(
                                            "billing_frequency",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                >
                                    {BILLING_FREQUENCIES.map(
                                        frequency => (
                                            <option
                                                key={
                                                    frequency
                                                }
                                                value={
                                                    frequency
                                                }
                                            >
                                                {humanize(
                                                    frequency
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_due_day"
                                    required
                                >
                                    Payment Due Day
                                </FieldLabel>

                                <input
                                    id="edit_lease_due_day"
                                    type="number"
                                    min="1"
                                    max="28"
                                    step="1"
                                    required
                                    disabled={formDisabled}
                                    value={
                                        form.payment_due_day
                                    }
                                    onChange={event =>
                                        update(
                                            "payment_due_day",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_grace_days"
                                    required
                                >
                                    Grace Period Days
                                </FieldLabel>

                                <input
                                    id="edit_lease_grace_days"
                                    type="number"
                                    min="0"
                                    max="30"
                                    step="1"
                                    required
                                    disabled={formDisabled}
                                    value={
                                        form.grace_period_days
                                    }
                                    onChange={event =>
                                        update(
                                            "grace_period_days",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_deposit"
                                    required
                                >
                                    Security Deposit
                                </FieldLabel>

                                <input
                                    id="edit_lease_deposit"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    disabled={formDisabled}
                                    value={
                                        form.security_deposit_amount
                                    }
                                    onChange={event =>
                                        update(
                                            "security_deposit_amount",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_late_fee_type"
                                    required
                                >
                                    Late Fee Type
                                </FieldLabel>

                                <select
                                    id="edit_lease_late_fee_type"
                                    required
                                    disabled={formDisabled}
                                    value={
                                        form.late_fee_type
                                    }
                                    onChange={event =>
                                        changeLateFeeType(
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                >
                                    {LATE_FEE_TYPES.map(
                                        type => (
                                            <option
                                                key={type}
                                                value={type}
                                            >
                                                {humanize(
                                                    type
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div>
                                <FieldLabel
                                    htmlFor="edit_lease_late_fee_value"
                                    required
                                >
                                    Late Fee Value
                                </FieldLabel>

                                <input
                                    id="edit_lease_late_fee_value"
                                    type="number"
                                    min="0"
                                    max={
                                        form.late_fee_type ===
                                        "percentage"
                                            ? "100"
                                            : undefined
                                    }
                                    step="0.01"
                                    required
                                    disabled={
                                        formDisabled ||
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
                                    className={inputClass}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <FieldLabel htmlFor="edit_lease_notes">
                                    Notes
                                </FieldLabel>

                                <textarea
                                    id="edit_lease_notes"
                                    rows="4"
                                    maxLength={2000}
                                    disabled={formDisabled}
                                    value={
                                        form.notes
                                    }
                                    onChange={event =>
                                        update(
                                            "notes",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Optional internal lease notes"
                                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>
                        </div>

                        {selectedProperty && (
                            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                Selected property:{" "}
                                <span className="font-semibold text-slate-700">
                                    {
                                        selectedProperty.property_name
                                    }
                                </span>
                                {" "}· owner remains{" "}
                                <span className="font-semibold text-slate-700">
                                    {
                                        leaseDetail?.owner?.display_name ||
                                        "—"
                                    }
                                </span>
                            </div>
                        )}

                        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onClose}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="submit"
                                leftIcon={PencilLine}
                                loading={submitting}
                                disabled={
                                    formDisabled ||
                                    contextLoading ||
                                    unitsLoading
                                }
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default EditLeaseModal;
