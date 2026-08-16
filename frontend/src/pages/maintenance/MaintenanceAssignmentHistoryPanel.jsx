import {
    RefreshCw,
    UserRoundCog
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const ASSIGNMENT_STATUSES = [
    "",
    "pending",
    "accepted",
    "declined",
    "active",
    "completed",
    "revoked"
];

const ASSIGNMENT_TYPES = [
    "",
    "internal_technician",
    "external_vendor"
];

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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance assignment history.";

const statusClassName = status => {
    switch (status) {
        case "active":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "completed":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "declined":
        case "revoked":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "accepted":
            return "border-indigo-200 bg-indigo-50 text-indigo-700";

        case "pending":
            return "border-amber-200 bg-amber-50 text-amber-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const getAssignmentTarget = assignment => {
    if (
        assignment?.assignment_type ===
        "internal_technician"
    ) {
        return (
            assignment?.technician
                ?.full_name ||
            assignment?.assigned_user
                ?.full_name ||
            assignment?.assigned_user_full_name ||
            assignment?.technician
                ?.public_id ||
            assignment?.assigned_user
                ?.public_id ||
            assignment?.assigned_user_public_id ||
            "Internal Technician"
        );
    }

    return (
        assignment?.provider
            ?.company_name ||
        assignment?.provider
            ?.vendor_name ||
        assignment?.provider
            ?.display_name ||
        assignment?.company_name ||
        assignment?.vendor_name ||
        "External Vendor"
    );
};

function MaintenanceAssignmentHistoryPanel({
    maintenanceRequest,
    accessContext
}) {
    const [
        assignments,
        setAssignments
    ] = useState([]);

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        status,
        setStatus
    ] = useState("");

    const [
        assignmentType,
        setAssignmentType
    ] = useState("");

    const [
        sortOrder,
        setSortOrder
    ] = useState("desc");

    const [
        pagination,
        setPagination
    ] = useState(null);

    const loadAssignments =
        useCallback(
            async () => {
                if (
                    !maintenanceRequest
                        ?.public_id
                ) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        sort_by:
                            "assigned_at",
                        sort_order:
                            sortOrder,
                        page: 1,
                        limit: 50
                    };

                    if (
                        accessContext
                    ) {
                        params.access_context =
                            accessContext;
                    }

                    if (status) {
                        params.status =
                            status;
                    }

                    if (
                        assignmentType
                    ) {
                        params.assignment_type =
                            assignmentType;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/assignments`,
                            {
                                params
                            }
                        );

                    const data =
                        response?.data?.data ||
                        {};

                    const rows =
                        data.maintenance_assignments ||
                        data.assignments ||
                        [];

                    setAssignments(
                        Array.isArray(rows)
                            ? rows
                            : []
                    );

                    setPagination(
                        response?.data
                            ?.pagination ||
                            null
                    );
                } catch (
                    requestError
                ) {
                    setAssignments([]);
                    setPagination(null);
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
                accessContext,
                assignmentType,
                maintenanceRequest
                    ?.public_id,
                sortOrder,
                status
            ]
        );

    useEffect(() => {
        loadAssignments();
    }, [
        loadAssignments
    ]);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                        <UserRoundCog className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Assignment History
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Complete assignment lifecycle across technicians and external vendors.
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={RefreshCw}
                    disabled={loading}
                    onClick={
                        loadAssignments
                    }
                >
                    Refresh History
                </Button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                        </span>

                        <select
                            value={status}
                            onChange={
                                event =>
                                    setStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {ASSIGNMENT_STATUSES.map(
                                item => (
                                    <option
                                        key={
                                            item ||
                                            "all-statuses"
                                        }
                                        value={
                                            item
                                        }
                                    >
                                        {item
                                            ? formatLabel(
                                                  item
                                              )
                                            : "All Statuses"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Assignment Type
                        </span>

                        <select
                            value={
                                assignmentType
                            }
                            onChange={
                                event =>
                                    setAssignmentType(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {ASSIGNMENT_TYPES.map(
                                item => (
                                    <option
                                        key={
                                            item ||
                                            "all-types"
                                        }
                                        value={
                                            item
                                        }
                                    >
                                        {item
                                            ? formatLabel(
                                                  item
                                              )
                                            : "All Types"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sort Order
                        </span>

                        <select
                            value={
                                sortOrder
                            }
                            onChange={
                                event =>
                                    setSortOrder(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="desc">
                                Newest First
                            </option>

                            <option value="asc">
                                Oldest First
                            </option>
                        </select>
                    </label>
                </div>

                {pagination && (
                    <p className="text-xs text-slate-400">
                        Total records:{" "}
                        {pagination.total_records ??
                            assignments.length}
                    </p>
                )}

                {loading && (
                    <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading assignment history...
                    </div>
                )}

                {!loading &&
                    assignments.length ===
                        0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No maintenance assignment history found.
                        </div>
                    )}

                {!loading &&
                    assignments.map(
                        assignment => (
                            <article
                                key={
                                    assignment.public_id
                                }
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">
                                            {getAssignmentTarget(
                                                assignment
                                            )}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {formatLabel(
                                                assignment.assignment_type
                                            )}
                                        </p>
                                    </div>

                                    <span
                                        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                            assignment.status
                                        )}`}
                                    >
                                        {formatLabel(
                                            assignment.status
                                        ) ||
                                            "Unknown"}
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Assigned At
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                assignment.assigned_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Accepted At
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                assignment.accepted_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Activated At
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                assignment.activated_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Completed At
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                assignment.completed_at
                                            )}
                                        </p>
                                    </div>

                                    {assignment.declined_at && (
                                        <div>
                                            <span className="font-semibold text-slate-500">
                                                Declined At
                                            </span>

                                            <p className="mt-1">
                                                {formatDateTime(
                                                    assignment.declined_at
                                                )}
                                            </p>
                                        </div>
                                    )}

                                    {assignment.revoked_at && (
                                        <div>
                                            <span className="font-semibold text-slate-500">
                                                Revoked At
                                            </span>

                                            <p className="mt-1">
                                                {formatDateTime(
                                                    assignment.revoked_at
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {assignment.assignment_notes && (
                                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Assignment Notes
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                                            {
                                                assignment.assignment_notes
                                            }
                                        </p>
                                    </div>
                                )}

                                {assignment.decline_reason && (
                                    <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                                            Decline Reason
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-rose-800">
                                            {
                                                assignment.decline_reason
                                            }
                                        </p>
                                    </div>
                                )}

                                {assignment.completion_notes && (
                                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                            Completion Notes
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-blue-800">
                                            {
                                                assignment.completion_notes
                                            }
                                        </p>
                                    </div>
                                )}

                                {assignment.revocation_reason && (
                                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                            Revocation Reason
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-amber-900">
                                            {
                                                assignment.revocation_reason
                                            }
                                        </p>
                                    </div>
                                )}
                            </article>
                        )
                    )}
            </div>
        </section>
    );
}

export default MaintenanceAssignmentHistoryPanel;
