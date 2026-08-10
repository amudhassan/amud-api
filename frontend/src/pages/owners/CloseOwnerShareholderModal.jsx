import {
    AlertTriangle,
    PieChart,
    ShieldCheck,
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

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatPercentage = value => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0%";
    }

    return `${number.toLocaleString(
        undefined,
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4
        }
    )}%`;
};

const formatDate = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit"
        }
    );
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.msg ||
    error?.message ||
    "Unable to close this shareholding.";

function CloseOwnerShareholderModal({
    company,
    shareholder,
    onClose,
    onClosed
}) {
    const [
        closing,
        setClosing
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const companyPublicId =
        company?.public_id || null;

    const sharePublicId =
        shareholder?.share_public_id || null;

    useEffect(() => {
        setError("");
        setClosing(false);
    }, [sharePublicId]);

    useEffect(() => {
        if (!sharePublicId) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !closing
            ) {
                onClose?.();
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
        closing,
        onClose,
        sharePublicId
    ]);

    if (
        !companyPublicId ||
        !sharePublicId ||
        !shareholder
    ) {
        return null;
    }

    const closeShareholding = async () => {
        if (closing) {
            return;
        }

        try {
            setClosing(true);
            setError("");

            const response =
                await apiClient.delete(
                    `/owners/${companyPublicId}/shareholders/${sharePublicId}`
                );

            onClosed?.(
                response?.data?.data || {
                    company,
                    shareholder: {
                        public_id:
                            shareholder
                                .shareholder_public_id,
                        display_name:
                            shareholder
                                .shareholder_name
                    },
                    shareholding: {
                        share_public_id:
                            sharePublicId,
                        share_percentage:
                            shareholder
                                .share_percentage,
                        shareholder_type:
                            shareholder
                                .shareholder_type,
                        is_active: false
                    }
                }
            );
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setClosing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close shareholding dialog"
                onClick={() => {
                    if (!closing) {
                        onClose?.();
                    }
                }}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="close-owner-shareholding-title"
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <PieChart className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">
                                Shareholding Lifecycle
                            </p>

                            <h2
                                id="close-owner-shareholding-title"
                                className="mt-1 text-lg font-bold text-slate-950"
                            >
                                Close Shareholding
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                End this active ownership interest in {company?.display_name || "this company"}.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        disabled={closing}
                        onClick={onClose}
                    />
                </div>

                <div className="space-y-4 px-5 py-5 sm:px-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Shareholder
                        </p>

                        <p className="mt-2 text-base font-bold text-slate-950">
                            {shareholder.shareholder_name ||
                                "Unnamed shareholder"}
                        </p>

                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                            <p>
                                <span className="font-semibold text-slate-700">
                                    Type:
                                </span>{" "}
                                {formatLabel(
                                    shareholder
                                        .shareholder_type
                                ) || "—"}
                            </p>

                            <p>
                                <span className="font-semibold text-slate-700">
                                    Share:
                                </span>{" "}
                                {formatPercentage(
                                    shareholder
                                        .share_percentage
                                )}
                            </p>

                            <p className="sm:col-span-2">
                                <span className="font-semibold text-slate-700">
                                    Effective from:
                                </span>{" "}
                                {formatDate(
                                    shareholder
                                        .effective_from
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                        <div className="space-y-2 text-sm leading-6 text-amber-900">
                            <p className="font-semibold">
                                This ends the active shareholding; it does not erase its history.
                            </p>

                            <p>
                                The shareholding will leave the active shareholders list and its percentage will be released back into the company&apos;s remaining shares.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />

                        <p className="text-sm leading-6 text-slate-600">
                            The backend preserves the closed relationship for audit and validates the shareholding lifecycle before accepting this action.
                        </p>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                        >
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={closing}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <button
                        type="button"
                        disabled={closing}
                        onClick={closeShareholding}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-600 bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {closing
                            ? "Closing..."
                            : "Close Shareholding"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CloseOwnerShareholderModal;
