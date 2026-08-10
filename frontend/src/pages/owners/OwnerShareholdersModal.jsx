import {
    Building2,
    Pencil,
    PieChart,
    Plus,
    RefreshCw,
    XCircle,
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

import {
    useAuth
} from "../../contexts/AuthContext";

import AddOwnerShareholderModal from "./AddOwnerShareholderModal";
import CloseOwnerShareholderModal from "./CloseOwnerShareholderModal";
import EditOwnerShareholderModal from "./EditOwnerShareholderModal";

const EMPTY_SUMMARY = {
    active_shareholder_count: 0,
    total_active_shares: 0,
    remaining_shares: 100,
    ownership_complete: false
};

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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load owner shareholders.";

const statusClassName = status => {
    switch (status) {
        case "active":
            return "bg-emerald-50 text-emerald-700 ring-emerald-200";

        case "blocked":
            return "bg-rose-50 text-rose-700 ring-rose-200";

        case "inactive":
        default:
            return "bg-slate-100 text-slate-600 ring-slate-200";
    }
};

function OwnerShareholdersModal({
    owner,
    onClose
}) {
    const {
        user
    } = useAuth();

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        success,
        setSuccess
    ] = useState("");

    const [
        addOpen,
        setAddOpen
    ] = useState(false);

    const [
        editShareholder,
        setEditShareholder
    ] = useState(null);

    const [
        closeShareholder,
        setCloseShareholder
    ] = useState(null);

    const [
        company,
        setCompany
    ] = useState(null);

    const [
        summary,
        setSummary
    ] = useState(EMPTY_SUMMARY);

    const [
        shareholders,
        setShareholders
    ] = useState([]);

    const companyPublicId =
        owner?.public_id || null;

    const loadShareholders =
        useCallback(
            async () => {
                if (!companyPublicId) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            `/owners/${companyPublicId}/shareholders`
                        );

                    const data =
                        response?.data?.data ||
                        {};

                    setCompany(
                        data.company ||
                        owner ||
                        null
                    );

                    setSummary({
                        ...EMPTY_SUMMARY,
                        ...(data.summary || {}),
                        active_shareholder_count:
                            Number(
                                data?.summary
                                    ?.active_shareholder_count
                            ) || 0,
                        total_active_shares:
                            Number(
                                data?.summary
                                    ?.total_active_shares
                            ) || 0,
                        remaining_shares:
                            Number(
                                data?.summary
                                    ?.remaining_shares
                            ) || 0,
                        ownership_complete:
                            data?.summary
                                ?.ownership_complete ===
                            true
                    });

                    setShareholders(
                        Array.isArray(
                            data.shareholders
                        )
                            ? data.shareholders
                            : []
                    );
                } catch (
                    requestError
                ) {
                    setCompany(
                        owner || null
                    );
                    setSummary(
                        EMPTY_SUMMARY
                    );
                    setShareholders([]);

                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                companyPublicId,
                owner
            ]
        );

    useEffect(() => {
        if (!companyPublicId) {
            setCompany(null);
            setSummary(
                EMPTY_SUMMARY
            );
            setShareholders([]);
            setError("");
            setSuccess("");
            setAddOpen(false);
            setEditShareholder(null);
            setCloseShareholder(null);
            return;
        }

        setSuccess("");
        setAddOpen(false);
        setEditShareholder(null);
        setCloseShareholder(null);
        loadShareholders();
    }, [
        companyPublicId,
        loadShareholders
    ]);

    useEffect(() => {
        if (!companyPublicId) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key === "Escape"
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
        companyPublicId,
        onClose
    ]);

    const ownerLabel =
        useMemo(
            () =>
                company?.display_name ||
                owner?.display_name ||
                "Owner",
            [
                company,
                owner
            ]
        );

    const canManageShareholders =
        user?.role === "admin" ||
        Boolean(
            owner?.can_manage_finances &&
            [
                "owner",
                "representative",
                "manager",
                "accountant"
            ].includes(
                owner?.relationship_role
            )
        );

    const canAddShareholder =
        canManageShareholders &&
        company?.status === "active" &&
        Number(
            summary.remaining_shares
        ) > 0;

    const canCloseShareholding =
        canManageShareholders &&
        (
            user?.role === "admin" ||
            company?.status === "active"
        );

    if (!companyPublicId) {
        return null;
    }

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-shareholders-title"
        >
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                            <PieChart className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                Current Shareholding
                            </p>

                            <h2
                                id="owner-shareholders-title"
                                className="mt-1 truncate text-xl font-bold text-slate-950"
                            >
                                {ownerLabel}
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                View active shareholders and the current ownership allocation recorded by the backend.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close shareholders"
                        icon={X}
                        onClick={onClose}
                    />
                </div>

                <div className="overflow-y-auto">
                    <div className="space-y-5 p-5 sm:p-6">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Active Shareholders
                                </p>

                                <p className="mt-2 text-2xl font-bold text-slate-950">
                                    {
                                        summary
                                            .active_shareholder_count
                                    }
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Allocated Shares
                                </p>

                                <p className="mt-2 text-2xl font-bold text-slate-950">
                                    {formatPercentage(
                                        summary
                                            .total_active_shares
                                    )}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Remaining Shares
                                </p>

                                <p className="mt-2 text-2xl font-bold text-slate-950">
                                    {formatPercentage(
                                        summary
                                            .remaining_shares
                                    )}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Allocation Status
                                </p>

                                <p
                                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                        summary.ownership_complete
                                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                            : "bg-amber-50 text-amber-700 ring-amber-200"
                                    }`}
                                >
                                    {summary.ownership_complete
                                        ? "100% Complete"
                                        : "Incomplete"}
                                </p>
                            </div>
                        </div>

                        {success && (
                            <div
                                role="status"
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
                            >
                                {success}
                            </div>
                        )}

                        {error && (
                            <div
                                role="alert"
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                            >
                                {error}
                            </div>
                        )}

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-950">
                                        Active Shareholders
                                    </h3>

                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Closed shareholdings are historical records and are not returned by this active-list endpoint.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {canManageShareholders && (
                                        <Button
                                            type="button"
                                            leftIcon={Plus}
                                            disabled={
                                                !canAddShareholder ||
                                                loading
                                            }
                                            onClick={() => {
                                                setError("");
                                                setSuccess("");
                                                setAddOpen(true);
                                            }}
                                        >
                                            Add Shareholder
                                        </Button>
                                    )}

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        leftIcon={RefreshCw}
                                        loading={loading}
                                        onClick={
                                            loadShareholders
                                        }
                                    >
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="space-y-3 p-5">
                                    {[1, 2, 3, 4].map(
                                        item => (
                                            <div
                                                key={item}
                                                className="h-20 animate-pulse rounded-2xl bg-slate-100"
                                            />
                                        )
                                    )}
                                </div>
                            ) : shareholders.length ===
                              0 ? (
                                <div className="px-6 py-14 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                        <PieChart className="h-5 w-5" />
                                    </div>

                                    <h4 className="mt-4 text-sm font-semibold text-slate-900">
                                        No active shareholders
                                    </h4>

                                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                                        This owner currently has no active shareholding relationships returned by the backend.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="hidden overflow-x-auto lg:block">
                                        <table className="min-w-full divide-y divide-slate-200">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Shareholder
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Type
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Share
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Effective From
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Contact
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Status
                                                    </th>
                                                    {canManageShareholders && (
                                                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Action
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100">
                                                {shareholders.map(
                                                    shareholder => (
                                                        <tr
                                                            key={
                                                                shareholder
                                                                    .share_public_id
                                                            }
                                                            className="transition hover:bg-slate-50/80"
                                                        >
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                                                                        {shareholder.shareholder_owner_type ===
                                                                        "individual" ? (
                                                                            <UserRound className="h-4 w-4" />
                                                                        ) : (
                                                                            <span className="text-xs font-bold">
                                                                                {getInitials(
                                                                                    shareholder
                                                                                        .shareholder_name
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <p className="max-w-[240px] truncate text-sm font-semibold text-slate-900">
                                                                            {shareholder
                                                                                .shareholder_name ||
                                                                                "Unnamed shareholder"}
                                                                        </p>

                                                                        <p className="mt-1 max-w-[240px] truncate text-xs text-slate-500">
                                                                            {shareholder
                                                                                .registration_number ||
                                                                                shareholder
                                                                                    .tax_identification_number ||
                                                                                formatLabel(
                                                                                    shareholder
                                                                                        .shareholder_owner_type
                                                                                ) ||
                                                                                "—"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-4 py-4">
                                                                <p className="text-sm font-medium text-slate-700">
                                                                    {formatLabel(
                                                                        shareholder
                                                                            .shareholder_type
                                                                    )}
                                                                </p>

                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {formatLabel(
                                                                        shareholder
                                                                            .shareholder_owner_type
                                                                    )}
                                                                </p>
                                                            </td>

                                                            <td className="px-4 py-4">
                                                                <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                                                                    {formatPercentage(
                                                                        shareholder
                                                                            .share_percentage
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td className="px-4 py-4 text-sm text-slate-700">
                                                                {formatDate(
                                                                    shareholder
                                                                        .effective_from
                                                                )}
                                                            </td>

                                                            <td className="px-4 py-4">
                                                                <p className="max-w-[220px] truncate text-sm text-slate-700">
                                                                    {shareholder
                                                                        .email ||
                                                                        shareholder
                                                                            .phone_number ||
                                                                        "—"}
                                                                </p>

                                                                {shareholder.email &&
                                                                    shareholder.phone_number && (
                                                                        <p className="mt-1 text-xs text-slate-500">
                                                                            {
                                                                                shareholder
                                                                                    .phone_number
                                                                            }
                                                                        </p>
                                                                    )}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <span
                                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                                                                        shareholder
                                                                            .status
                                                                    )}`}
                                                                >
                                                                    {formatLabel(
                                                                        shareholder
                                                                            .status
                                                                    )}
                                                                </span>
                                                            </td>

                                                            {canManageShareholders && (
                                                                <td className="px-5 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <IconButton
                                                                            label={`Edit shareholding for ${
                                                                                shareholder.shareholder_name ||
                                                                                "shareholder"
                                                                            }`}
                                                                            icon={Pencil}
                                                                            disabled={
                                                                                company?.status !==
                                                                                "active"
                                                                            }
                                                                            onClick={() => {
                                                                                setError("");
                                                                                setSuccess("");
                                                                                setEditShareholder(
                                                                                    shareholder
                                                                                );
                                                                            }}
                                                                        />

                                                                        <IconButton
                                                                            label={`Close shareholding for ${
                                                                                shareholder.shareholder_name ||
                                                                                "shareholder"
                                                                            }`}
                                                                            icon={XCircle}
                                                                            disabled={
                                                                                !canCloseShareholding
                                                                            }
                                                                            onClick={() => {
                                                                                setError("");
                                                                                setSuccess("");
                                                                                setCloseShareholder(
                                                                                    shareholder
                                                                                );
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="divide-y divide-slate-100 lg:hidden">
                                        {shareholders.map(
                                            shareholder => (
                                                <article
                                                    key={
                                                        shareholder
                                                            .share_public_id
                                                    }
                                                    className="space-y-3 p-4"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                                                                {shareholder.shareholder_owner_type ===
                                                                "individual" ? (
                                                                    <UserRound className="h-4 w-4" />
                                                                ) : (
                                                                    <Building2 className="h-4 w-4" />
                                                                )}
                                                            </div>

                                                            <div className="min-w-0">
                                                                <h4 className="truncate text-sm font-semibold text-slate-900">
                                                                    {shareholder
                                                                        .shareholder_name ||
                                                                        "Unnamed shareholder"}
                                                                </h4>

                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {formatLabel(
                                                                        shareholder
                                                                            .shareholder_type
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                                                            {formatPercentage(
                                                                shareholder
                                                                    .share_percentage
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                                                        <p>
                                                            <span className="font-semibold text-slate-700">
                                                                Owner type:
                                                            </span>{" "}
                                                            {formatLabel(
                                                                shareholder
                                                                    .shareholder_owner_type
                                                            ) ||
                                                                "—"}
                                                        </p>

                                                        <p>
                                                            <span className="font-semibold text-slate-700">
                                                                Effective:
                                                            </span>{" "}
                                                            {formatDate(
                                                                shareholder
                                                                    .effective_from
                                                            )}
                                                        </p>

                                                        <p>
                                                            <span className="font-semibold text-slate-700">
                                                                Contact:
                                                            </span>{" "}
                                                            {shareholder
                                                                .email ||
                                                                shareholder
                                                                    .phone_number ||
                                                                "—"}
                                                        </p>

                                                        <p>
                                                            <span className="font-semibold text-slate-700">
                                                                Country:
                                                            </span>{" "}
                                                            {shareholder
                                                                .country ||
                                                                "—"}
                                                        </p>
                                                    </div>

                                                    {canManageShareholders && (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    company?.status !==
                                                                    "active"
                                                                }
                                                                onClick={() => {
                                                                    setError("");
                                                                    setSuccess("");
                                                                    setEditShareholder(
                                                                        shareholder
                                                                    );
                                                                }}
                                                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                                Edit Shareholding
                                                            </button>

                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    !canCloseShareholding
                                                                }
                                                                onClick={() => {
                                                                    setError("");
                                                                    setSuccess("");
                                                                    setCloseShareholder(
                                                                        shareholder
                                                                    );
                                                                }}
                                                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                                Close Shareholding
                                                            </button>
                                                        </div>
                                                    )}
                                                </article>
                                            )
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>

            <AddOwnerShareholderModal
                open={addOpen}
                company={
                    company ||
                    owner
                }
                remainingShares={
                    summary.remaining_shares
                }
                onClose={() =>
                    setAddOpen(false)
                }
                onAdded={async result => {
                    setAddOpen(false);

                    setSuccess(
                        `${
                            result?.shareholder
                                ?.display_name ||
                            "Shareholder"
                        } added successfully.`
                    );

                    await loadShareholders();
                }}
            />


            <CloseOwnerShareholderModal
                shareholder={closeShareholder}
                company={
                    company ||
                    owner
                }
                onClose={() =>
                    setCloseShareholder(null)
                }
                onClosed={async result => {
                    const closedShareholder =
                        result?.shareholder;

                    setCloseShareholder(null);

                    setSuccess(
                        `${
                            closedShareholder
                                ?.display_name ||
                            closeShareholder
                                ?.shareholder_name ||
                            "Shareholding"
                        } closed successfully.`
                    );

                    await loadShareholders();
                }}
            />

            <EditOwnerShareholderModal
                shareholder={editShareholder}
                company={
                    company ||
                    owner
                }
                remainingShares={
                    summary.remaining_shares
                }
                onClose={() =>
                    setEditShareholder(null)
                }
                onUpdated={async result => {
                    const updatedShareholder =
                        result?.shareholder;

                    setEditShareholder(null);

                    setSuccess(
                        `${
                            updatedShareholder
                                ?.display_name ||
                            editShareholder
                                ?.shareholder_name ||
                            "Shareholding"
                        } updated successfully.`
                    );

                    await loadShareholders();
                }}
            />
        </>
    );
}

export default OwnerShareholdersModal;
