import {
    Building2,
    PieChart,
    UserRound,
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

const SHAREHOLDER_TYPES = [
    ["ordinary", "Ordinary"],
    ["preferred", "Preferred"],
    ["founder", "Founder"],
    ["institutional", "Institutional"],
    ["government", "Government"],
    ["partner", "Partner"]
];

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to update shareholding.";

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

const toDateInputValue = value => {
    if (!value) {
        return "";
    }

    const text = String(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString().slice(0, 10);
};

function EditOwnerShareholderModal({
    shareholder,
    company,
    remainingShares,
    onClose,
    onUpdated
}) {
    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        shareholderType,
        setShareholderType
    ] = useState("ordinary");

    const [
        sharePercentage,
        setSharePercentage
    ] = useState("");

    const [
        effectiveFrom,
        setEffectiveFrom
    ] = useState("");

    const companyPublicId =
        company?.public_id || null;

    const sharePublicId =
        shareholder?.share_public_id || null;

    const currentShare =
        Number(
            shareholder?.share_percentage || 0
        );

    const availableForThisShare =
        useMemo(
            () =>
                Math.min(
                    100,
                    Math.max(
                        0,
                        Number(
                            (
                                Number(
                                    remainingShares || 0
                                ) +
                                currentShare
                            ).toFixed(4)
                        )
                    )
                ),
            [
                remainingShares,
                currentShare
            ]
        );

    useEffect(() => {
        if (!shareholder) {
            setError("");
            setShareholderType("ordinary");
            setSharePercentage("");
            setEffectiveFrom("");
            return;
        }

        setError("");
        setShareholderType(
            shareholder.shareholder_type ||
            "ordinary"
        );
        setSharePercentage(
            String(
                Number(
                    shareholder.share_percentage ||
                    0
                )
            )
        );
        setEffectiveFrom(
            toDateInputValue(
                shareholder.effective_from
            )
        );
    }, [shareholder]);

    useEffect(() => {
        if (!shareholder) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !submitting
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
        shareholder,
        submitting,
        onClose
    ]);

    if (
        !shareholder ||
        !companyPublicId ||
        !sharePublicId
    ) {
        return null;
    }

    const submitUpdate = async event => {
        event.preventDefault();

        const percentageText =
            String(sharePercentage).trim();

        if (
            !/^\d+(\.\d{1,4})?$/.test(
                percentageText
            )
        ) {
            setError(
                "Share percentage must be a valid number with at most four decimal places."
            );
            return;
        }

        const percentage =
            Number(percentageText);

        if (
            !Number.isFinite(percentage) ||
            percentage <= 0 ||
            percentage > 100
        ) {
            setError(
                "Share percentage must be greater than 0 and cannot exceed 100."
            );
            return;
        }

        if (
            percentage >
            availableForThisShare
        ) {
            setError(
                `This shareholding can use at most ${formatPercentage(
                    availableForThisShare
                )} without taking the company above 100%.`
            );
            return;
        }

        const requestBody = {};

        if (
            Number(
                percentage.toFixed(4)
            ) !==
            Number(
                currentShare.toFixed(4)
            )
        ) {
            requestBody.share_percentage =
                percentage;
        }

        if (
            shareholderType !==
            shareholder.shareholder_type
        ) {
            requestBody.shareholder_type =
                shareholderType;
        }

        const currentEffectiveFrom =
            toDateInputValue(
                shareholder.effective_from
            );

        if (
            effectiveFrom !==
            currentEffectiveFrom
        ) {
            if (!effectiveFrom) {
                setError(
                    "Effective-from date cannot be cleared when updating an existing shareholding."
                );
                return;
            }

            requestBody.effective_from =
                effectiveFrom;
        }

        if (
            Object.keys(requestBody).length ===
            0
        ) {
            setError(
                "No shareholding changes were made."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/owners/${companyPublicId}/shareholders/${sharePublicId}`,
                    requestBody
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
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-owner-shareholder-title"
        >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                            <PieChart className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                Edit Shareholding
                            </p>

                            <h2
                                id="edit-owner-shareholder-title"
                                className="mt-1 truncate text-xl font-bold text-slate-950"
                            >
                                {shareholder.shareholder_name ||
                                    "Shareholder"}
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Update the current share percentage, shareholder type or effective date.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close edit shareholding"
                        icon={X}
                        disabled={submitting}
                        onClick={onClose}
                    />
                </div>

                <form
                    onSubmit={submitUpdate}
                    className="overflow-y-auto"
                >
                    <div className="space-y-5 p-5 sm:p-6">
                        {error && (
                            <div
                                role="alert"
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                            >
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 ring-1 ring-slate-200">
                                    {shareholder.shareholder_owner_type ===
                                    "individual" ? (
                                        <UserRound className="h-4 w-4" />
                                    ) : (
                                        <Building2 className="h-4 w-4" />
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {shareholder.shareholder_name ||
                                            "Unnamed shareholder"}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {formatLabel(
                                            shareholder.shareholder_owner_type
                                        ) || "Owner"}
                                        {shareholder.country
                                            ? ` · ${shareholder.country}`
                                            : ""}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="space-y-2">
                                <span className="text-sm font-semibold text-slate-700">
                                    Share Percentage
                                </span>

                                <input
                                    type="number"
                                    min="0.0001"
                                    max={availableForThisShare}
                                    step="0.0001"
                                    required
                                    value={sharePercentage}
                                    onChange={event =>
                                        setSharePercentage(
                                            event.target.value
                                        )
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                />

                                <span className="block text-xs leading-5 text-slate-500">
                                    Current: {formatPercentage(
                                        currentShare
                                    )}. Maximum available for this shareholding: {formatPercentage(
                                        availableForThisShare
                                    )}.
                                </span>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-semibold text-slate-700">
                                    Shareholder Type
                                </span>

                                <select
                                    value={shareholderType}
                                    onChange={event =>
                                        setShareholderType(
                                            event.target.value
                                        )
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                >
                                    {SHAREHOLDER_TYPES.map(
                                        ([value, label]) => (
                                            <option
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                        </div>

                        <label className="block space-y-2">
                            <span className="text-sm font-semibold text-slate-700">
                                Effective From
                            </span>

                            <input
                                type="date"
                                value={effectiveFrom}
                                onChange={event =>
                                    setEffectiveFrom(
                                        event.target.value
                                    )
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                            />

                            <span className="block text-xs leading-5 text-slate-500">
                                Existing shareholdings keep a valid effective date. The backend remains authoritative for lifecycle integrity.
                            </span>
                        </label>
                    </div>

                    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={submitting}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            loading={submitting}
                        >
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditOwnerShareholderModal;
