import {
    AlertTriangle,
    Building2,
    CalendarClock,
    CircleCheckBig,
    Clock3,
    FileText,
    Home,
    MapPin,
    ShieldAlert,
    UserRound,
    UsersRound,
    Wrench,
    X
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

import EditMaintenanceRequestModal from "./EditMaintenanceRequestModal";
import UpdateMaintenanceSlaTargetsModal from "./UpdateMaintenanceSlaTargetsModal";
import EscalateMaintenanceRequestModal from "./EscalateMaintenanceRequestModal";
import ApplyMaintenanceUnitStatusLockModal from "./ApplyMaintenanceUnitStatusLockModal";
import ReleaseMaintenanceUnitStatusLockModal from "./ReleaseMaintenanceUnitStatusLockModal";
import ChangeMaintenanceStatusModal from "./ChangeMaintenanceStatusModal";
import CreateMaintenanceAssignmentModal from "./CreateMaintenanceAssignmentModal";
import ActivateMaintenanceAssignmentModal from "./ActivateMaintenanceAssignmentModal";
import AcceptMaintenanceAssignmentModal from "./AcceptMaintenanceAssignmentModal";
import DeclineMaintenanceAssignmentModal from "./DeclineMaintenanceAssignmentModal";
import RevokeMaintenanceAssignmentModal from "./RevokeMaintenanceAssignmentModal";
import ScheduleMaintenanceVisitModal from "./ScheduleMaintenanceVisitModal";
import StartMaintenanceVisitModal from "./StartMaintenanceVisitModal";
import CompleteMaintenanceVisitModal from "./CompleteMaintenanceVisitModal";
import MarkMaintenanceVisitMissedModal from "./MarkMaintenanceVisitMissedModal";
import CancelMaintenanceVisitModal from "./CancelMaintenanceVisitModal";
import RespondMaintenanceVisitModal from "./RespondMaintenanceVisitModal";
import RescheduleMaintenanceVisitModal from "./RescheduleMaintenanceVisitModal";
import CompleteMaintenanceAssignmentModal from "./CompleteMaintenanceAssignmentModal";
import ResolveMaintenanceRequestModal from "./ResolveMaintenanceRequestModal";
import ConfirmMaintenanceResolutionModal from "./ConfirmMaintenanceResolutionModal";
import DisputeMaintenanceResolutionModal from "./DisputeMaintenanceResolutionModal";
import NoResponseMaintenanceResolutionModal from "./NoResponseMaintenanceResolutionModal";
import CloseMaintenanceRequestModal from "./CloseMaintenanceRequestModal";
import CreateMaintenanceReopenRequestModal from "./CreateMaintenanceReopenRequestModal";
import ApproveMaintenanceReopenRequestModal from "./ApproveMaintenanceReopenRequestModal";
import RejectMaintenanceReopenRequestModal from "./RejectMaintenanceReopenRequestModal";
import CancelMaintenanceReopenRequestModal from "./CancelMaintenanceReopenRequestModal";
import MaintenanceCommentsPanel from "./MaintenanceCommentsPanel";
import MaintenanceAttachmentsPanel from "./MaintenanceAttachmentsPanel";
import MaintenanceCostsPanel from "./MaintenanceCostsPanel";
import DetermineMaintenanceResponsibilityModal from "./DetermineMaintenanceResponsibilityModal";
import MaintenanceResponsibilityAllocationsPanel from "./MaintenanceResponsibilityAllocationsPanel";
import MaintenanceAssignmentHistoryPanel from "./MaintenanceAssignmentHistoryPanel";
import MaintenanceVisitHistoryPanel from "./MaintenanceVisitHistoryPanel";
import MaintenanceResolutionHistoryPanel from "./MaintenanceResolutionHistoryPanel";
import MaintenanceReopenHistoryPanel from "./MaintenanceReopenHistoryPanel";
import MaintenanceStatusHistoryPanel from "./MaintenanceStatusHistoryPanel";
import MaintenanceActivityHistoryPanel from "./MaintenanceActivityHistoryPanel";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(parsed);
};

