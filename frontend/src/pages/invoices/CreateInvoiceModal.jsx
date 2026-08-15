import {
    FilePlus2,
    RefreshCw,
    Search,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

const ELIGIBLE_LEASE_STATUSES = [
    "scheduled",
    "active",
    "expired",
    "terminated"
];

const emptyForm = () => ({
    lease_public_id: "",
    billing_period_start: "",
    billing_period_end: "",
    due_date: "",
    currency_code: "",
    notes: ""
});

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

const errorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to create draft invoice.";

const formatDate = value => {
    if (!value) {
        return "—";
    }

    return String(value).slice(0, 10);
};

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

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

function CreateInvoiceModal({
    open,
    onClose,
    onCreated
}) {
    const [
        form,
        setForm
    ] = useState(emptyForm);

    const [
        leases,
        setLeases
    ] = useState([]);

    const [
        leaseSearch,
        setLeaseSearch
    ] = useState("");

    const [
        loadingLeases,
        setLoadingLeases
    ] = useState(false);

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const selectedLease =
        useMemo(
            () =>
                leases.find(
                    lease =>
                        lease.public_id ===
                        form.lease_public_id
                ) || null,
            [
                leases,
                form.lease_public_id
            ]
        );

    const loadEligibleLeases =
        useCallback(
            async () => {
                if (!open) {
                    return;
                }

                try {
                    setLoadingLeases(true);
                    setError("");

                    const search =
                        leaseSearch.trim();

                    const responses =
                        await Promise.all(
                            ELIGIBLE_LEASE_STATUSES.map(
                                status =>
                                    apiClient.get(
                                        "/leases",
                                        {
                                            params: {
                                                status,
                                                page: 1,
                                                limit: 100,
                                                ...(search
                                                    ? {
                                                        search
                                                    }
                                                    : {})
                                            }
                                        }
                                    )
                            )
                        );

                    const byPublicId =
                        new Map();

                    for (
                        const response
                        of responses
                    ) {
                        const rows =
                            Array.isArray(
                                response?.data
                                    ?.data
                                    ?.leases
                            )
                                ? response
                                    .data
                                    .data
                                    .leases
                                : [];

                        for (
                            const lease
                            of rows
                        ) {
                            if (
                                lease
                                    ?.public_id
                            ) {
                                byPublicId.set(
                                    lease
                                        .public_id,
                                    lease
                                );
                            }
                        }
                    }

                    const nextLeases =
                        Array.from(
                            byPublicId
                                .values()
                        ).sort(
                            (
                                first,
                                second
                            ) =>
                                String(
                                    first
                                        .lease_number ||
                                        ""
                                ).localeCompare(
                                    String(
                                        second
                                            .lease_number ||
                                            ""
                                    )
                                )
                        );

                    setLeases(
                        nextLeases
                    );

                    if (
                        form
                            .lease_public_id &&
                        !byPublicId.has(
                            form
                                .lease_public_id
                        )
                    ) {
                        setForm(
                            current => ({
                                ...current,
                                lease_public_id:
                                    ""
                            })
                        );
                    }
                } catch (
                    requestError
                ) {
                    setLeases([]);
                    setError(
                        errorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoadingLeases(
                        false
                    );
                }
            },
            [
                open,
                leaseSearch,
                form.lease_public_id
            ]
        );

    useEffect(() => {
        if (open) {
            setForm(
                emptyForm()
            );
            setLeaseSearch("");
            setLeases([]);
            setError("");
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            loadEligibleLeases();
        }
    }, [
        open,
        loadEligibleLeases
    ]);

    if (!open) {
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

    const selectLease =
        value => {
            const lease =
                leases.find(
                    item =>
                        item.public_id ===
                        value
                ) || null;

            setForm(
                current => ({
                    ...current,
                    lease_public_id:
                        value,
                    currency_code:
                        current
                            .currency_code ||
                        lease
                            ?.currency_code ||
                        ""
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
                !form
                    .lease_public_id
            ) {
                setError(
                    "Lease is required."
                );
                return;
            }

            if (
                !form
                    .billing_period_start
            ) {
                setError(
                    "Billing period start is required."
                );
                return;
            }

            if (
                !form
                    .billing_period_end
            ) {
                setError(
                    "Billing period end is required."
                );
                return;
            }

            if (
                form
                    .billing_period_end <
                form
                    .billing_period_start
            ) {
                setError(
                    "Billing period end cannot be before the billing period start."
                );
                return;
            }

            if (!form.due_date) {
                setError(
                    "Invoice due date is required."
                );
                return;
            }

            if (
                form.due_date <
                form
                    .billing_period_start
            ) {
                setError(
                    "Invoice due date cannot be before the billing period start."
                );
                return;
            }

            const currencyCode =
                form
                    .currency_code
                    .trim()
                    .toUpperCase();

            if (
                currencyCode &&
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
                lease_public_id:
                    form
                        .lease_public_id,
                billing_period_start:
                    form
                        .billing_period_start,
                billing_period_end:
                    form
                        .billing_period_end,
                due_date:
                    form.due_date
            };

            if (currencyCode) {
                payload.currency_code =
                    currencyCode;
            }

            const notes =
                form.notes.trim();

            if (notes) {
                payload.notes =
                    notes;
            }

            try {
                setSubmitting(true);
                setError("");

                const response =
                    await apiClient.post(
                        "/invoices",
                        payload
                    );

                await onCreated(
                    response?.data
                        ?.data || {}
                );
            } catch (
                requestError
            ) {
                setError(
                    errorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(
                    false
                );
            }
        };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-invoice-title"
        >
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <FilePlus2 className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="create-invoice-title"
                                className="text-xl font-bold text-slate-950"
                            >
                                Create Draft Invoice
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Select an eligible lease and define the billing period. Charges are added as invoice items after the draft is created.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close create invoice"
                        icon={X}
                        disabled={submitting}
                        onClick={onClose}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="p-5 sm:p-6"
                >
                    {error && (
                        <div
                            role="alert"
                            className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        >
                            {error}
                        </div>
                    )}

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <FieldLabel htmlFor="invoice_lease_search">
                                    Find Lease
                                </FieldLabel>

                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                                    <input
                                        id="invoice_lease_search"
                                        type="search"
                                        value={
                                            leaseSearch
                                        }
                                        onChange={
                                            event =>
                                                setLeaseSearch(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        placeholder="Search lease, tenant or property"
                                        className={`${inputClass} pl-10`}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RefreshCw}
                                loading={
                                    loadingLeases
                                }
                                onClick={
                                    loadEligibleLeases
                                }
                            >
                                Search Leases
                            </Button>
                        </div>

                        <div className="mt-4">
                            <FieldLabel
                                htmlFor="lease_public_id"
                                required
                            >
                                Eligible Lease
                            </FieldLabel>

                            <select
                                id="lease_public_id"
                                value={
                                    form
                                        .lease_public_id
                                }
                                onChange={
                                    event =>
                                        selectLease(
                                            event
                                                .target
                                                .value
                                        )
                                }
                                disabled={
                                    loadingLeases
                                }
                                className={
                                    inputClass
                                }
                            >
                                <option value="">
                                    {loadingLeases
                                        ? "Loading eligible leases..."
                                        : leases.length
                                            ? "Select a lease"
                                            : "No eligible leases found"}
                                </option>

                                {leases.map(
                                    lease => (
                                        <option
                                            key={
                                                lease.public_id
                                            }
                                            value={
                                                lease.public_id
                                            }
                                        >
                                            {[
                                                lease
                                                    .lease_number,
                                                lease
                                                    .tenant
                                                    ?.display_name,
                                                lease
                                                    .property
                                                    ?.property_name,
                                                lease
                                                    .unit
                                                    ?.unit_name ||
                                                    lease
                                                        .unit
                                                        ?.unit_code
                                            ]
                                                .filter(
                                                    Boolean
                                                )
                                                .join(
                                                    " · "
                                                )}
                                        </option>
                                    )
                                )}
                            </select>

                            <p className="mt-2 text-xs text-slate-500">
                                Eligible lifecycle statuses: Scheduled, Active, Expired and Terminated.
                            </p>
                        </div>
                    </section>

                    {selectedLease && (
                        <section className="mt-4 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-medium text-slate-500">
                                    Tenant
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {selectedLease
                                        .tenant
                                        ?.display_name ||
                                        "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-slate-500">
                                    Owner
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {selectedLease
                                        .owner
                                        ?.display_name ||
                                        "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-slate-500">
                                    Property / Unit
                                </p>
                                <p className="mt-1 text-sm text-slate-800">
                                    {[
                                        selectedLease
                                            .property
                                            ?.property_name,
                                        selectedLease
                                            .unit
                                            ?.unit_name ||
                                            selectedLease
                                                .unit
                                                ?.unit_code
                                    ]
                                        .filter(
                                            Boolean
                                        )
                                        .join(
                                            " · "
                                        ) ||
                                        "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-slate-500">
                                    Lease
                                </p>
                                <p className="mt-1 text-sm text-slate-800">
                                    {selectedLease
                                        .lease_number ||
                                        "—"}{" "}
                                    ·{" "}
                                    {formatLabel(
                                        selectedLease
                                            .status
                                    )}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {formatDate(
                                        selectedLease
                                            .start_date
                                    )}{" "}
                                    to{" "}
                                    {formatDate(
                                        selectedLease
                                            .end_date
                                    )}
                                </p>
                            </div>
                        </section>
                    )}

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div>
                            <FieldLabel
                                htmlFor="billing_period_start"
                                required
                            >
                                Billing Period Start
                            </FieldLabel>

                            <input
                                id="billing_period_start"
                                type="date"
                                value={
                                    form
                                        .billing_period_start
                                }
                                max={
                                    form
                                        .billing_period_end ||
                                    undefined
                                }
                                onChange={
                                    event =>
                                        update(
                                            "billing_period_start",
                                            event
                                                .target
                                                .value
                                        )
                                }
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="billing_period_end"
                                required
                            >
                                Billing Period End
                            </FieldLabel>

                            <input
                                id="billing_period_end"
                                type="date"
                                value={
                                    form
                                        .billing_period_end
                                }
                                min={
                                    form
                                        .billing_period_start ||
                                    undefined
                                }
                                onChange={
                                    event =>
                                        update(
                                            "billing_period_end",
                                            event
                                                .target
                                                .value
                                        )
                                }
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="invoice_due_date"
                                required
                            >
                                Due Date
                            </FieldLabel>

                            <input
                                id="invoice_due_date"
                                type="date"
                                value={
                                    form
                                        .due_date
                                }
                                min={
                                    form
                                        .billing_period_start ||
                                    undefined
                                }
                                onChange={
                                    event =>
                                        update(
                                            "due_date",
                                            event
                                                .target
                                                .value
                                        )
                                }
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel htmlFor="invoice_currency_code">
                                Currency Code
                            </FieldLabel>

                            <input
                                id="invoice_currency_code"
                                type="text"
                                inputMode="text"
                                maxLength={3}
                                value={
                                    form
                                        .currency_code
                                }
                                onChange={
                                    event =>
                                        update(
                                            "currency_code",
                                            event
                                                .target
                                                .value
                                                .toUpperCase()
                                        )
                                }
                                placeholder={
                                    selectedLease
                                        ?.currency_code ||
                                    "Lease currency"
                                }
                                className={
                                    inputClass
                                }
                            />

                            <p className="mt-2 text-xs text-slate-500">
                                Optional. Leave blank to use the lease currency.
                            </p>
                        </div>

                        <div className="md:col-span-2">
                            <FieldLabel htmlFor="invoice_notes">
                                Notes
                            </FieldLabel>

                            <textarea
                                id="invoice_notes"
                                rows="4"
                                maxLength={2000}
                                value={
                                    form.notes
                                }
                                onChange={
                                    event =>
                                        update(
                                            "notes",
                                            event
                                                .target
                                                .value
                                        )
                                }
                                placeholder="Optional invoice notes"
                                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {form.notes.length}/2000
                            </p>
                        </div>
                    </div>

                    <div className="mt-7 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
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
                            leftIcon={FilePlus2}
                            loading={
                                submitting
                            }
                        >
                            Create Draft Invoice
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateInvoiceModal;
