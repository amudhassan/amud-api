import {
    FilePlus2,
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
    owner_public_id: "",
    property_public_id: "",
    unit_public_id: "",
    tenant_public_id: "",
    start_date: "",
    end_date: "",
    currency_code: "TZS",
    rent_amount: "",
    billing_frequency: "monthly",
    payment_due_day: "1",
    grace_period_days: "0",
    security_deposit_amount: "0",
    late_fee_type: "none",
    late_fee_value: "0",
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
    "Unable to create lease.";

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

function CreateLeaseModal({
    open,
    onClose,
    onCreated
}) {
    const [form, setForm] =
        useState(emptyForm);

    const [owners, setOwners] =
        useState([]);
    const [properties, setProperties] =
        useState([]);
    const [units, setUnits] =
        useState([]);
    const [tenants, setTenants] =
        useState([]);

    const [ownersLoading, setOwnersLoading] =
        useState(false);
    const [propertiesLoading, setPropertiesLoading] =
        useState(false);
    const [unitsLoading, setUnitsLoading] =
        useState(false);
    const [tenantsLoading, setTenantsLoading] =
        useState(false);

    const [submitting, setSubmitting] =
        useState(false);
    const [error, setError] =
        useState("");

    const selectedOwner =
        useMemo(
            () =>
                owners.find(
                    owner =>
                        owner.public_id ===
                        form.owner_public_id
                ) || null,
            [
                form.owner_public_id,
                owners
            ]
        );

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
        if (!open) {
            return;
        }

        let cancelled = false;

        const loadOwners = async () => {
            try {
                setOwnersLoading(true);
                setError("");

                const response =
                    await apiClient.get(
                        "/owners",
                        {
                            params: {
                                page: 1,
                                limit: 100,
                                status: "active"
                            }
                        }
                    );

                if (cancelled) {
                    return;
                }

                const rows =
                    Array.isArray(
                        response?.data?.data
                    )
                        ? response.data.data
                        : [];

                setOwners(
                    rows.filter(
                        owner =>
                            owner.status ===
                            "active"
                    )
                );
            } catch (requestError) {
                if (cancelled) {
                    return;
                }

                setOwners([]);
                setError(
                    errorMessage(
                        requestError
                    )
                );
            } finally {
                if (!cancelled) {
                    setOwnersLoading(false);
                }
            }
        };

        setForm(emptyForm());
        setProperties([]);
        setUnits([]);
        setTenants([]);
        setError("");
        loadOwners();

        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (
            !open ||
            !form.owner_public_id
        ) {
            setProperties([]);
            setTenants([]);
            return;
        }

        let cancelled = false;

        const loadOwnerContext = async () => {
            try {
                setPropertiesLoading(true);
                setTenantsLoading(true);
                setError("");

                const [
                    propertiesResponse,
                    tenantsResponse
                ] = await Promise.all([
                    apiClient.get(
                        "/properties",
                        {
                            params: {
                                owner_public_id:
                                    form.owner_public_id,
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
                                    form.owner_public_id,
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
                if (cancelled) {
                    return;
                }

                setProperties([]);
                setTenants([]);
                setError(
                    errorMessage(
                        requestError
                    )
                );
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
        form.owner_public_id,
        open
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
                setError("");

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
                if (cancelled) {
                    return;
                }

                setUnits([]);
                setError(
                    errorMessage(
                        requestError
                    )
                );
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

    if (!open) {
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

    const changeOwner = value => {
        setForm(current => ({
            ...current,
            owner_public_id: value,
            property_public_id: "",
            unit_public_id: "",
            tenant_public_id: ""
        }));
        setProperties([]);
        setUnits([]);
        setTenants([]);
        setError("");
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

    const submit = async event => {
        event.preventDefault();

        if (!form.owner_public_id) {
            setError(
                "Owner is required."
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
            form.currency_code
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

        const payload = {
            owner_public_id:
                form.owner_public_id,
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
                lateFeeValue
        };

        const notes =
            form.notes.trim();

        if (notes) {
            payload.notes = notes;
        }

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.post(
                    "/leases",
                    payload
                );

            await onCreated(
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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lease-title"
        >
            <div
                className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div
                    className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5"
                >
                    <div>
                        <h2
                            id="create-lease-title"
                            className="text-xl font-bold text-slate-950"
                        >
                            Create Draft Lease
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Select an authorized owner,
                            property, unit and active
                            tenant relationship.
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
                        className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800"
                    >
                        New leases start in{" "}
                        <strong>Draft</strong>{" "}
                        status. Scheduling and
                        activation remain separate
                        controlled lifecycle actions.
                    </div>

                    <div
                        className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800"
                    >
                        <strong>
                            Contract Terms &amp; Conditions:
                        </strong>{" "}
                        after this Draft is created,
                        the Terms &amp; Conditions manager
                        opens automatically so contractual
                        clauses can be completed before
                        scheduling.
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        >
                            {error}
                        </div>
                    )}

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <FieldLabel
                                htmlFor="lease_owner"
                                required
                            >
                                Owner
                            </FieldLabel>

                            <select
                                id="lease_owner"
                                required
                                value={
                                    form.owner_public_id
                                }
                                onChange={event =>
                                    changeOwner(
                                        event.target.value
                                    )
                                }
                                disabled={
                                    ownersLoading ||
                                    submitting
                                }
                                className={inputClass}
                            >
                                <option value="">
                                    {ownersLoading
                                        ? "Loading owners..."
                                        : "Select owner"}
                                </option>

                                {owners.map(
                                    owner => (
                                        <option
                                            key={
                                                owner.public_id
                                            }
                                            value={
                                                owner.public_id
                                            }
                                        >
                                            {
                                                owner.display_name
                                            }
                                            {" — "}
                                            {
                                                humanize(
                                                    owner.owner_type
                                                )
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_property"
                                required
                            >
                                Property
                            </FieldLabel>

                            <select
                                id="lease_property"
                                required
                                value={
                                    form.property_public_id
                                }
                                onChange={event =>
                                    changeProperty(
                                        event.target.value
                                    )
                                }
                                disabled={
                                    !form.owner_public_id ||
                                    propertiesLoading ||
                                    submitting
                                }
                                className={inputClass}
                            >
                                <option value="">
                                    {!form.owner_public_id
                                        ? "Select owner first"
                                        : propertiesLoading
                                          ? "Loading properties..."
                                          : properties.length === 0
                                            ? "No active properties available"
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
                                            }
                                            {" — "}
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
                                htmlFor="lease_unit"
                                required
                            >
                                Unit
                            </FieldLabel>

                            <select
                                id="lease_unit"
                                required
                                value={
                                    form.unit_public_id
                                }
                                onChange={event =>
                                    update(
                                        "unit_public_id",
                                        event.target.value
                                    )
                                }
                                disabled={
                                    !form.property_public_id ||
                                    unitsLoading ||
                                    submitting
                                }
                                className={inputClass}
                            >
                                <option value="">
                                    {!form.property_public_id
                                        ? "Select property first"
                                        : unitsLoading
                                          ? "Loading units..."
                                          : units.length === 0
                                            ? "No units available"
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
                                            {unit.unit_name ||
                                                unit.unit_code}
                                            {unit.unit_name
                                                ? ` — ${unit.unit_code}`
                                                : ""}
                                            {unit.operational_status
                                                ? ` (${humanize(unit.operational_status)})`
                                                : ""}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <FieldLabel
                                htmlFor="lease_tenant"
                                required
                            >
                                Tenant
                            </FieldLabel>

                            <select
                                id="lease_tenant"
                                required
                                value={
                                    form.tenant_public_id
                                }
                                onChange={event =>
                                    update(
                                        "tenant_public_id",
                                        event.target.value
                                    )
                                }
                                disabled={
                                    !form.owner_public_id ||
                                    tenantsLoading ||
                                    submitting
                                }
                                className={inputClass}
                            >
                                <option value="">
                                    {!form.owner_public_id
                                        ? "Select owner first"
                                        : tenantsLoading
                                          ? "Loading tenants..."
                                          : tenants.length === 0
                                            ? "No active tenant relationships available"
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
                                            {tenant.tenant_type
                                                ? ` — ${humanize(tenant.tenant_type)}`
                                                : ""}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        {selectedOwner && (
                            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                Owner context:{" "}
                                <span className="font-semibold text-slate-900">
                                    {
                                        selectedOwner.display_name
                                    }
                                </span>
                                {selectedProperty && (
                                    <>
                                        {" · Property: "}
                                        <span className="font-semibold text-slate-900">
                                            {
                                                selectedProperty.property_name
                                            }
                                        </span>
                                    </>
                                )}
                            </div>
                        )}

                        <div>
                            <FieldLabel
                                htmlFor="lease_start_date"
                                required
                            >
                                Start Date
                            </FieldLabel>

                            <input
                                id="lease_start_date"
                                type="date"
                                required
                                value={form.start_date}
                                onChange={event =>
                                    update(
                                        "start_date",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_end_date"
                                required
                            >
                                End Date
                            </FieldLabel>

                            <input
                                id="lease_end_date"
                                type="date"
                                required
                                min={
                                    form.start_date ||
                                    undefined
                                }
                                value={form.end_date}
                                onChange={event =>
                                    update(
                                        "end_date",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_currency"
                                required
                            >
                                Currency
                            </FieldLabel>

                            <input
                                id="lease_currency"
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
                                disabled={submitting}
                                placeholder="TZS"
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_rent_amount"
                                required
                            >
                                Rent Amount
                            </FieldLabel>

                            <input
                                id="lease_rent_amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                value={form.rent_amount}
                                onChange={event =>
                                    update(
                                        "rent_amount",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                placeholder="0.00"
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_billing_frequency"
                            >
                                Billing Frequency
                            </FieldLabel>

                            <select
                                id="lease_billing_frequency"
                                value={
                                    form.billing_frequency
                                }
                                onChange={event =>
                                    update(
                                        "billing_frequency",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                className={inputClass}
                            >
                                {BILLING_FREQUENCIES.map(
                                    frequency => (
                                        <option
                                            key={frequency}
                                            value={frequency}
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
                                htmlFor="lease_payment_due_day"
                            >
                                Payment Due Day
                            </FieldLabel>

                            <input
                                id="lease_payment_due_day"
                                type="number"
                                min="1"
                                max="28"
                                step="1"
                                value={
                                    form.payment_due_day
                                }
                                onChange={event =>
                                    update(
                                        "payment_due_day",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_grace_period"
                            >
                                Grace Period Days
                            </FieldLabel>

                            <input
                                id="lease_grace_period"
                                type="number"
                                min="0"
                                max="30"
                                step="1"
                                value={
                                    form.grace_period_days
                                }
                                onChange={event =>
                                    update(
                                        "grace_period_days",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_security_deposit"
                            >
                                Security Deposit
                            </FieldLabel>

                            <input
                                id="lease_security_deposit"
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                    form.security_deposit_amount
                                }
                                onChange={event =>
                                    update(
                                        "security_deposit_amount",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_late_fee_type"
                            >
                                Late Fee Type
                            </FieldLabel>

                            <select
                                id="lease_late_fee_type"
                                value={form.late_fee_type}
                                onChange={event => {
                                    const value =
                                        event.target.value;

                                    setForm(current => ({
                                        ...current,
                                        late_fee_type:
                                            value,
                                        late_fee_value:
                                            value ===
                                            "none"
                                                ? "0"
                                                : current
                                                    .late_fee_type ===
                                                  "none"
                                                  ? ""
                                                  : current
                                                    .late_fee_value
                                    }));
                                    setError("");
                                }}
                                disabled={submitting}
                                className={inputClass}
                            >
                                {LATE_FEE_TYPES.map(
                                    type => (
                                        <option
                                            key={type}
                                            value={type}
                                        >
                                            {humanize(type)}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="lease_late_fee_value"
                            >
                                Late Fee Value
                            </FieldLabel>

                            <input
                                id="lease_late_fee_value"
                                type="number"
                                min="0"
                                max={
                                    form.late_fee_type ===
                                    "percentage"
                                        ? "100"
                                        : undefined
                                }
                                step="0.01"
                                value={form.late_fee_value}
                                onChange={event =>
                                    update(
                                        "late_fee_value",
                                        event.target.value
                                    )
                                }
                                disabled={
                                    submitting ||
                                    form.late_fee_type ===
                                        "none"
                                }
                                className={inputClass}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <FieldLabel htmlFor="lease_notes">
                                Notes
                            </FieldLabel>

                            <textarea
                                id="lease_notes"
                                rows="4"
                                maxLength={2000}
                                value={form.notes}
                                onChange={event =>
                                    update(
                                        "notes",
                                        event.target.value
                                    )
                                }
                                disabled={submitting}
                                placeholder="Optional internal lease notes"
                                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </div>
                    </div>

                    <div className="mt-4 text-xs text-slate-400">
                        {contextLoading
                            ? "Loading owner lease context..."
                            : "Only backend-authorized records are selectable. Final lease integrity is enforced by the server."}
                    </div>

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
                            leftIcon={FilePlus2}
                            loading={submitting}
                            disabled={
                                ownersLoading ||
                                contextLoading ||
                                unitsLoading
                            }
                        >
                            Create Draft Lease
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateLeaseModal;
