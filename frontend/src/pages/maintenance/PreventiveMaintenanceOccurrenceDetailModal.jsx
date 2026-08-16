import {
    CalendarClock,
    RefreshCw,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import { Button } from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load preventive maintenance occurrence.";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character => character.toUpperCase());

const formatDateTime = value => {
    if (!value) return "—";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }).format(parsed);
};

const statusClassName = status => {
    switch (status) {
        case "pending":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "generated":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "skipped":
            return "border-slate-200 bg-slate-100 text-slate-700";
        case "failed":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "cancelled":
            return "border-red-200 bg-red-50 text-red-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

function DetailItem({ label, value, wide = false }) {
    return (
        <div className={wide ? "sm:col-span-2" : ""}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <div className="mt-1.5 break-words text-sm font-medium leading-6 text-slate-900">
                {value ?? "—"}
            </div>
        </div>
    );
}

function PreventiveMaintenanceOccurrenceDetailModal({
    open,
    planPublicId,
    occurrencePublicId,
    isAdmin = false,
    onClose
}) {
    const [occurrence, setOccurrence] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const loadOccurrence = useCallback(async () => {
        if (!open || !planPublicId || !occurrencePublicId) return;

        try {
            setLoading(true);
            setError("");
            setOccurrence(null);

            const params = {};
            if (!isAdmin) {
                params.access_context = "owner";
            }

            const response = await apiClient.get(
                `/maintenance/preventive-plans/${encodeURIComponent(
                    planPublicId
                )}/occurrences/${encodeURIComponent(
                    occurrencePublicId
                )}`,
                { params }
            );

            setOccurrence(
                response?.data?.data?.preventive_occurrence || null
            );
        } catch (requestError) {
            setOccurrence(null);
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [isAdmin, occurrencePublicId, open, planPublicId]);

    useEffect(() => {
        if (open) {
            loadOccurrence();
        } else {
            setOccurrence(null);
            setError("");
        }
    }, [loadOccurrence, open]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = event => {
            if (event.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () =>
            window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <CalendarClock className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-lg font-bold text-slate-950">
                                Preventive Occurrence Detail
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Permanent occurrence schedule and generation record.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-14 text-center text-sm text-slate-500">
                            Loading preventive occurrence...
                        </div>
                    ) : !occurrence ? (
                        <div className="py-12 text-center">
                            <p className="font-semibold text-slate-800">
                                Occurrence detail is unavailable.
                            </p>
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RefreshCw}
                                className="mt-4"
                                onClick={loadOccurrence}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Occurrence Public ID
                                    </p>
                                    <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
                                        {occurrence.public_id}
                                    </p>
                                </div>

                                <span
                                    className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusClassName(
                                        occurrence.status
                                    )}`}
                                >
                                    {formatLabel(occurrence.status)}
                                </span>
                            </div>

                            <div className="mt-5 grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:grid-cols-2">
                                <DetailItem
                                    label="Due At"
                                    value={formatDateTime(occurrence.due_at)}
                                />
                                <DetailItem
                                    label="Status"
                                    value={formatLabel(occurrence.status)}
                                />
                                <DetailItem
                                    label="Generation Attempted At"
                                    value={formatDateTime(
                                        occurrence.generation_attempted_at
                                    )}
                                />
                                <DetailItem
                                    label="Generated At"
                                    value={formatDateTime(
                                        occurrence.generated_at
                                    )}
                                />
                                <DetailItem
                                    label="Created At"
                                    value={formatDateTime(occurrence.created_at)}
                                />
                                <DetailItem
                                    label="Updated At"
                                    value={formatDateTime(occurrence.updated_at)}
                                />
                                <DetailItem
                                    label="Failure / Outcome Reason"
                                    value={occurrence.failure_reason || "—"}
                                    wide
                                />
                            </div>

                            <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                                <h3 className="font-bold text-slate-900">
                                    Generated Maintenance Request
                                </h3>

                                {occurrence.maintenance_request ? (
                                    <div className="mt-4 grid gap-5 sm:grid-cols-2">
                                        <DetailItem
                                            label="Request Number"
                                            value={
                                                occurrence.maintenance_request
                                                    .request_number || "—"
                                            }
                                        />
                                        <DetailItem
                                            label="Request Status"
                                            value={formatLabel(
                                                occurrence.maintenance_request
                                                    .status
                                            )}
                                        />
                                        <DetailItem
                                            label="Request Public ID"
                                            value={
                                                occurrence.maintenance_request
                                                    .public_id
                                            }
                                            wide
                                        />
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-slate-500">
                                        No maintenance request has been generated for this occurrence.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                    {occurrence && (
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RefreshCw}
                            disabled={loading}
                            onClick={loadOccurrence}
                        >
                            Refresh
                        </Button>
                    )}
                    <Button type="button" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default PreventiveMaintenanceOccurrenceDetailModal;
