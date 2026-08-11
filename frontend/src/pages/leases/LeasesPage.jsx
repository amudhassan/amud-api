import {
    Ban,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    FileText,
    PencilLine,
    Plus,
    RefreshCw,
    Repeat2,
    Search,
    ShieldCheck,
    ShieldX,
    WalletCards
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import CreateLeaseModal from "./CreateLeaseModal";
import EditLeaseModal from "./EditLeaseModal";
import ScheduleLeaseModal from "./ScheduleLeaseModal";
import ActivateLeaseModal from "./ActivateLeaseModal";
import CancelLeaseModal from "./CancelLeaseModal";
import TerminateLeaseModal from "./TerminateLeaseModal";
import ExpireLeaseModal from "./ExpireLeaseModal";
import RenewLeaseModal from "./RenewLeaseModal";
import LeaseDetailModal from "./LeaseDetailModal";
import LeaseClausesModal from "./LeaseClausesModal";
import LeaseClauseTemplatesModal from "./LeaseClauseTemplatesModal";
import {
    Button,
    IconButton
} from "../../components/ui/Button";

const LEASE_STATUSES = [
    "draft",
    "scheduled",
    "active",
    "expired",
    "terminated",
    "cancelled"
];

const LEASE_PDF_LANGUAGES = [
    {
        value: "en",
        label: "English"
    },
    {
        value: "sw",
        label: "Kiswahili"
    }
];

const getLeasePdfLanguageLabel =
    language =>
        LEASE_PDF_LANGUAGES.find(
            option =>
                option.value === language
        )?.label || "English";

const EMPTY_PAGINATION = {
    page: 1,
    limit: 20,
    total_records: 0,
    total_pages: 0,
    has_next_page: false,
    has_previous_page: false
};

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

const formatDate = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit"
        }
    ).format(date);
};