const formatDate = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return String(value);
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
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const amount =
        Number(value);

    if (
        Number.isNaN(amount)
    ) {
        return `${currencyCode || ""} ${value}`.trim();
    }

    if (!currencyCode) {
        return amount.toLocaleString();
    }

    try {
        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency:
                    currencyCode,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(amount);
    } catch {
        return `${currencyCode} ${amount.toLocaleString(
            undefined,
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )}`;
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance request.";

const statusClassName = status => {
    switch (status) {
        case "reported":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "under_review":
            return "border-violet-200 bg-violet-50 text-violet-700";

        case "assigned":
            return "border-cyan-200 bg-cyan-50 text-cyan-700";

        case "in_progress":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "on_hold":
            return "border-orange-200 bg-orange-50 text-orange-700";

        case "resolved":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "rejected":
        case "cancelled":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "closed":
        default:
            return "border-slate-300 bg-slate-100 text-slate-700";
    }
};

const priorityClassName = priority => {
    switch (priority) {
        case "emergency":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "high":
            return "border-orange-200 bg-orange-50 text-orange-700";

        case "medium":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "low":
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const hasOverdueSla = request =>
    Boolean(
        request?.sla?.review_overdue ||
        request?.sla?.work_start_overdue ||
        request?.sla?.resolution_overdue
    );

const DIRECT_STATUS_TRANSITIONS = {
    reported: [
        "under_review",
        "rejected",
        "cancelled"
    ],
    under_review: [
        "in_progress",
        "rejected",
        "cancelled"
    ],
    assigned: [
        "in_progress",
        "cancelled"
    ],
    in_progress: [
        "on_hold"
    ],
    on_hold: [
        "in_progress",
        "cancelled"
    ],
    resolved: [
        "in_progress"
    ]
};

function DetailRow({
    label,
    value
}) {
    return (
        <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </dt>

            <dd className="break-words text-sm font-medium text-slate-800">
                {value ?? "—"}
            </dd>
        </div>
    );
}

function Section({
    icon: Icon,
    title,
    children
}) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <Icon className="h-4 w-4 text-blue-600" />

                <h3 className="text-sm font-bold text-slate-900">
                    {title}
                </h3>
            </div>

            <div className="px-4 py-1">
                {children}
            </div>
        </section>
    );
}

function MaintenanceDetailModal({
    maintenanceRequestPublicId,
    accessContext,
    onChanged,
    onClose
}) {
    const [
        request,
        setRequest
    ] = useState(null);

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        error,
        setError
    ] = useState("");

    const [
        editRequestOpen,
        setEditRequestOpen
    ] = useState(false);

    const [
        slaTargetsOpen,
        setSlaTargetsOpen
    ] = useState(false);

    const [
        escalateOpen,
        setEscalateOpen
    ] = useState(false);

    const [
        applyUnitStatusLockOpen,
        setApplyUnitStatusLockOpen
    ] = useState(false);

    const [
        releaseUnitStatusLockOpen,
        setReleaseUnitStatusLockOpen
    ] = useState(false);

    const [
        statusModalOpen,
        setStatusModalOpen
    ] = useState(false);

    const [
        assignmentModalOpen,
        setAssignmentModalOpen
    ] = useState(false);

    const [
        activateAssignmentOpen,
        setActivateAssignmentOpen
    ] = useState(false);

    const [
        acceptAssignmentOpen,
        setAcceptAssignmentOpen
    ] = useState(false);

    const [
        declineAssignmentOpen,
        setDeclineAssignmentOpen
    ] = useState(false);

    const [
        revokeAssignmentOpen,
        setRevokeAssignmentOpen
    ] = useState(false);

    const [
        scheduleVisitOpen,
        setScheduleVisitOpen
    ] = useState(false);

    const [
        startVisitOpen,
        setStartVisitOpen
    ] = useState(false);

    const [
        completeVisitOpen,
        setCompleteVisitOpen
    ] = useState(false);

    const [
        missedVisitOpen,
        setMissedVisitOpen
    ] = useState(false);

    const [
        cancelVisitOpen,
        setCancelVisitOpen
    ] = useState(false);

    const [
        respondVisitOpen,
        setRespondVisitOpen
    ] = useState(false);

    const [
        rescheduleVisitOpen,
        setRescheduleVisitOpen
    ] = useState(false);

    const [
        completeAssignmentOpen,
        setCompleteAssignmentOpen
    ] = useState(false);

    const [
        resolveRequestOpen,
        setResolveRequestOpen
    ] = useState(false);

    const [
        confirmResolutionOpen,
        setConfirmResolutionOpen
    ] = useState(false);

    const [
        disputeResolutionOpen,
        setDisputeResolutionOpen
    ] = useState(false);

    const [
        noResponseResolutionOpen,
        setNoResponseResolutionOpen
    ] = useState(false);

    const [
        closeRequestOpen,
        setCloseRequestOpen
    ] = useState(false);

    const [
        reopenRequestOpen,
        setReopenRequestOpen
    ] = useState(false);

    const [
        approveReopenOpen,
        setApproveReopenOpen
    ] = useState(false);

    const [
        rejectReopenOpen,
        setRejectReopenOpen
    ] = useState(false);

    const [
        cancelReopenOpen,
        setCancelReopenOpen
    ] = useState(false);

    const [
        responsibilityModalOpen,
        setResponsibilityModalOpen
    ] = useState(false);

    const [
        reopenRequestSubmitted,
        setReopenRequestSubmitted
    ] = useState(false);

    const [
        detailRefreshKey,
        setDetailRefreshKey
    ] = useState(0);

    useEffect(() => {
        let active = true;

        const loadRequest =
            async () => {
                try {
                    setLoading(true);
                    setError("");
                    setRequest(null);

                    const params = {};

                    if (
                        accessContext
                    ) {
                        params.access_context =
                            accessContext;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequestPublicId
                            )}`,
                            {
                                params
                            }
                        );

                    const loadedRequest =
                        response?.data
                            ?.data
                            ?.maintenance_request;

                    if (
                        !loadedRequest
                    ) {
                        throw new Error(
                            "Maintenance request response did not include maintenance_request."
                        );
                    }

                    if (active) {
                        setRequest(
                            loadedRequest
                        );
                    }
                } catch (
                    requestError
                ) {
                    if (active) {
                        setError(
                            getErrorMessage(
                                requestError
                            )
                        );
                    }
                } finally {
                    if (active) {
                        setLoading(false);
                    }
                }
            };

        loadRequest();

        return () => {
            active = false;
        };
    }, [
        accessContext,
        detailRefreshKey,
        maintenanceRequestPublicId
    ]);

    useEffect(() => {
        const handleKeyDown =
            event => {
                if (
                    event.key ===
                    "Escape"
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
        onClose
    ]);

    const assignmentName =
        useMemo(
            () => {
                const assignment =
                    request
                        ?.current_assignment;

                if (!assignment) {
                    return "—";
                }

                if (
                    assignment.technician
                        ?.full_name
                ) {
                    return assignment
                        .technician
                        .full_name;
                }

                const provider =
                    assignment.provider;

                return (
                    provider?.company_name ||
                    provider?.vendor_name ||
                    provider?.display_name ||
                    "—"
                );
            },
            [
                request
            ]
        );

    const counts =
        request?.related_counts ||
        {};

    const nextVisit =
        request?.next_visit;

    const latestResolution =
        request?.latest_resolution;

    const costSummary =
        request?.cost_summary;

    const directStatusTargets =
        DIRECT_STATUS_TRANSITIONS[
            request?.status
        ] || [];

    const canDetermineResponsibility =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        [
            "reported",
            "under_review",
            "assigned",
            "in_progress",
            "on_hold",
            "resolved"
        ].includes(
            request?.status
        );

    const canEditRequest =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        ![
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            request?.status
        );

    const canUpdateSlaTargets =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        ![
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            request?.status
        );

    const canEscalateRequest =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        [
            "low",
            "medium",
            "high"
        ].includes(
            request?.priority
        ) &&
        ![
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            request?.status
        );

    const canApplyUnitStatusLock =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        request?.request_scope ===
            "unit" &&
        request?.impact_level ===
            "uninhabitable" &&
        request?.unit &&
        !request?.active_unit_status_lock &&
        ![
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            request?.status
        );

    const canReleaseUnitStatusLock =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        Boolean(
            request
                ?.active_unit_status_lock
                ?.is_active
        );

    const canChangeStatus =
        accessContext !== "tenant" &&
        directStatusTargets.length > 0;

    const canCreateAssignment =
        accessContext !== "tenant" &&
        request?.status ===
            "under_review" &&
        !request?.current_assignment;

    const canAcceptAssignment =
        (
            !accessContext ||
            [
                "owner",
                "technician"
            ].includes(
                accessContext
            )
        ) &&
        request
            ?.current_assignment
            ?.status ===
            "pending";

    const canDeclineAssignment =
        (
            !accessContext ||
            [
                "owner",
                "technician"
            ].includes(
                accessContext
            )
        ) &&
        request
            ?.current_assignment
            ?.status ===
            "pending";

    const canRevokeAssignment =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        [
            "pending",
            "accepted",
            "active"
        ].includes(
            request
                ?.current_assignment
                ?.status
        );

    const canActivateAssignment =
        accessContext !== "tenant" &&
        [
            "pending",
            "accepted"
        ].includes(
            request
                ?.current_assignment
                ?.status
        );

    const canScheduleVisit =
        accessContext !== "tenant" &&
        [
            "reported",
            "under_review",
            "assigned",
            "in_progress",
            "on_hold"
        ].includes(
            request?.status
        );

    const canStartVisit =
        accessContext !== "tenant" &&
        [
            "scheduled",
            "confirmed",
            "rescheduled"
        ].includes(
            request?.next_visit?.status
        );

    const canCompleteVisit =
        accessContext !== "tenant" &&
        request?.next_visit?.status ===
            "in_progress";

    const canMarkVisitMissed =
        (
            !accessContext ||
            [
                "owner",
                "technician"
            ].includes(
                accessContext
            )
        ) &&
        [
            "scheduled",
            "confirmed",
            "rescheduled"
        ].includes(
            request?.next_visit?.status
        );

    const canCancelVisit =
        (
            !accessContext ||
            [
                "owner",
                "technician"
            ].includes(
                accessContext
            )
        ) &&
        [
            "scheduled",
            "confirmed",
            "rescheduled",
            "in_progress"
        ].includes(
            request?.next_visit?.status
        );

    const canRespondToVisit =
        (
            !accessContext ||
            accessContext === "tenant"
        ) &&
        [
            "scheduled",
            "confirmed",
            "rescheduled"
        ].includes(
            request?.next_visit?.status
        ) &&
        [
            "pending",
            "confirmed",
            "declined"
        ].includes(
            request?.next_visit
                ?.tenant_confirmation_status
        );

    const canRescheduleVisit =
        (
            !accessContext ||
            [
                "owner",
                "technician"
            ].includes(
                accessContext
            )
        ) &&
        [
            "scheduled",
            "confirmed",
            "rescheduled"
        ].includes(
            request?.next_visit?.status
        );

    const canCompleteAssignment =
        accessContext !== "tenant" &&
        request?.current_assignment
            ?.status === "active" &&
        !request?.next_visit;

    const canResolveRequest =
        accessContext !== "tenant" &&
        request?.status ===
            "in_progress" &&
        !request?.current_assignment &&
        !request?.next_visit;

    const canConfirmResolution =
        (
            !accessContext ||
            accessContext === "tenant"
        ) &&
        request?.status ===
            "resolved" &&
        request?.latest_resolution
            ?.confirmation_status ===
            "pending";

    const canDisputeResolution =
        (
            !accessContext ||
            accessContext === "tenant"
        ) &&
        request?.status ===
            "resolved" &&
        request?.latest_resolution
            ?.confirmation_status ===
            "pending";

    const resolutionDeadlineMs =
        request?.latest_resolution
            ?.confirmation_deadline_at
            ? new Date(
                  request.latest_resolution
                      .confirmation_deadline_at
              ).getTime()
            : null;

    const resolutionDeadlinePassed =
        Number.isFinite(
            resolutionDeadlineMs
        ) &&
        resolutionDeadlineMs <=
            Date.now();

    const canMarkNoResponse =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        request?.status ===
            "resolved" &&
        request?.latest_resolution
            ?.confirmation_status ===
            "pending" &&
        resolutionDeadlinePassed;

    const canCloseRequest =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        request?.status ===
            "resolved" &&
        [
            "confirmed",
            "no_response",
            "not_required"
        ].includes(
            request?.latest_resolution
                ?.confirmation_status
        );

    const canRequestReopen =
        (
            !accessContext ||
            [
                "owner",
                "tenant"
            ].includes(
                accessContext
            )
        ) &&
        [
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            request?.status
        ) &&
        !reopenRequestSubmitted;

    const canReviewReopen =
        (
            !accessContext ||
            accessContext === "owner"
        ) &&
        [
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            request?.status
        );

    const canCancelReopen =
        (
            !accessContext ||
            [
                "owner",
                "tenant"
            ].includes(
                accessContext
            )
        ) &&
        [
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            request?.status
        );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6">
            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-xl font-bold text-slate-950">
                                Maintenance Request
                            </h2>

                            {request?.status && (
                                <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                        request.status
                                    )}`}
                                >
                                    {
                                        formatLabel(
                                            request.status
                                        )
                                    }
                                </span>
                            )}

                            {request?.priority && (
                                <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClassName(
                                        request.priority
                                    )}`}
                                >
                                    {
                                        formatLabel(
                                            request.priority
                                        )
                                    }
                                </span>
                            )}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                            {request?.request_number ||
                                maintenanceRequestPublicId}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close maintenance request detail"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="space-y-5 p-4 sm:p-6">
                        {loading && (
                            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
                                Loading maintenance request...
                            </div>
                        )}

                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            request && (
                                <>
                                    {hasOverdueSla(
                                        request
                                    ) && (
                                        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />

                                            <div>
                                                <p className="text-sm font-bold text-rose-800">
                                                    SLA attention required
                                                </p>

                                                <p className="mt-1 text-xs leading-5 text-rose-700">
                                                    One or more maintenance SLA targets are overdue.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <Section
                                        icon={FileText}
                                        title="Request Details"
                                    >
                                        <DetailRow
                                            label="Title"
                                            value={
                                                request.title
                                            }
                                        />

                                        <DetailRow
                                            label="Description"
                                            value={
                                                request.description
                                            }
                                        />

                                        <DetailRow
                                            label="Category"
                                            value={
                                                formatLabel(
                                                    request.category
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Impact"
                                            value={
                                                formatLabel(
                                                    request.impact_level
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Scope"
                                            value={
                                                formatLabel(
                                                    request.request_scope
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Source"
                                            value={
                                                formatLabel(
                                                    request.request_source
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Location"
                                            value={
                                                request.location_details ||
                                                "—"
                                            }
                                        />

                                        <DetailRow
                                            label="Problem Started"
                                            value={
                                                formatDateTime(
                                                    request.problem_started_at
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Preferred Visit"
                                            value={
                                                formatDateTime(
                                                    request.preferred_visit_at
                                                )
                                            }
                                        />

                                        <DetailRow
                                            label="Access Instruction"
                                            value={
                                                formatLabel(
                                                    request.access_instruction
                                                ) ||
                                                "—"
                                            }
                                        />
                                    </Section>

                                    <div className="grid gap-5 xl:grid-cols-2">
                                        <Section
                                            icon={Building2}
                                            title="Property Context"
                                        >
                                            <DetailRow
                                                label="Owner"
                                                value={
                                                    request.owner
                                                        ?.display_name ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Property"
                                                value={
                                                    request.property
                                                        ?.property_name ||
                                                    request.property
                                                        ?.property_code ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Property Code"
                                                value={
                                                    request.property
                                                        ?.property_code ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Unit"
                                                value={
                                                    request.unit
                                                        ? request.unit
                                                              .unit_name ||
                                                          request.unit
                                                              .unit_code ||
                                                          "Unit"
                                                        : request.request_scope ===
                                                            "property_common_area"
                                                          ? "Property Common Area"
                                                          : "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Tenant"
                                                value={
                                                    request.tenant
                                                        ?.display_name ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Lease"
                                                value={
                                                    request.lease
                                                        ?.lease_number ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Lease Period"
                                                value={
                                                    request.lease
                                                        ? `${formatDate(
                                                              request.lease
                                                                  .start_date
                                                          )} — ${formatDate(
                                                              request.lease
                                                                  .end_date
                                                          )}`
                                                        : "—"
                                                }
                                            />
                                        </Section>

                                        <Section
                                            icon={UserRound}
                                            title="Reporting & Audit"
                                        >
                                            <DetailRow
                                                label="Reporter"
                                                value={
                                                    request.reporter
                                                        ?.full_name ||
                                                    "System"
                                                }
                                            />

                                            <DetailRow
                                                label="Reporter Type"
                                                value={
                                                    formatLabel(
                                                        request.reporter
                                                            ?.type
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Reported At"
                                                value={
                                                    formatDateTime(
                                                        request.reported_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Created At"
                                                value={
                                                    formatDateTime(
                                                        request.created_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Updated At"
                                                value={
                                                    formatDateTime(
                                                        request.updated_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Resolution Confirmation"
                                                value={
                                                    formatLabel(
                                                        request
                                                            .resolution_confirmation
                                                            ?.status
                                                    ) ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Confirmation Deadline"
                                                value={
                                                    formatDateTime(
                                                        request
                                                            .resolution_confirmation
                                                            ?.deadline_at
                                                    )
                                                }
                                            />
                                        </Section>
                                    </div>

                                    <Section
                                        icon={Clock3}
                                        title="SLA"
                                    >
                                        <div className="grid gap-x-6 md:grid-cols-2">
                                            <DetailRow
                                                label="Target Review"
                                                value={
                                                    formatDateTime(
                                                        request.sla
                                                            ?.target_review_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Reviewed"
                                                value={
                                                    formatDateTime(
                                                        request.sla
                                                            ?.reviewed_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Target Work Start"
                                                value={
                                                    formatDateTime(
                                                        request.sla
                                                            ?.target_work_start_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Work Started"
                                                value={
                                                    formatDateTime(
                                                        request.sla
                                                            ?.work_started_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Target Resolution"
                                                value={
                                                    formatDateTime(
                                                        request.sla
                                                            ?.target_resolution_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Resolution Clock"
                                                value={
                                                    request.sla
                                                        ?.resolution_clock_paused_at
                                                        ? "Paused"
                                                        : "Running / Completed"
                                                }
                                            />
                                        </div>
                                    </Section>

                                    <div className="grid gap-5 xl:grid-cols-2">
                                        <Section
                                            icon={Wrench}
                                            title="Current Assignment"
                                        >
                                            <DetailRow
                                                label="Type"
                                                value={
                                                    formatLabel(
                                                        request
                                                            .current_assignment
                                                            ?.assignment_type
                                                    ) ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Assigned To"
                                                value={
                                                    assignmentName
                                                }
                                            />

                                            <DetailRow
                                                label="Status"
                                                value={
                                                    formatLabel(
                                                        request
                                                            .current_assignment
                                                            ?.status
                                                    ) ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Assigned At"
                                                value={
                                                    formatDateTime(
                                                        request
                                                            .current_assignment
                                                            ?.assigned_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Accepted At"
                                                value={
                                                    formatDateTime(
                                                        request
                                                            .current_assignment
                                                            ?.accepted_at
                                                    )
                                                }
                                            />
                                        </Section>

                                        <Section
                                            icon={CalendarClock}
                                            title="Next Visit"
                                        >
                                            <DetailRow
                                                label="Visit Type"
                                                value={
                                                    formatLabel(
                                                        nextVisit
                                                            ?.visit_type
                                                    ) ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Status"
                                                value={
                                                    formatLabel(
                                                        nextVisit
                                                            ?.status
                                                    ) ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Scheduled Start"
                                                value={
                                                    formatDateTime(
                                                        nextVisit
                                                            ?.scheduled_start_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Scheduled End"
                                                value={
                                                    formatDateTime(
                                                        nextVisit
                                                            ?.scheduled_end_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Purpose"
                                                value={
                                                    nextVisit
                                                        ?.visit_purpose ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Tenant Confirmation"
                                                value={
                                                    formatLabel(
                                                        nextVisit
                                                            ?.tenant_confirmation_status
                                                    ) ||
                                                    "—"
                                                }
                                            />
                                        </Section>
                                    </div>

                                    <div className="grid gap-5 xl:grid-cols-2">
                                        <Section
                                            icon={CircleCheckBig}
                                            title="Latest Resolution"
                                        >
                                            <DetailRow
                                                label="Sequence"
                                                value={
                                                    latestResolution
                                                        ?.sequence_number ??
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Summary"
                                                value={
                                                    latestResolution
                                                        ?.resolution_summary ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Work Completed"
                                                value={
                                                    formatDateTime(
                                                        latestResolution
                                                            ?.work_completed_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Confirmation"
                                                value={
                                                    formatLabel(
                                                        latestResolution
                                                            ?.confirmation_status
                                                    ) ||
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Submitted At"
                                                value={
                                                    formatDateTime(
                                                        latestResolution
                                                            ?.submitted_at
                                                    )
                                                }
                                            />
                                        </Section>

                                        <Section
                                            icon={UsersRound}
                                            title="Related Records"
                                        >
                                            <DetailRow
                                                label="Assignments"
                                                value={
                                                    counts.assignments ??
                                                    0
                                                }
                                            />

                                            <DetailRow
                                                label="Visits"
                                                value={
                                                    counts.visits ??
                                                    0
                                                }
                                            />

                                            <DetailRow
                                                label="Visible Comments"
                                                value={
                                                    counts.visible_comments ??
                                                    0
                                                }
                                            />

                                            <DetailRow
                                                label="Visible Attachments"
                                                value={
                                                    counts.visible_attachments ??
                                                    0
                                                }
                                            />

                                            <DetailRow
                                                label="Status History"
                                                value={
                                                    counts.status_history_entries ??
                                                    0
                                                }
                                            />
                                        </Section>
                                    </div>

                                    <MaintenanceCommentsPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                        onChanged={() => {
                                            setDetailRefreshKey(
                                                current =>
                                                    current + 1
                                            );

                                            onChanged?.();
                                        }}
                                    />

                                    {(
                                        !accessContext ||
                                        accessContext ===
                                            "owner"
                                    ) && (
                                        <MaintenanceCostsPanel
                                            maintenanceRequest={
                                                request
                                            }
                                            accessContext={
                                                accessContext
                                            }
                                            onChanged={() => {
                                                setDetailRefreshKey(
                                                    current =>
                                                        current +
                                                        1
                                                );

                                                onChanged?.();
                                            }}
                                        />
                                    )}

                                    <MaintenanceResponsibilityAllocationsPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                        onChanged={() => {
                                            setDetailRefreshKey(
                                                current =>
                                                    current + 1
                                            );

                                            onChanged?.();
                                        }}
                                    />

                                    <MaintenanceAttachmentsPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                    />

                                    <MaintenanceAssignmentHistoryPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                    />

                                    <MaintenanceVisitHistoryPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                    />

                                    <MaintenanceResolutionHistoryPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                    />

                                    <MaintenanceReopenHistoryPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                    />

                                    <MaintenanceStatusHistoryPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                    />

                                    <MaintenanceActivityHistoryPanel
                                        maintenanceRequest={
                                            request
                                        }
                                        accessContext={
                                            accessContext
                                        }
                                    />

                                    {request.active_unit_status_lock && (
                                        <Section
                                            icon={Home}
                                            title="Active Unit Status Lock"
                                        >
                                            <DetailRow
                                                label="Active"
                                                value={
                                                    request
                                                        .active_unit_status_lock
                                                        .is_active
                                                        ? "Yes"
                                                        : "No"
                                                }
                                            />

                                            <DetailRow
                                                label="Applied At"
                                                value={
                                                    formatDateTime(
                                                        request
                                                            .active_unit_status_lock
                                                            .applied_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Restoration Status"
                                                value={
                                                    formatLabel(
                                                        request
                                                            .active_unit_status_lock
                                                            .restoration_status
                                                    ) ||
                                                    "—"
                                                }
                                            />
                                        </Section>
                                    )}

                                    {(request.responsibility ||
                                        costSummary) && (
                                        <Section
                                            icon={ShieldAlert}
                                            title="Responsibility & Cost"
                                        >
                                            {request.responsibility && (
                                                <>
                                                    <DetailRow
                                                        label="Coverage Type"
                                                        value={
                                                            formatLabel(
                                                                request
                                                                    .responsibility
                                                                    .coverage_type
                                                            ) ||
                                                            "—"
                                                        }
                                                    />

                                                    <DetailRow
                                                        label="Responsibility Status"
                                                        value={
                                                            formatLabel(
                                                                request
                                                                    .responsibility
                                                                    .status
                                                            ) ||
                                                            "—"
                                                        }
                                                    />
                                                </>
                                            )}

                                            {costSummary && (
                                                <>
                                                    <DetailRow
                                                        label="Estimated Cost"
                                                        value={
                                                            formatMoney(
                                                                costSummary.estimated,
                                                                costSummary.currency_code
                                                            )
                                                        }
                                                    />

                                                    <DetailRow
                                                        label="Approved Cost"
                                                        value={
                                                            formatMoney(
                                                                costSummary.approved,
                                                                costSummary.currency_code
                                                            )
                                                        }
                                                    />

                                                    <DetailRow
                                                        label="Actual Cost"
                                                        value={
                                                            formatMoney(
                                                                costSummary.actual,
                                                                costSummary.currency_code
                                                            )
                                                        }
                                                    />
                                                </>
                                            )}
                                        </Section>
                                    )}

                                    {request.preventive_plan && (
                                        <Section
                                            icon={MapPin}
                                            title="Preventive Maintenance Plan"
                                        >
                                            <DetailRow
                                                label="Title"
                                                value={
                                                    request
                                                        .preventive_plan
                                                        .title
                                                }
                                            />

                                            <DetailRow
                                                label="Frequency"
                                                value={
                                                    formatLabel(
                                                        request
                                                            .preventive_plan
                                                            .frequency
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Interval"
                                                value={
                                                    request
                                                        .preventive_plan
                                                        .interval_value ??
                                                    "—"
                                                }
                                            />

                                            <DetailRow
                                                label="Next Due"
                                                value={
                                                    formatDateTime(
                                                        request
                                                            .preventive_plan
                                                            .next_due_at
                                                    )
                                                }
                                            />

                                            <DetailRow
                                                label="Plan Status"
                                                value={
                                                    formatLabel(
                                                        request
                                                            .preventive_plan
                                                            .status
                                                    )
                                                }
                                            />
                                        </Section>
                                    )}
                                </>
                            )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                    {canCreateAssignment && (
                        <Button
                            type="button"
                            onClick={() =>
                                setAssignmentModalOpen(
                                    true
                                )
                            }
                        >
                            Create Assignment
                        </Button>
                    )}

                    {canCancelReopen && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setCancelReopenOpen(
                                    true
                                )
                            }
                        >
                            Cancel Reopen Request
                        </Button>
                    )}

                    {canReviewReopen && (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                    setRejectReopenOpen(
                                        true
                                    )
                                }
                            >
                                Reject Reopen
                            </Button>

                            <Button
                                type="button"
                                onClick={() =>
                                    setApproveReopenOpen(
                                        true
                                    )
                                }
                            >
                                Review Reopen Request
                            </Button>
                        </>
                    )}

                    {reopenRequestSubmitted && (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled
                        >
                            Reopen Requested
                        </Button>
                    )}

                    {canRequestReopen && (
                        <Button
                            type="button"
                            onClick={() =>
                                setReopenRequestOpen(
                                    true
                                )
                            }
                        >
                            Request Reopen
                        </Button>
                    )}

                    {canCloseRequest && (
                        <Button
                            type="button"
                            onClick={() =>
                                setCloseRequestOpen(
                                    true
                                )
                            }
                        >
                            Close Request
                        </Button>
                    )}

                    {canMarkNoResponse && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setNoResponseResolutionOpen(
                                    true
                                )
                            }
                        >
                            Mark No Response
                        </Button>
                    )}

                    {canDisputeResolution && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setDisputeResolutionOpen(
                                    true
                                )
                            }
                        >
                            Dispute Resolution
                        </Button>
                    )}

                    {canConfirmResolution && (
                        <Button
                            type="button"
                            onClick={() =>
                                setConfirmResolutionOpen(
                                    true
                                )
                            }
                        >
                            Confirm Resolution
                        </Button>
                    )}

                    {canResolveRequest && (
                        <Button
                            type="button"
                            onClick={() =>
                                setResolveRequestOpen(
                                    true
                                )
                            }
                        >
                            Resolve Request
                        </Button>
                    )}

                    {canCompleteAssignment && (
                        <Button
                            type="button"
                            onClick={() =>
                                setCompleteAssignmentOpen(
                                    true
                                )
                            }
                        >
                            Complete Assignment
                        </Button>
                    )}

                    {canCompleteVisit && (
                        <Button
                            type="button"
                            onClick={() =>
                                setCompleteVisitOpen(
                                    true
                                )
                            }
                        >
                            Complete Visit
                        </Button>
                    )}

                    {canRescheduleVisit && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setRescheduleVisitOpen(
                                    true
                                )
                            }
                        >
                            Reschedule Visit
                        </Button>
                    )}

                    {canRespondToVisit && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setRespondVisitOpen(
                                    true
                                )
                            }
                        >
                            Respond to Visit
                        </Button>
                    )}

                    {canCancelVisit && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setCancelVisitOpen(
                                    true
                                )
                            }
                        >
                            Cancel Visit
                        </Button>
                    )}

                    {canMarkVisitMissed && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setMissedVisitOpen(
                                    true
                                )
                            }
                        >
                            Mark Visit Missed
                        </Button>
                    )}

                    {canStartVisit && (
                        <Button
                            type="button"
                            onClick={() =>
                                setStartVisitOpen(
                                    true
                                )
                            }
                        >
                            Start Visit
                        </Button>
                    )}

                    {canScheduleVisit && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setScheduleVisitOpen(
                                    true
                                )
                            }
                        >
                            Schedule Visit
                        </Button>
                    )}

                    {canAcceptAssignment && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setAcceptAssignmentOpen(
                                    true
                                )
                            }
                        >
                            Accept Assignment
                        </Button>
                    )}

                    {canDeclineAssignment && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setDeclineAssignmentOpen(
                                    true
                                )
                            }
                        >
                            Decline Assignment
                        </Button>
                    )}

                    {canRevokeAssignment && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setRevokeAssignmentOpen(
                                    true
                                )
                            }
                        >
                            Revoke Assignment
                        </Button>
                    )}

                    {canActivateAssignment && (
                        <Button
                            type="button"
                            onClick={() =>
                                setActivateAssignmentOpen(
                                    true
                                )
                            }
                        >
                            Activate Assignment
                        </Button>
                    )}

                    {canDetermineResponsibility && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setResponsibilityModalOpen(
                                    true
                                )
                            }
                        >
                            Set Responsibility
                        </Button>
                    )}

                    {canEditRequest && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setEditRequestOpen(
                                    true
                                )
                            }
                        >
                            Edit Request
                        </Button>
                    )}

                    {canUpdateSlaTargets && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setSlaTargetsOpen(
                                    true
                                )
                            }
                        >
                            Update SLA Targets
                        </Button>
                    )}

                    {canEscalateRequest && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setEscalateOpen(
                                    true
                                )
                            }
                        >
                            Escalate to Emergency
                        </Button>
                    )}

                    {canApplyUnitStatusLock && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setApplyUnitStatusLockOpen(
                                    true
                                )
                            }
                        >
                            Apply Unit Maintenance Lock
                        </Button>
                    )}

                    {canReleaseUnitStatusLock && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setReleaseUnitStatusLockOpen(
                                    true
                                )
                            }
                        >
                            Release Unit Maintenance Lock
                        </Button>
                    )}

                    {canChangeStatus && (
                        <Button
                            type="button"
                            onClick={() =>
                                setStatusModalOpen(
                                    true
                                )
                            }
                        >
                            Change Status
                        </Button>
                    )}

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>

            <DetermineMaintenanceResponsibilityModal
                open={
                    responsibilityModalOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setResponsibilityModalOpen(
                        false
                    )
                }
                onDetermined={() => {
                    setResponsibilityModalOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <EditMaintenanceRequestModal
                open={
                    editRequestOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setEditRequestOpen(
                        false
                    )
                }
                onUpdated={() => {
                    setEditRequestOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <UpdateMaintenanceSlaTargetsModal
                open={
                    slaTargetsOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setSlaTargetsOpen(
                        false
                    )
                }
                onUpdated={() => {
                    setSlaTargetsOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <EscalateMaintenanceRequestModal
                open={
                    escalateOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setEscalateOpen(
                        false
                    )
                }
                onEscalated={() => {
                    setEscalateOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ApplyMaintenanceUnitStatusLockModal
                open={
                    applyUnitStatusLockOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setApplyUnitStatusLockOpen(
                        false
                    )
                }
                onApplied={() => {
                    setApplyUnitStatusLockOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ReleaseMaintenanceUnitStatusLockModal
                open={
                    releaseUnitStatusLockOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setReleaseUnitStatusLockOpen(
                        false
                    )
                }
                onReleased={() => {
                    setReleaseUnitStatusLockOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <CancelMaintenanceReopenRequestModal
                open={
                    cancelReopenOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setCancelReopenOpen(
                        false
                    )
                }
                onCancelled={() => {
                    setCancelReopenOpen(
                        false
                    );

                    setReopenRequestSubmitted(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <RejectMaintenanceReopenRequestModal
                open={
                    rejectReopenOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setRejectReopenOpen(
                        false
                    )
                }
                onRejected={() => {
                    setRejectReopenOpen(
                        false
                    );

                    setReopenRequestSubmitted(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ApproveMaintenanceReopenRequestModal
                open={
                    approveReopenOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setApproveReopenOpen(
                        false
                    )
                }
                onApproved={() => {
                    setApproveReopenOpen(
                        false
                    );

                    setReopenRequestSubmitted(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <CreateMaintenanceReopenRequestModal
                open={
                    reopenRequestOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setReopenRequestOpen(
                        false
                    )
                }
                onCreated={() => {
                    setReopenRequestOpen(
                        false
                    );

                    setReopenRequestSubmitted(
                        true
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <CloseMaintenanceRequestModal
                open={
                    closeRequestOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setCloseRequestOpen(
                        false
                    )
                }
                onClosed={() => {
                    setCloseRequestOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <NoResponseMaintenanceResolutionModal
                open={
                    noResponseResolutionOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setNoResponseResolutionOpen(
                        false
                    )
                }
                onMarked={() => {
                    setNoResponseResolutionOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <DisputeMaintenanceResolutionModal
                open={
                    disputeResolutionOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setDisputeResolutionOpen(
                        false
                    )
                }
                onDisputed={() => {
                    setDisputeResolutionOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ConfirmMaintenanceResolutionModal
                open={
                    confirmResolutionOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setConfirmResolutionOpen(
                        false
                    )
                }
                onConfirmed={() => {
                    setConfirmResolutionOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ResolveMaintenanceRequestModal
                open={
                    resolveRequestOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setResolveRequestOpen(
                        false
                    )
                }
                onResolved={() => {
                    setResolveRequestOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <CompleteMaintenanceAssignmentModal
                open={
                    completeAssignmentOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                assignment={
                    request
                        ?.current_assignment
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setCompleteAssignmentOpen(
                        false
                    )
                }
                onCompleted={() => {
                    setCompleteAssignmentOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <RescheduleMaintenanceVisitModal
                open={
                    rescheduleVisitOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                visit={
                    request?.next_visit
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setRescheduleVisitOpen(
                        false
                    )
                }
                onRescheduled={() => {
                    setRescheduleVisitOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <RespondMaintenanceVisitModal
                open={
                    respondVisitOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                visit={
                    request?.next_visit
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setRespondVisitOpen(
                        false
                    )
                }
                onResponded={() => {
                    setRespondVisitOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <CancelMaintenanceVisitModal
                open={
                    cancelVisitOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                visit={
                    request?.next_visit
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setCancelVisitOpen(
                        false
                    )
                }
                onCancelled={() => {
                    setCancelVisitOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <MarkMaintenanceVisitMissedModal
                open={
                    missedVisitOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                visit={
                    request?.next_visit
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setMissedVisitOpen(
                        false
                    )
                }
                onMissed={() => {
                    setMissedVisitOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <CompleteMaintenanceVisitModal
                open={
                    completeVisitOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                visit={
                    request?.next_visit
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setCompleteVisitOpen(
                        false
                    )
                }
                onCompleted={() => {
                    setCompleteVisitOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <StartMaintenanceVisitModal
                open={
                    startVisitOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                visit={
                    request?.next_visit
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setStartVisitOpen(
                        false
                    )
                }
                onStarted={() => {
                    setStartVisitOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ScheduleMaintenanceVisitModal
                open={
                    scheduleVisitOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setScheduleVisitOpen(
                        false
                    )
                }
                onScheduled={() => {
                    setScheduleVisitOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <AcceptMaintenanceAssignmentModal
                open={
                    acceptAssignmentOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                assignment={
                    request
                        ?.current_assignment
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setAcceptAssignmentOpen(
                        false
                    )
                }
                onAccepted={() => {
                    setAcceptAssignmentOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <DeclineMaintenanceAssignmentModal
                open={
                    declineAssignmentOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                assignment={
                    request
                        ?.current_assignment
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setDeclineAssignmentOpen(
                        false
                    )
                }
                onDeclined={() => {
                    setDeclineAssignmentOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <RevokeMaintenanceAssignmentModal
                open={
                    revokeAssignmentOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                assignment={
                    request
                        ?.current_assignment
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setRevokeAssignmentOpen(
                        false
                    )
                }
                onRevoked={() => {
                    setRevokeAssignmentOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ActivateMaintenanceAssignmentModal
                open={
                    activateAssignmentOpen
                }
                maintenanceRequestPublicId={
                    request?.public_id
                }
                assignment={
                    request
                        ?.current_assignment
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setActivateAssignmentOpen(
                        false
                    )
                }
                onActivated={() => {
                    setActivateAssignmentOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <CreateMaintenanceAssignmentModal
                open={
                    assignmentModalOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setAssignmentModalOpen(
                        false
                    )
                }
                onCreated={() => {
                    setAssignmentModalOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />

            <ChangeMaintenanceStatusModal
                open={
                    statusModalOpen
                }
                maintenanceRequest={
                    request
                }
                accessContext={
                    accessContext
                }
                allowedTargets={
                    directStatusTargets
                }
                onClose={() =>
                    setStatusModalOpen(
                        false
                    )
                }
                onChanged={() => {
                    setStatusModalOpen(
                        false
                    );

                    setDetailRefreshKey(
                        current =>
                            current + 1
                    );

                    onChanged?.();
                }}
            />
        </div>
    );
}

export default MaintenanceDetailModal;
