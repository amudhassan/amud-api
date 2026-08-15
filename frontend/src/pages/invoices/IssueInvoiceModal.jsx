import {
    AlertTriangle,
    CheckCircle2,
    FileCheck2,
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
    "Unable to issue the invoice.";

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

const localToday = () => {
    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
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

const formatMoney = (
    value,
    currencyCode
) => {
    const amount =
        Number(value);

    if (!Number.isFinite(amount)) {
        return "—";
    }

    const formatted =
        new Intl.NumberFormat(
            undefined,
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(amount);

    return currencyCode
        ? `${currencyCode} ${formatted}`
        : formatted;
};

function IssueInvoiceModal({
    open,
    invoice,
    onClose,
    onIssued
}) {
    const [
        issuing,
        setIssuing
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setIssuing(false);
        setError("");
    }, [
        open,
        invoice?.public_id
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !issuing
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
        issuing,
        onClose
    ]);

    const readiness =
        useMemo(() => {
            if (!invoice) {
                return {
                    eligible: false,
                    checks: []
                };
            }

            const items =
                Array.isArray(
                    invoice.items
                )
                    ? invoice.items
                    : [];

            const total =
                Number(
                    invoice
                        .financial_summary
                        ?.total_amount ??
                    invoice.total_amount ??
                    0
                );

            const paid =
                Number(
                    invoice
                        .financial_summary
                        ?.paid_amount ??
                    invoice.paid_amount ??
                    0
                );

            const balance =
                Number(
                    invoice
                        .financial_summary
                        ?.balance_amount ??
                    invoice.balance_amount ??
                    0
                );

            const dueDate =
                dateOnly(
                    invoice.due_date
                );

            const today =
                localToday();

            const checks = [
                {
                    label:
                        "Invoice is still in draft status",
                    ok:
                        invoice.status ===
                        "draft"
                },
                {
                    label:
                        "Invoice contains at least one item",
                    ok:
                        items.length > 0
                },
                {
                    label:
                        "Invoice total is greater than zero",
                    ok:
                        Number.isFinite(
                            total
                        ) &&
                        total > 0
                },
                {
                    label:
                        "No payment has been recorded",
                    ok:
                        Number.isFinite(
                            paid
                        ) &&
                        paid === 0
                },
                {
                    label:
                        "Balance equals the full invoice total",
                    ok:
                        Number.isFinite(
                            balance
                        ) &&
                        Number.isFinite(
                            total
                        ) &&
                        Math.abs(
                            balance -
                            total
                        ) < 0.005
                },
                {
                    label:
                        `Due date is not before ${formatDate(
                            today
                        )}`,
                    ok:
                        Boolean(
                            dueDate
                        ) &&
                        dueDate >=
                            today
                }
            ];

            return {
                eligible:
                    checks.every(
                        check =>
                            check.ok
                    ),
                checks,
                total,
                dueDate
            };
        }, [
            invoice
        ]);

    if (
        !open ||
        !invoice
    ) {
        return null;
    }

    const issueInvoice =
        async () => {
            if (
                !invoice.public_id
            ) {
                setError(
                    "Invoice identifier is missing."
                );
                return;
            }

            if (
                !readiness.eligible
            ) {
                setError(
                    "Resolve the failed readiness checks before issuing this invoice."
                );
                return;
            }

            try {
                setIssuing(true);
                setError("");

                const response =
                    await apiClient.patch(
                        `/invoices/${encodeURIComponent(
                            invoice.public_id
                        )}/issue`
                    );

                await onIssued?.(
                    response?.data?.data ||
                    {}
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
                setIssuing(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="issue-invoice-title"
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
                <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <FileCheck2 className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="issue-invoice-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Issue Invoice
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {invoice.invoice_number}
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close issue invoice"
                        icon={X}
                        disabled={issuing}
                        onClick={onClose}
                    />
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                    {error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Total
                            </p>

                            <p className="mt-1 text-lg font-bold text-slate-950">
                                {formatMoney(
                                    readiness.total,
                                    invoice.currency_code
                                )}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Due Date
                            </p>

                            <p className="mt-1 text-lg font-bold text-slate-950">
                                {formatDate(
                                    readiness.dueDate
                                )}
                            </p>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-slate-900">
                            Readiness Check
                        </p>

                        <div className="mt-3 space-y-2">
                            {readiness.checks.map(
                                check => (
                                    <div
                                        key={
                                            check.label
                                        }
                                        className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                                            check.ok
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                : "border-rose-200 bg-rose-50 text-rose-800"
                                        }`}
                                    >
                                        {check.ok
                                            ? (
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                            )
                                            : (
                                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            )}

                                        <span>
                                            {
                                                check.label
                                            }
                                        </span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                        Issuing moves this invoice out of draft status. Draft header fields and invoice items can no longer be edited afterward.
                    </div>
                </div>

                <div className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={issuing}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        leftIcon={FileCheck2}
                        disabled={
                            issuing ||
                            !readiness.eligible
                        }
                        onClick={issueInvoice}
                    >
                        {issuing
                            ? "Issuing..."
                            : "Issue Invoice"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default IssueInvoiceModal;
