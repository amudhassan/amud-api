import {
    Building2,
    PieChart,
    RefreshCw,
    Search,
    UserRound,
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
    "Unable to add shareholder.";

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

const getInitials = value => {
    const words = String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (!words.length) {
        return "SH";
    }

    return words
        .map(word => word[0])
        .join("")
        .toUpperCase();
};

function AddOwnerShareholderModal({
    open,
    company,
    remainingShares,
    onClose,
    onAdded
}) {
    const [
        loadingCandidates,
        setLoadingCandidates
    ] = useState(false);

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        candidates,
        setCandidates
    ] = useState([]);

    const [
        search,
        setSearch
    ] = useState("");

    const [
        selectedPublicId,
        setSelectedPublicId
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

    const normalizedRemainingShares =
        Math.max(
            0,
            Number(
                Number(remainingShares || 0)
                    .toFixed(4)
            )
        );

    const resetForm =
        useCallback(
            () => {
                setError("");
                setSearch("");
                setSelectedPublicId("");
                setShareholderType("ordinary");
                setSharePercentage("");
                setEffectiveFrom("");
            },
            []
        );

    const loadEligibleShareholders =
        useCallback(
            async () => {
                if (
                    !open ||
                    !companyPublicId
                ) {
                    return;
                }

                try {
                    setLoadingCandidates(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            `/owners/${companyPublicId}/shareholders/eligible`
                        );

                    const data =
                        response?.data?.data ||
                        {};

                    setCandidates(
                        Array.isArray(
                            data.eligible_shareholders
                        )
                            ? data.eligible_shareholders
                            : []
                    );
                } catch (
                    requestError
                ) {
                    setCandidates([]);
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoadingCandidates(false);
                }
            },
            [
                open,
                companyPublicId
            ]
        );

    useEffect(() => {
        if (!open) {
            setCandidates([]);
            resetForm();
            return;
        }

        resetForm();
        loadEligibleShareholders();
    }, [
        open,
        companyPublicId,
        loadEligibleShareholders,
        resetForm
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
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
        open,
        submitting,
        onClose
    ]);

    const selectedCandidate =
        useMemo(
            () =>
                candidates.find(
                    candidate =>
                        candidate.public_id ===
                        selectedPublicId
                ) || null,
            [
                candidates,
                selectedPublicId
            ]
        );

    const activeTypes =
        useMemo(
            () =>
                Array.isArray(
                    selectedCandidate
                        ?.active_shareholder_types
                )
                    ? selectedCandidate
                        .active_shareholder_types
                    : [],
            [selectedCandidate]
        );

    const availableTypes =
        useMemo(
            () =>
                SHAREHOLDER_TYPES.filter(
                    ([value]) =>
                        !activeTypes.includes(
                            value
                        )
                ),
            [activeTypes]
        );

    const filteredCandidates =
        useMemo(
            () => {
                const query =
                    search.trim()
                        .toLowerCase();

                if (!query) {
                    return candidates;
                }

                return candidates.filter(
                    candidate =>
                        [
                            candidate.display_name,
                            candidate.email,
                            candidate.phone_number,
                            candidate.registration_number,
                            candidate.tax_identification_number,
                            candidate.country,
                            candidate.owner_type
                        ]
                            .filter(Boolean)
                            .some(value =>
                                String(value)
                                    .toLowerCase()
                                    .includes(query)
                            )
                );
            },
            [
                candidates,
                search
            ]
        );

    const sharePercentageError =
        useMemo(
            () => {
                const raw =
                    String(
                        sharePercentage
                    ).trim();

                if (!raw) {
                    return "Share percentage is required.";
                }

                if (
                    !/^\d+(\.\d{1,4})?$/.test(
                        raw
                    )
                ) {
                    return "Share percentage may contain at most four decimal places.";
                }

                const value = Number(raw);

                if (
                    !Number.isFinite(value) ||
                    value <= 0 ||
                    value > 100
                ) {
                    return "Share percentage must be greater than 0 and cannot exceed 100.";
                }

                if (
                    value >
                    normalizedRemainingShares
                ) {
                    return `Only ${formatPercentage(
                        normalizedRemainingShares
                    )} remains available.`;
                }

                return "";
            },
            [
                sharePercentage,
                normalizedRemainingShares
            ]
        );

    const selectedTypeAlreadyActive =
        activeTypes.includes(
            shareholderType
        );

    const canSubmit =
        Boolean(
            selectedCandidate &&
            availableTypes.length > 0 &&
            !selectedTypeAlreadyActive &&
            !sharePercentageError &&
            normalizedRemainingShares > 0 &&
            !submitting
        );

    const selectCandidate =
        candidate => {
            setSelectedPublicId(
                candidate.public_id
            );
            setError("");

            const currentTypes =
                Array.isArray(
                    candidate
                        .active_shareholder_types
                )
                    ? candidate
                        .active_shareholder_types
                    : [];

            if (
                currentTypes.includes(
                    shareholderType
                )
            ) {
                const nextType =
                    SHAREHOLDER_TYPES.find(
                        ([value]) =>
                            !currentTypes.includes(
                                value
                            )
                    );

                if (nextType) {
                    setShareholderType(
                        nextType[0]
                    );
                }
            }
        };

    const submit = async event => {
        event.preventDefault();

        if (!selectedCandidate) {
            setError(
                "Select a shareholder owner."
            );
            return;
        }

        if (
            availableTypes.length === 0
        ) {
            setError(
                "This owner already has every supported active shareholder type for this company."
            );
            return;
        }

        if (
            selectedTypeAlreadyActive
        ) {
            setError(
                "This shareholder already has an active shareholding of the selected type."
            );
            return;
        }

        if (sharePercentageError) {
            setError(
                sharePercentageError
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const requestBody = {
                shareholder_public_id:
                    selectedCandidate
                        .public_id,
                share_percentage:
                    Number(
                        sharePercentage
                    ),
                shareholder_type:
                    shareholderType
            };

            if (effectiveFrom) {
                requestBody.effective_from =
                    effectiveFrom;
            }

            const response =
                await apiClient.post(
                    `/owners/${companyPublicId}/shareholders`,
                    requestBody
                );

            await onAdded?.(
                response?.data?.data ||
                null
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

    if (
        !open ||
        !companyPublicId
    ) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-owner-shareholder-title"
        >
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                            <PieChart className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                Add Shareholder
                            </p>

                            <h2
                                id="add-owner-shareholder-title"
                                className="mt-1 truncate text-xl font-bold text-slate-950"
                            >
                                {company.display_name ||
                                    "Company"}
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Select an active owner record, then assign its share class and percentage.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close add shareholder"
                        icon={X}
                        disabled={submitting}
                        onClick={onClose}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="overflow-y-auto"
                >
                    <div className="space-y-5 p-5 sm:p-6">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Remaining Shares
                                </p>

                                <p className="mt-2 text-2xl font-bold text-slate-950">
                                    {formatPercentage(
                                        normalizedRemainingShares
                                    )}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Eligible Owners
                                </p>

                                <p className="mt-2 text-2xl font-bold text-slate-950">
                                    {candidates.length}
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                            >
                                {error}
                            </div>
                        )}

                        {normalizedRemainingShares <=
                            0 && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                                The current ownership allocation is already 100%. No additional shares can be added.
                            </div>
                        )}

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-950">
                                        Select Shareholder Owner
                                    </h3>

                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Only active owner records returned by the eligible-shareholder endpoint are shown.
                                    </p>
                                </div>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={RefreshCw}
                                    loading={
                                        loadingCandidates
                                    }
                                    disabled={submitting}
                                    onClick={
                                        loadEligibleShareholders
                                    }
                                >
                                    Refresh
                                </Button>
                            </div>

                            <div className="border-b border-slate-200 p-4">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                                    <input
                                        value={search}
                                        onChange={event =>
                                            setSearch(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            loadingCandidates ||
                                            submitting
                                        }
                                        placeholder="Search name, email, registration, owner type or country"
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                                    />
                                </div>
                            </div>

                            {loadingCandidates ? (
                                <div className="space-y-3 p-4">
                                    {[1, 2, 3].map(
                                        item => (
                                            <div
                                                key={item}
                                                className="h-20 animate-pulse rounded-2xl bg-slate-100"
                                            />
                                        )
                                    )}
                                </div>
                            ) : filteredCandidates.length ===
                              0 ? (
                                <div className="px-6 py-10 text-center">
                                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                        <Search className="h-5 w-5" />
                                    </div>

                                    <p className="mt-3 text-sm font-semibold text-slate-900">
                                        No eligible shareholder owners found
                                    </p>

                                    <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                                        Adjust the search, or create/activate the required owner record first.
                                    </p>
                                </div>
                            ) : (
                                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                                    {filteredCandidates.map(
                                        candidate => {
                                            const selected =
                                                candidate.public_id ===
                                                selectedPublicId;

                                            const existingTypes =
                                                Array.isArray(
                                                    candidate.active_shareholder_types
                                                )
                                                    ? candidate.active_shareholder_types
                                                    : [];

                                            return (
                                                <button
                                                    key={
                                                        candidate.public_id
                                                    }
                                                    type="button"
                                                    disabled={
                                                        submitting
                                                    }
                                                    onClick={() =>
                                                        selectCandidate(
                                                            candidate
                                                        )
                                                    }
                                                    className={`flex w-full items-start gap-3 px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                                                        selected
                                                            ? "bg-violet-50"
                                                            : "hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 ring-1 ring-slate-200">
                                                        {candidate.owner_type ===
                                                        "individual" ? (
                                                            <UserRound className="h-4 w-4" />
                                                        ) : candidate.display_name ? (
                                                            <span className="text-xs font-bold">
                                                                {getInitials(
                                                                    candidate.display_name
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <Building2 className="h-4 w-4" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                                {candidate.display_name ||
                                                                    "Unnamed owner"}
                                                            </p>

                                                            <span className="shrink-0 text-xs font-medium text-slate-500">
                                                                {formatLabel(
                                                                    candidate.owner_type
                                                                )}
                                                            </span>
                                                        </div>

                                                        <p className="mt-1 truncate text-xs text-slate-500">
                                                            {candidate.email ||
                                                                candidate.phone_number ||
                                                                candidate.registration_number ||
                                                                "No contact identifier"}
                                                        </p>

                                                        {existingTypes.length >
                                                            0 && (
                                                            <p className="mt-2 text-xs leading-5 text-amber-700">
                                                                Active classes: {existingTypes
                                                                    .map(
                                                                        formatLabel
                                                                    )
                                                                    .join(
                                                                        ", "
                                                                    )}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div
                                                        className={`mt-1 h-4 w-4 shrink-0 rounded-full border-4 ${
                                                            selected
                                                                ? "border-violet-600 bg-white"
                                                                : "border-slate-300 bg-white"
                                                        }`}
                                                    />
                                                </button>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedCandidate && (
                            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 ring-1 ring-violet-200">
                                        {selectedCandidate.owner_type ===
                                        "individual" ? (
                                            <UserRound className="h-4 w-4" />
                                        ) : (
                                            <Building2 className="h-4 w-4" />
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                            Selected Shareholder
                                        </p>

                                        <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                                            {selectedCandidate.display_name}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {formatLabel(
                                                selectedCandidate.owner_type
                                            )}
                                            {selectedCandidate.country
                                                ? ` • ${selectedCandidate.country}`
                                                : ""}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-3">
                            <label className="space-y-2">
                                <span className="text-sm font-semibold text-slate-800">
                                    Shareholder Type
                                </span>

                                <select
                                    value={shareholderType}
                                    disabled={
                                        !selectedCandidate ||
                                        submitting
                                    }
                                    onChange={event => {
                                        setShareholderType(
                                            event.target.value
                                        );
                                        setError("");
                                    }}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                                >
                                    {SHAREHOLDER_TYPES.map(
                                        ([value, label]) => (
                                            <option
                                                key={value}
                                                value={value}
                                                disabled={
                                                    activeTypes.includes(
                                                        value
                                                    )
                                                }
                                            >
                                                {label}
                                                {activeTypes.includes(
                                                    value
                                                )
                                                    ? " — active"
                                                    : ""}
                                            </option>
                                        )
                                    )}
                                </select>

                                {selectedTypeAlreadyActive && (
                                    <p className="text-xs leading-5 text-rose-600">
                                        This share class is already active for the selected shareholder.
                                    </p>
                                )}
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-semibold text-slate-800">
                                    Share Percentage
                                </span>

                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                            sharePercentage
                                        }
                                        disabled={
                                            !selectedCandidate ||
                                            submitting ||
                                            normalizedRemainingShares <=
                                                0
                                        }
                                        onChange={event => {
                                            setSharePercentage(
                                                event.target.value
                                            );
                                            setError("");
                                        }}
                                        placeholder="e.g. 25 or 12.5"
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                                    />

                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                                        %
                                    </span>
                                </div>

                                {sharePercentage &&
                                    sharePercentageError && (
                                        <p className="text-xs leading-5 text-rose-600">
                                            {sharePercentageError}
                                        </p>
                                    )}
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-semibold text-slate-800">
                                    Effective From
                                </span>

                                <input
                                    type="date"
                                    value={effectiveFrom}
                                    disabled={submitting}
                                    onChange={event =>
                                        setEffectiveFrom(
                                            event.target.value
                                        )
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                                />

                                <p className="text-xs leading-5 text-slate-500">
                                    Optional. Leave blank to use the backend default effective date.
                                </p>
                            </label>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                            The backend remains authoritative for duplicate share classes, company status, share totals and access permissions.
                        </div>
                    </div>

                    <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
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
                            disabled={!canSubmit}
                        >
                            Add Shareholder
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddOwnerShareholderModal;