const formatMoney = (
    amount,
    currencyCode
) => {
    if (
        amount === null ||
        amount === undefined ||
        !currencyCode
    ) {
        return "Restricted";
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
        return `${currencyCode} ${amount}`;
    }

    try {
        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency: currencyCode,
                maximumFractionDigits: 2
            }
        ).format(numericAmount);
    } catch {
        return `${currencyCode} ${numericAmount.toLocaleString()}`;
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete the request.";

const statusClassName = status => {
    const styles = {
        draft:
            "bg-slate-100 text-slate-700 ring-slate-200",
        scheduled:
            "bg-violet-50 text-violet-700 ring-violet-200",
        active:
            "bg-emerald-50 text-emerald-700 ring-emerald-200",
        expired:
            "bg-amber-50 text-amber-700 ring-amber-200",
        terminated:
            "bg-rose-50 text-rose-700 ring-rose-200",
        cancelled:
            "bg-zinc-100 text-zinc-700 ring-zinc-200"
    };

    return (
        styles[status] ||
        "bg-slate-100 text-slate-700 ring-slate-200"
    );
};

function LeasesPage() {
    const [leases, setLeases] =
        useState([]);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");
    const [createOpen, setCreateOpen] =
        useState(false);
    const [createSuccess, setCreateSuccess] =
        useState("");
    const [editLease, setEditLease] =
        useState(null);
    const [editSuccess, setEditSuccess] =
        useState("");
    const [scheduleLease, setScheduleLease] =
        useState(null);
    const [scheduleSuccess, setScheduleSuccess] =
        useState("");
    const [activateLease, setActivateLease] =
        useState(null);
    const [activateSuccess, setActivateSuccess] =
        useState("");
    const [cancelLease, setCancelLease] =
        useState(null);
    const [cancelSuccess, setCancelSuccess] =
        useState("");
    const [terminateLease, setTerminateLease] =
        useState(null);
    const [terminateSuccess, setTerminateSuccess] =
        useState("");
    const [expireLease, setExpireLease] =
        useState(null);
    const [expireSuccess, setExpireSuccess] =
        useState("");
    const [renewLease, setRenewLease] =
        useState(null);
    const [renewSuccess, setRenewSuccess] =
        useState("");
    const [detailLease, setDetailLease] =
        useState(null);
    const [clausesLease, setClausesLease] =
        useState(null);
    const [templatesOpen, setTemplatesOpen] =
        useState(false);
    const [
        downloadingLeasePublicId,
        setDownloadingLeasePublicId
    ] = useState(null);
    const [downloadSuccess, setDownloadSuccess] =
        useState("");
    const [
        leasePdfLanguage,
        setLeasePdfLanguage
    ] = useState("en");

    const [page, setPage] =
        useState(1);
    const [searchInput, setSearchInput] =
        useState("");
    const [search, setSearch] =
        useState("");
    const [status, setStatus] =
        useState("");
    const [startDateFrom, setStartDateFrom] =
        useState("");
    const [endDateTo, setEndDateTo] =
        useState("");

    const loadLeases = useCallback(
        async () => {
            try {
                setLoading(true);
                setError("");

                const params = {
                    page,
                    limit: 20
                };

                if (search.trim()) {
                    params.search =
                        search.trim();
                }

                if (status) {
                    params.status = status;
                }

                if (startDateFrom) {
                    params.start_date_from =
                        startDateFrom;
                }

                if (endDateTo) {
                    params.end_date_to =
                        endDateTo;
                }

                const response =
                    await apiClient.get(
                        "/leases",
                        {
                            params
                        }
                    );

                const rows =
                    Array.isArray(
                        response?.data?.data
                            ?.leases
                    )
                        ? response.data.data
                              .leases
                        : [];

                setLeases(rows);
                setPagination({
                    ...EMPTY_PAGINATION,
                    ...(response?.data
                        ?.pagination || {})
                });
            } catch (requestError) {
                setLeases([]);
                setPagination(
                    EMPTY_PAGINATION
                );
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
            endDateTo,
            page,
            search,
            startDateFrom,
            status
        ]
    );

    useEffect(() => {
        loadLeases();
    }, [loadLeases]);

    const handleSearchSubmit = event => {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setStatus("");
        setStartDateFrom("");
        setEndDateTo("");
        setPage(1);
    };

    const handleLeaseCreated = async data => {
        const createdLease =
            data?.lease || null;

        setCreateOpen(false);
        setEditSuccess("");
        setCancelSuccess("");
        setTerminateSuccess("");
        setExpireSuccess("");
        setRenewSuccess("");
        setCreateSuccess(
            createdLease?.lease_number
                ? `Draft lease ${createdLease.lease_number} created successfully. Add or review its Terms & Conditions before scheduling.`
                : "Draft lease created successfully. Add or review its Terms & Conditions before scheduling."
        );

        if (createdLease?.public_id) {
            setClausesLease({
                ...createdLease,
                owner:
                    data?.owner ||
                    createdLease.owner ||
                    null
            });
        }

        setPage(1);
        await loadLeases();
    };

    const handleLeaseUpdated = async data => {
        const updatedLease =
            data?.lease || null;

        setEditLease(null);
        setRenewSuccess("");
        setCreateSuccess("");
        setCancelSuccess("");
        setTerminateSuccess("");
        setExpireSuccess("");
        setEditSuccess(
            updatedLease?.lease_number
                ? `Draft lease ${updatedLease.lease_number} updated successfully. Review its Terms & Conditions before scheduling.`
                : "Draft lease updated successfully. Review its Terms & Conditions before scheduling."
        );

        if (updatedLease?.public_id) {
            setClausesLease({
                ...updatedLease,
                owner:
                    data?.owner ||
                    updatedLease.owner ||
                    null
            });
        }

        await loadLeases();
    };

    const handleLeaseScheduled = async data => {
        const scheduledLease =
            data?.lease || null;

        setScheduleLease(null);
        setRenewSuccess("");
        setCreateSuccess("");
        setEditSuccess("");
        setCancelSuccess("");
        setTerminateSuccess("");
        setExpireSuccess("");
        setScheduleSuccess(
            scheduledLease?.lease_number
                ? `Lease ${scheduledLease.lease_number} scheduled successfully.`
                : "Lease scheduled successfully."
        );

        await loadLeases();
    };

    const handleLeaseActivated = async data => {
        const activatedLease =
            data?.lease || null;

        setActivateLease(null);
        setRenewSuccess("");
        setCreateSuccess("");
        setEditSuccess("");
        setScheduleSuccess("");
        setCancelSuccess("");
        setTerminateSuccess("");
        setExpireSuccess("");
        setActivateSuccess(
            activatedLease?.lease_number
                ? `Lease ${activatedLease.lease_number} activated successfully.`
                : "Lease activated successfully."
        );

        await loadLeases();
    };

    const handleLeaseCancelled = async data => {
        const cancelledLease =
            data?.lease || null;

        setCancelLease(null);
        setRenewSuccess("");
        setCreateSuccess("");
        setEditSuccess("");
        setScheduleSuccess("");
        setActivateSuccess("");
        setTerminateSuccess("");
        setExpireSuccess("");
        setCancelSuccess(
            cancelledLease?.lease_number
                ? `Lease ${cancelledLease.lease_number} cancelled successfully.`
                : "Lease cancelled successfully."
        );

        await loadLeases();
    };

    const handleLeaseTerminated = async data => {
        const terminatedLease =
            data?.lease || null;

        setTerminateLease(null);
        setRenewSuccess("");
        setCreateSuccess("");
        setEditSuccess("");
        setScheduleSuccess("");
        setActivateSuccess("");
        setCancelSuccess("");
        setExpireSuccess("");
        setTerminateSuccess(
            terminatedLease?.lease_number
                ? `Lease ${terminatedLease.lease_number} terminated successfully.`
                : "Lease terminated successfully."
        );

        await loadLeases();
    };

    const handleLeaseExpired = async data => {
        const expiredLease =
            data?.lease || null;

        setExpireLease(null);
        setRenewSuccess("");
        setCreateSuccess("");
        setEditSuccess("");
        setScheduleSuccess("");
        setActivateSuccess("");
        setCancelSuccess("");
        setTerminateSuccess("");
        setExpireSuccess(
            expiredLease?.lease_number
                ? `Lease ${expiredLease.lease_number} expired successfully.`
                : "Lease expired successfully."
        );

        await loadLeases();
    };

    const handleLeaseRenewed = async data => {
        const renewalLease =
            data?.renewal_lease || null;

        setRenewLease(null);
        setCreateSuccess("");
        setEditSuccess("");
        setScheduleSuccess("");
        setActivateSuccess("");
        setCancelSuccess("");
        setTerminateSuccess("");
        setExpireSuccess("");
        setRenewSuccess(
            renewalLease?.lease_number
                ? `Renewal draft ${renewalLease.lease_number} created successfully.`
                : "Lease renewal draft created successfully."
        );

        setPage(1);
        await loadLeases();
    };

    const handleDownloadLeasePdf =
        async lease => {
            if (
                !lease?.public_id ||
                downloadingLeasePublicId
            ) {
                return;
            }

            try {
                setDownloadingLeasePublicId(
                    lease.public_id
                );
                setError("");
                setDownloadSuccess("");

                const response =
                    await apiClient.get(
                        `/leases/${lease.public_id}/pdf`,
                        {
                            params: {
                                language:
                                    leasePdfLanguage
                            },
                            responseType: "blob"
                        }
                    );

                const contentType =
                    response.headers?.[
                        "content-type"
                    ] ||
                    "application/pdf";

                const blob = new Blob(
                    [response.data],
                    {
                        type: contentType
                    }
                );

                const disposition =
                    response.headers?.[
                        "content-disposition"
                    ] || "";

                const fileNameMatch =
                    disposition.match(
                        /filename="?([^"]+)"?/i
                    );

                const fallbackLeaseNumber =
                    String(
                        lease.lease_number ||
                        "lease-agreement"
                    )
                        .replace(
                            /[^A-Za-z0-9._-]/g,
                            "_"
                        );

                const fileName =
                    fileNameMatch?.[1]?.trim() ||
                    `${fallbackLeaseNumber}-lease-agreement-${leasePdfLanguage}.pdf`;

                const objectUrl =
                    window.URL.createObjectURL(
                        blob
                    );

                const anchor =
                    document.createElement(
                        "a"
                    );

                anchor.href = objectUrl;
                anchor.download = fileName;

                document.body.appendChild(
                    anchor
                );

                anchor.click();
                anchor.remove();

                window.URL.revokeObjectURL(
                    objectUrl
                );

                setDownloadSuccess(
                    `Lease agreement ${lease.lease_number} downloaded successfully in ${getLeasePdfLanguageLabel(
                        leasePdfLanguage
                    )}.`
                );
            } catch (requestError) {
                /*
                 * Blob responses may contain a JSON
                 * error payload from the API. Decode
                 * it so the user sees the actual
                 * backend authorization/business
                 * message where possible.
                 */
                let message =
                    getErrorMessage(
                        requestError
                    );

                const responseData =
                    requestError?.response
                        ?.data;

                if (
                    responseData instanceof Blob
                ) {
                    try {
                        const rawText =
                            await responseData
                                .text();

                        const parsed =
                            JSON.parse(
                                rawText
                            );

                        message =
                            parsed?.message ||
                            message;
                    } catch {
                        /*
                         * Keep the standard fallback
                         * message when the blob is
                         * not JSON.
                         */
                    }
                }

                setError(message);
            } finally {
                setDownloadingLeasePublicId(
                    null
                );
            }
        };

    const pageStatusCounts = useMemo(
        () => {
            const counts = {};

            for (const lease of leases) {
                counts[lease.status] =
                    (counts[lease.status] || 0) + 1;
            }

            return counts;
        },
        [leases]
    );

    const visibleFinancialCount = useMemo(
        () =>
            leases.filter(
                lease =>
                    lease.can_view_finances ===
                    true
            ).length,
        [leases]
    );

    return (
        <div className="space-y-6">
            <div
                className="
                    flex flex-col gap-4
                    xl:flex-row xl:items-end
                    xl:justify-between
                "
            >
                <div>
                    <h1
                        className="
                            text-3xl font-bold
                            tracking-tight
                            text-slate-950
                        "
                    >
                        Leases
                    </h1>

                    <p
                        className="
                            mt-2 text-sm
                            text-slate-500
                        "
                    >
                        View authorized lease
                        records and their
                        lifecycle status.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <IconButton
                        label="Refresh leases"
                        icon={RefreshCw}
                        onClick={loadLeases}
                        loading={loading}
                    />

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={FileText}
                        onClick={() =>
                            setTemplatesOpen(true)
                        }
                    >
                        Clause Templates
                    </Button>

                    <Button
                        onClick={() => {
                            setCreateSuccess("");
                            setEditSuccess("");
                            setScheduleSuccess("");
                            setActivateSuccess("");
                            setCancelSuccess("");
                            setTerminateSuccess("");
                            setExpireSuccess("");
                            setCreateOpen(true);
                        }}
                        leftIcon={Plus}
                    >
                        Add Draft Lease
                    </Button>
                </div>
            </div>

            {createSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {createSuccess}
                </div>
            )}

            {editSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {editSuccess}
                </div>
            )}

            {scheduleSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {scheduleSuccess}
                </div>
            )}

            {activateSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {activateSuccess}
                </div>
            )}

            {cancelSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {cancelSuccess}
                </div>
            )}

            {terminateSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {terminateSuccess}
                </div>
            )}

            {expireSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {expireSuccess}
                </div>
            )}

            {renewSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {renewSuccess}
                </div>
            )}

            <div
                className="
                    grid gap-4
                    sm:grid-cols-2
                    xl:grid-cols-4
                "
            >
                <div
                    className="
                        rounded-2xl border
                        border-slate-200
                        bg-white p-5 shadow-sm
                    "
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Total Results
                        </p>
                        <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-950">
                        {pagination.total_records}
                    </p>
                </div>

                <div
                    className="
                        rounded-2xl border
                        border-slate-200
                        bg-white p-5 shadow-sm
                    "
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Active on Page
                        </p>
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-950">
                        {pageStatusCounts.active || 0}
                    </p>
                </div>

                <div
                    className="
                        rounded-2xl border
                        border-slate-200
                        bg-white p-5 shadow-sm
                    "
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Scheduled on Page
                        </p>
                        <CalendarDays className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-950">
                        {pageStatusCounts.scheduled || 0}
                    </p>
                </div>

                <div
                    className="
                        rounded-2xl border
                        border-slate-200
                        bg-white p-5 shadow-sm
                    "
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Finance Visible
                        </p>
                        <WalletCards className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-950">
                        {visibleFinancialCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        Current page
                    </p>
                </div>
            </div>

            <div
                className="
                    rounded-2xl border
                    border-slate-200
                    bg-white p-4 shadow-sm
                "
            >
                <form
                    onSubmit={handleSearchSubmit}
                    className="
                        grid gap-3
                        xl:grid-cols-[minmax(260px,1fr)_190px_180px_180px_auto]
                    "
                >
                    <div className="relative">
                        <Search
                            className="
                                pointer-events-none
                                absolute left-3.5
                                top-1/2 h-4 w-4
                                -translate-y-1/2
                                text-slate-400
                            "
                        />

                        <input
                            type="search"
                            value={searchInput}
                            onChange={event =>
                                setSearchInput(
                                    event.target.value
                                )
                            }
                            placeholder="Search lease, owner, property, unit or tenant"
                            className="
                                h-11 w-full rounded-xl
                                border border-slate-200
                                bg-slate-50 pl-10 pr-4
                                text-sm text-slate-800
                                outline-none transition
                                placeholder:text-slate-400
                                focus:border-blue-500
                                focus:bg-white
                                focus:ring-4
                                focus:ring-blue-100
                            "
                        />
                    </div>

                    <select
                        value={status}
                        onChange={event => {
                            setStatus(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        className="
                            h-11 rounded-xl border
                            border-slate-200
                            bg-slate-50 px-3
                            text-sm text-slate-800
                            outline-none transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                        "
                    >
                        <option value="">
                            All statuses
                        </option>
                        {LEASE_STATUSES.map(
                            leaseStatus => (
                                <option
                                    key={leaseStatus}
                                    value={leaseStatus}
                                >
                                    {formatLabel(
                                        leaseStatus
                                    )}
                                </option>
                            )
                        )}
                    </select>

                    <input
                        type="date"
                        value={startDateFrom}
                        onChange={event => {
                            setStartDateFrom(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        aria-label="Lease start date from"
                        className="
                            h-11 rounded-xl border
                            border-slate-200
                            bg-slate-50 px-3
                            text-sm text-slate-800
                            outline-none transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                        "
                    />

                    <input
                        type="date"
                        value={endDateTo}
                        min={startDateFrom || undefined}
                        onChange={event => {
                            setEndDateTo(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        aria-label="Lease end date to"
                        className="
                            h-11 rounded-xl border
                            border-slate-200
                            bg-slate-50 px-3
                            text-sm text-slate-800
                            outline-none transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                        "
                    />

                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            size="lg"
                            leftIcon={Search}
                            className="flex-1"
                        >
                            Search
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            onClick={clearFilters}
                        >
                            Clear
                        </Button>
                    </div>
                </form>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
                    <span>
                        Start date from: {startDateFrom || "Any"}
                    </span>
                    <span>
                        End date to: {endDateTo || "Any"}
                    </span>
                </div>
            </div>

            {downloadSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {downloadSuccess}
                </div>
            )}

            {error && (
                <div
                    className="
                        rounded-2xl border
                        border-rose-200
                        bg-rose-50 px-4 py-3
                        text-sm text-rose-700
                    "
                >
                    {error}
                </div>
            )}

            <div
                className="
                    overflow-hidden rounded-2xl
                    border border-slate-200
                    bg-white shadow-sm
                "
            >
                <div
                    className="
                        flex flex-col gap-2
                        border-b border-slate-200
                        px-5 py-4
                        sm:flex-row sm:items-center
                        sm:justify-between
                    "
                >
                    <div>
                        <h2 className="text-lg font-bold text-slate-950">
                            Lease List
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {pagination.total_records}{" "}
                            lease
                            {pagination.total_records === 1 ? "" : "s"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {visibleFinancialCount > 0 && (
                            <label className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-600">
                                    PDF Language
                                </span>

                                <select
                                    value={leasePdfLanguage}
                                    disabled={
                                        Boolean(
                                            downloadingLeasePublicId
                                        )
                                    }
                                    onChange={event => {
                                        setLeasePdfLanguage(
                                            event.target.value
                                        );
                                        setDownloadSuccess(
                                            ""
                                        );
                                        setError("");
                                    }}
                                    aria-label="Lease PDF language"
                                    className="
                                        h-9 rounded-xl border
                                        border-slate-200
                                        bg-slate-50 px-3
                                        text-sm font-medium
                                        text-slate-700
                                        outline-none transition
                                        focus:border-blue-500
                                        focus:bg-white
                                        focus:ring-4
                                        focus:ring-blue-100
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                >
                                    {LEASE_PDF_LANGUAGES.map(
                                        language => (
                                            <option
                                                key={
                                                    language.value
                                                }
                                                value={
                                                    language.value
                                                }
                                            >
                                                {
                                                    language.label
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                        )}

                        <span className="text-sm text-slate-500">
                            Page {pagination.page || 1}
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading leases...
                    </div>
                ) : leases.length === 0 ? (
                    <div className="min-h-[320px] px-6 py-16 text-center">
                        <FileText className="mx-auto h-9 w-9 text-slate-300" />
                        <p className="mt-4 font-semibold text-slate-700">
                            No leases found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            Try another search, lifecycle status or date range.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3.5">Lease</th>
                                    <th className="px-5 py-3.5">Parties</th>
                                    <th className="px-5 py-3.5">Property / Unit</th>
                                    <th className="px-5 py-3.5">Period</th>
                                    <th className="px-5 py-3.5">Finance</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {leases.map(
                                    lease => (
                                        <tr
                                            key={lease.public_id}
                                            className="transition hover:bg-slate-50/70"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                                        <FileText className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">
                                                            {lease.lease_number}
                                                        </p>
                                                        <p
                                                            className="mt-1 max-w-[220px] truncate text-xs text-slate-500"
                                                            title={lease.public_id}
                                                        >
                                                            {lease.public_id}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-700">
                                                <p className="font-medium text-slate-900">
                                                    {lease.tenant?.display_name || "—"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Owner: {lease.owner?.display_name || "—"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-700">
                                                <p className="font-medium text-slate-900">
                                                    {lease.property?.property_name || "—"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {lease.unit?.unit_name || lease.unit?.unit_code || "—"}
                                                    {lease.unit?.unit_name && lease.unit?.unit_code
                                                        ? ` · ${lease.unit.unit_code}`
                                                        : ""}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-700">
                                                <p>{formatDate(lease.start_date)}</p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    to {formatDate(lease.end_date)}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-700">
                                                {lease.can_view_finances ? (
                                                    <>
                                                        <p className="font-medium text-slate-900">
                                                            {formatMoney(
                                                                lease.rent_amount,
                                                                lease.currency_code
                                                            )}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {formatLabel(
                                                                lease.billing_frequency
                                                            )}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                                        Restricted
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`
                                                        inline-flex rounded-full
                                                        px-2.5 py-1 text-xs
                                                        font-semibold ring-1
                                                        ${statusClassName(
                                                            lease.status
                                                        )}
                                                    `}
                                                >
                                                    {formatLabel(lease.status)}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <IconButton
                                                        label={`View ${lease.lease_number}`}
                                                        icon={Eye}
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setDetailLease(lease)
                                                        }
                                                    />

                                                    {lease.can_view_finances && (
                                                        <IconButton
                                                            label={`Download ${getLeasePdfLanguageLabel(
                                                                leasePdfLanguage
                                                            )} PDF for ${lease.lease_number}`}
                                                            icon={Download}
                                                            variant="secondary"
                                                            loading={
                                                                downloadingLeasePublicId ===
                                                                lease.public_id
                                                            }
                                                            disabled={
                                                                Boolean(
                                                                    downloadingLeasePublicId
                                                                )
                                                            }
                                                            onClick={() =>
                                                                handleDownloadLeasePdf(
                                                                    lease
                                                                )
                                                            }
                                                        />
                                                    )}

                                                    <IconButton
                                                        label={`${lease.status === "draft" ? "Manage" : "View"} terms for ${lease.lease_number}`}
                                                        icon={FileText}
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setClausesLease(lease)
                                                        }
                                                    />

                                                    {lease.status === "draft" ? (
                                                        <>
                                                            <IconButton
                                                                label={`Edit ${lease.lease_number}`}
                                                                icon={PencilLine}
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
        setTerminateSuccess("");
                                                                    setRenewSuccess("");
                                                                    setEditLease(lease);
                                                                }}
                                                            />

                                                            <IconButton
                                                                label={`Schedule ${lease.lease_number}`}
                                                                icon={CalendarDays}
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
        setTerminateSuccess("");
                                                                    setRenewSuccess("");
                                                                    setScheduleLease(lease);
                                                                }}
                                                            />

                                                            <IconButton
                                                                label={`Cancel ${lease.lease_number}`}
                                                                icon={Ban}
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
        setTerminateSuccess("");
                                                                    setRenewSuccess("");
                                                                    setCancelLease(lease);
                                                                }}
                                                            />
                                                        </>
                                                    ) : lease.status === "scheduled" ? (
                                                        <>
                                                            <IconButton
                                                                label={`Activate ${lease.lease_number}`}
                                                                icon={ShieldCheck}
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
        setTerminateSuccess("");
                                                                    setRenewSuccess("");
                                                                    setActivateLease(lease);
                                                                }}
                                                            />

                                                            <IconButton
                                                                label={`Cancel ${lease.lease_number}`}
                                                                icon={Ban}
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
        setTerminateSuccess("");
                                                                    setRenewSuccess("");
                                                                    setCancelLease(lease);
                                                                }}
                                                            />
                                                        </>
                                                    ) : lease.status === "active" ? (
                                                        <>
                                                            <IconButton
                                                                label={`Renew ${lease.lease_number}`}
                                                                icon={Repeat2}
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
                                                                    setTerminateSuccess("");
                                                                    setExpireSuccess("");
                                                                    setRenewSuccess("");
                                                                    setRenewLease(lease);
                                                                }}
                                                            />

                                                            <IconButton
                                                                label={`Expire ${lease.lease_number}`}
                                                                icon={CalendarDays}
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
                                                                    setTerminateSuccess("");
                                                                    setExpireSuccess("");
                                                                    setRenewSuccess("");
                                                                    setExpireLease(lease);
                                                                }}
                                                            />

                                                            <IconButton
                                                                label={`Terminate ${lease.lease_number}`}
                                                                icon={ShieldX}
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setCreateSuccess("");
                                                                    setEditSuccess("");
                                                                    setScheduleSuccess("");
                                                                    setActivateSuccess("");
                                                                    setCancelSuccess("");
                                                                    setTerminateSuccess("");
                                                                    setExpireSuccess("");
                                                                    setRenewSuccess("");
                                                                    setTerminateLease(lease);
                                                                }}
                                                            />
                                                        </>
                                                    ) : lease.status === "expired" ? (
                                                        <IconButton
                                                            label={`Renew ${lease.lease_number}`}
                                                            icon={Repeat2}
                                                            variant="secondary"
                                                            onClick={() => {
                                                                setCreateSuccess("");
                                                                setEditSuccess("");
                                                                setScheduleSuccess("");
                                                                setActivateSuccess("");
                                                                setCancelSuccess("");
                                                                setTerminateSuccess("");
                                                                setExpireSuccess("");
                                                                setRenewSuccess("");
                                                                setRenewLease(lease);
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-slate-400">
                                                            —
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div
                    className="
                        flex flex-col gap-3
                        border-t border-slate-200
                        bg-slate-50/70 px-5 py-4
                        sm:flex-row sm:items-center
                        sm:justify-between
                    "
                >
                    <p className="text-sm text-slate-500">
                        Page {pagination.page || 1} of {pagination.total_pages}
                    </p>

                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={ChevronLeft}
                            disabled={
                                loading ||
                                !pagination.has_previous_page
                            }
                            onClick={() =>
                                setPage(current =>
                                    Math.max(1, current - 1)
                                )
                            }
                        >
                            Previous
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            rightIcon={ChevronRight}
                            disabled={
                                loading ||
                                !pagination.has_next_page
                            }
                            onClick={() =>
                                setPage(current => current + 1)
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <CreateLeaseModal
                open={createOpen}
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={
                    handleLeaseCreated
                }
            />

            <EditLeaseModal
                open={Boolean(editLease)}
                lease={editLease}
                onClose={() =>
                    setEditLease(null)
                }
                onUpdated={
                    handleLeaseUpdated
                }
            />

            <ScheduleLeaseModal
                open={Boolean(scheduleLease)}
                lease={scheduleLease}
                onClose={() =>
                    setScheduleLease(null)
                }
                onScheduled={
                    handleLeaseScheduled
                }
            />

            <ActivateLeaseModal
                open={Boolean(activateLease)}
                lease={activateLease}
                onClose={() =>
                    setActivateLease(null)
                }
                onActivated={
                    handleLeaseActivated
                }
            />

            <CancelLeaseModal
                open={Boolean(cancelLease)}
                lease={cancelLease}
                onClose={() =>
                    setCancelLease(null)
                }
                onCancelled={
                    handleLeaseCancelled
                }
            />

            <TerminateLeaseModal
                open={Boolean(terminateLease)}
                lease={terminateLease}
                onClose={() =>
                    setTerminateLease(null)
                }
                onTerminated={
                    handleLeaseTerminated
                }
            />

            <ExpireLeaseModal
                open={Boolean(expireLease)}
                lease={expireLease}
                onClose={() =>
                    setExpireLease(null)
                }
                onExpired={
                    handleLeaseExpired
                }
            />

            <RenewLeaseModal
                open={Boolean(renewLease)}
                lease={renewLease}
                onClose={() =>
                    setRenewLease(null)
                }
                onRenewed={
                    handleLeaseRenewed
                }
            />

            <LeaseDetailModal
                open={Boolean(detailLease)}
                lease={detailLease}
                onClose={() =>
                    setDetailLease(null)
                }
            />

            <LeaseClausesModal
                open={Boolean(clausesLease)}
                lease={clausesLease}
                onClose={() =>
                    setClausesLease(null)
                }
            />

            <LeaseClauseTemplatesModal
                open={templatesOpen}
                onClose={() =>
                    setTemplatesOpen(false)
                }
            />
        </div>
    );
}

export default LeasesPage;
