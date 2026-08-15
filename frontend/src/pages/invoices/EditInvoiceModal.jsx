import {
    CalendarDays,
    Pencil,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to update the draft invoice.";

const dateOnly = value => {
    if (!value) {
        return "";
    }

    const stringValue =
        String(value);

    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            stringValue
        )
    ) {
        return stringValue;
    }

    const parsed =
        new Date(stringValue);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return stringValue.slice(
            0,
            10
        );
    }

    const year =
        parsed.getFullYear();

    const month =
        String(
            parsed.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            parsed.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatDate = value => {
    const normalized =
        dateOnly(value);

    if (!normalized) {
        return "—";
    }

    const parsed =
        new Date(
            `${normalized}T00:00:00`
        );

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return normalized;
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit"
        }
    ).format(parsed);
};

function EditInvoiceModal({
    open,
    invoice,
    onClose,
    onUpdated
}) {
    const [
        dueDate,
        setDueDate
    ] = useState("");

    const [
        currencyCode,
        setCurrencyCode
    ] = useState("");

    const [
        notes,
        setNotes
    ] = useState("");

    const [
        saving,
        setSaving
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (
            !open ||
            !invoice
        ) {
            return;
        }

        setDueDate(
            dateOnly(invoice.due_date)
        );

        setCurrencyCode(
            String(
                invoice.currency_code ||
                ""
            ).toUpperCase()
        );

        setNotes(
            invoice.notes || ""
        );

        setSaving(false);
        setError("");
    }, [
        open,
        invoice
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !saving
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
        open,
        saving,
        onClose
    ]);

    const billingStart =
        dateOnly(
            invoice?.billing_period_start
        );

    const originalDueDate =
        dateOnly(invoice?.due_date);

    const originalCurrencyCode =
        String(
            invoice?.currency_code ||
            ""
        ).toUpperCase();

    const originalNotes =
        invoice?.notes || "";

    const normalizedCurrency =
        currencyCode
            .trim()
            .toUpperCase();

    const normalizedNotes =
        notes.trim();

    const changedFields =
        useMemo(() => {
            const payload = {};

            if (
                dueDate !==
                originalDueDate
            ) {
                payload.due_date =
                    dueDate;
            }

            if (
                normalizedCurrency !==
                originalCurrencyCode
            ) {
                payload.currency_code =
                    normalizedCurrency;
            }

            if (
                normalizedNotes !==
                originalNotes
            ) {
                payload.notes =
                    normalizedNotes ||
                    null;
            }

            return payload;
        }, [
            dueDate,
            originalDueDate,
            normalizedCurrency,
            originalCurrencyCode,
            normalizedNotes,
            originalNotes
        ]);

    const hasChanges =
        Object.keys(
            changedFields
        ).length > 0;

    const submit = async event => {
        event.preventDefault();

        if (
            !invoice?.public_id
        ) {
            setError(
                "Invoice identifier is missing."
            );
            return;
        }

        if (
            !dueDate ||
            !/^\d{4}-\d{2}-\d{2}$/.test(
                dueDate
            )
        ) {
            setError(
                "Enter a valid due date."
            );
            return;
        }

        if (
            billingStart &&
            dueDate <
                billingStart
        ) {
            setError(
                "Due date cannot be before the billing period start."
            );
            return;
        }

        if (
            !/^[A-Z]{3}$/.test(
                normalizedCurrency
            )
        ) {
            setError(
                "Currency code must contain exactly three uppercase letters."
            );
            return;
        }

        if (
            notes.length > 2000
        ) {
            setError(
                "Notes cannot exceed 2000 characters."
            );
            return;
        }

        if (!hasChanges) {
            setError(
                "Change at least one invoice field before saving."
            );
            return;
        }

        try {
            setSaving(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/invoices/${encodeURIComponent(
                        invoice.public_id
                    )}`,
                    changedFields
                );

            await onUpdated?.(
                response?.data?.data || {}
            );
        } catch (
            requestError
        ) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setSaving(false);
        }
    };

    if (
        !open ||
        !invoice
    ) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-invoice-title"
                className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h2
                            id="edit-invoice-title"
                            className="text-lg font-bold text-slate-950"
                        >
                            Edit Draft Invoice
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            {invoice.invoice_number}
                        </p>
                    </div>

                    <IconButton
                        label="Close edit invoice"
                        icon={X}
                        disabled={saving}
                        onClick={onClose}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="overflow-y-auto px-5 py-5 sm:px-6">
                        {error && (
                            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-blue-600" />

                                <p className="text-sm font-semibold text-slate-900">
                                    Billing Period
                                </p>
                            </div>

                            <p className="mt-2 text-sm text-slate-700">
                                {formatDate(
                                    invoice.billing_period_start
                                )}{" "}
                                →{" "}
                                {formatDate(
                                    invoice.billing_period_end
                                )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Billing period is fixed after draft creation. Edit only due date, currency and notes here.
                            </p>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-semibold text-slate-800">
                                    Due Date
                                </span>

                                <input
                                    type="date"
                                    value={dueDate}
                                    min={
                                        billingStart ||
                                        undefined
                                    }
                                    onChange={event =>
                                        setDueDate(
                                            event.target.value
                                        )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    required
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold text-slate-800">
                                    Currency Code
                                </span>

                                <input
                                    type="text"
                                    value={currencyCode}
                                    maxLength={3}
                                    onChange={event =>
                                        setCurrencyCode(
                                            event.target.value
                                                .replace(
                                                    /[^A-Za-z]/g,
                                                    ""
                                                )
                                                .toUpperCase()
                                        )
                                    }
                                    placeholder="TZS"
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    required
                                />

                                <p className="mt-1 text-xs text-slate-500">
                                    Exactly three uppercase letters.
                                </p>
                            </label>
                        </div>

                        <label className="mt-5 block">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-slate-800">
                                    Notes
                                </span>

                                <span className="text-xs text-slate-400">
                                    {notes.length}/2000
                                </span>
                            </div>

                            <textarea
                                value={notes}
                                maxLength={2000}
                                rows={5}
                                onChange={event =>
                                    setNotes(
                                        event.target.value
                                    )
                                }
                                placeholder="Optional invoice notes"
                                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={saving}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={Pencil}
                            disabled={
                                saving ||
                                !hasChanges
                            }
                        >
                            {saving
                                ? "Saving..."
                                : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditInvoiceModal;
