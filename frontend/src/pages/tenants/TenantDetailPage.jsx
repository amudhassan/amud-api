import {
    ArrowLeft,
    Building2,
    CalendarDays,
    CircleUserRound,
    Ban,
    Link2Off,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Power,
    RefreshCw,
    ShieldCheck,
    ShieldOff,
    Trash2
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useState
} from "react";
import {
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import apiClient from "../../api/apiClient";
import EditTenantModal from "./EditTenantModal";
import EndTenantRelationshipModal from "./EndTenantRelationshipModal";
import DeleteTenantModal from "./DeleteTenantModal";
import ActivateTenantModal from "./ActivateTenantModal";
import BlockTenantModal from "./BlockTenantModal";
import UnblockTenantModal from "./UnblockTenantModal";
import {
    ActionGroup,
    IconButton
} from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to retrieve tenant details.";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
};

const statusClassName = status => {
    const styles = {
        prospective:
            "bg-amber-50 text-amber-700 ring-amber-200",
        active:
            "bg-emerald-50 text-emerald-700 ring-emerald-200",
        inactive:
            "bg-slate-100 text-slate-700 ring-slate-200",
        blocked:
            "bg-rose-50 text-rose-700 ring-rose-200"
    };

    return (
        styles[status] ||
        "bg-slate-100 text-slate-700 ring-slate-200"
    );
};

function InfoItem({
    label,
    value,
    icon: Icon
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
                {Icon && (
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                )}

                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {label}
                    </p>
                    <p className="mt-1 break-words text-sm font-medium text-slate-800">
                        {value || "—"}
                    </p>
                </div>
            </div>
        </div>
    );
}

function TenantDetailPage() {
    const navigate = useNavigate();
    const { tenant_public_id } = useParams();
    const [searchParams] = useSearchParams();

    const ownerPublicId =
        searchParams.get("owner_public_id") || "";

    const [data, setData] =
        useState(null);
    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");
    const [success, setSuccess] =
        useState("");
    const [editOpen, setEditOpen] =
        useState(false);
    const [endRelationshipOpen, setEndRelationshipOpen] =
        useState(false);
    const [deleteOpen, setDeleteOpen] =
        useState(false);
    const [activateOpen, setActivateOpen] =
        useState(false);
    const [blockOpen, setBlockOpen] =
        useState(false);
    const [unblockOpen, setUnblockOpen] =
        useState(false);
    const [endedRelationship, setEndedRelationship] =
        useState(null);

    const loadTenant =
        useCallback(
            async () => {
                if (!ownerPublicId) {
                    setData(null);
                    setError(
                        "Owner context is required to view this tenant."
                    );
                    setLoading(false);
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            `/tenants/${tenant_public_id}`,
                            {
                                params: {
                                    owner_public_id:
                                        ownerPublicId
                                }
                            }
                        );

                    setData(
                        response?.data?.data ||
                            null
                    );
                    setEndedRelationship(null);
                } catch (requestError) {
                    setData(null);
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [ownerPublicId, tenant_public_id]
        );

    useEffect(() => {
        loadTenant();
    }, [loadTenant]);

    const tenant = data?.tenant;
    const owner = data?.owner;
    const relationship =
        endedRelationship ||
        tenant?.owner_relationship || {};
    const createdBy =
        tenant?.created_by || {};

    const goBack = () =>
        navigate("/tenants");

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading tenant details...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                        Tenant Details
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Review the tenant profile and its current owner relationship.
                    </p>
                </div>

                <ActionGroup>
                    <IconButton
                        label="Back to tenants"
                        icon={ArrowLeft}
                        onClick={goBack}
                    />

                    <IconButton
                        label="Refresh tenant details"
                        icon={RefreshCw}
                        onClick={loadTenant}
                        loading={loading}
                        disabled={
                            !ownerPublicId ||
                            Boolean(endedRelationship)
                        }
                    />

                    <IconButton
                        label="Edit tenant"
                        icon={Pencil}
                        onClick={() => {
                            setSuccess("");
                            setEditOpen(true);
                        }}
                        disabled={
                            !tenant ||
                            !ownerPublicId ||
                            Boolean(endedRelationship)
                        }
                    />

                    <IconButton
                        label="Activate tenant"
                        icon={Power}
                        onClick={() => {
                            setSuccess("");
                            setActivateOpen(true);
                        }}
                        disabled={
                            !tenant ||
                            !ownerPublicId ||
                            Boolean(endedRelationship) ||
                            !["prospective", "inactive"].includes(
                                tenant.status
                            ) ||
                            relationship.relationship_status !==
                                "active"
                        }
                    />

                    <IconButton
                        label="Block tenant"
                        icon={Ban}
                        variant="danger"
                        onClick={() => {
                            setSuccess("");
                            setBlockOpen(true);
                        }}
                        disabled={
                            !tenant ||
                            !ownerPublicId ||
                            Boolean(endedRelationship) ||
                            tenant.status !== "active" ||
                            relationship.relationship_status !==
                                "active"
                        }
                    />

                    <IconButton
                        label="Unblock tenant"
                        icon={ShieldOff}
                        variant="success"
                        onClick={() => {
                            setSuccess("");
                            setUnblockOpen(true);
                        }}
                        disabled={
                            !tenant ||
                            !ownerPublicId ||
                            Boolean(endedRelationship) ||
                            tenant.status !== "blocked" ||
                            relationship.relationship_status !==
                                "active"
                        }
                    />

                    <IconButton
                        label="End owner-tenant relationship"
                        icon={Link2Off}
                        variant="danger"
                        onClick={() => {
                            setSuccess("");
                            setEndRelationshipOpen(true);
                        }}
                        disabled={
                            !tenant ||
                            !ownerPublicId ||
                            Boolean(endedRelationship) ||
                            !["active", "blocked"].includes(
                                relationship.relationship_status
                            )
                        }
                    />

                    <IconButton
                        label="Delete tenant profile"
                        icon={Trash2}
                        variant="danger"
                        onClick={() => {
                            setSuccess("");
                            setDeleteOpen(true);
                        }}
                        disabled={
                            !tenant ||
                            !ownerPublicId ||
                            !endedRelationship
                        }
                    />
                </ActionGroup>
            </div>

            {success && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {success}
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                    {error}
                </div>
            )}

            {!error && tenant && (
                <>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                    <CircleUserRound className="h-7 w-7" />
                                </div>

                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-xl font-bold text-slate-950">
                                            {tenant.display_name}
                                        </h2>

                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(tenant.status)}`}
                                        >
                                            {formatLabel(tenant.status)}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-sm text-slate-500">
                                        {formatLabel(tenant.tenant_type)} · {tenant.public_id}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Owner Context
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-800">
                                    {owner?.display_name || "—"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-950">
                                Profile Information
                            </h3>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <InfoItem
                                    label="Tenant Type"
                                    value={formatLabel(tenant.tenant_type)}
                                    icon={CircleUserRound}
                                />
                                <InfoItem
                                    label="Status"
                                    value={formatLabel(tenant.status)}
                                    icon={ShieldCheck}
                                />
                                <InfoItem
                                    label="National ID"
                                    value={tenant.national_id}
                                />
                                <InfoItem
                                    label="Passport Number"
                                    value={tenant.passport_number}
                                />
                                <InfoItem
                                    label="Registration Number"
                                    value={tenant.registration_number}
                                />
                                <InfoItem
                                    label="Tax Identification Number"
                                    value={tenant.tax_identification_number}
                                />
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-950">
                                Contact & Location
                            </h3>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <InfoItem
                                    label="Email"
                                    value={tenant.email}
                                    icon={Mail}
                                />
                                <InfoItem
                                    label="Phone"
                                    value={tenant.phone_number}
                                    icon={Phone}
                                />
                                <InfoItem
                                    label="Alternative Phone"
                                    value={tenant.alternative_phone}
                                    icon={Phone}
                                />
                                <InfoItem
                                    label="Country"
                                    value={tenant.country}
                                    icon={MapPin}
                                />
                                <InfoItem
                                    label="City"
                                    value={tenant.city}
                                    icon={MapPin}
                                />
                                <InfoItem
                                    label="Region"
                                    value={tenant.region}
                                    icon={MapPin}
                                />
                                <div className="sm:col-span-2">
                                    <InfoItem
                                        label="Address"
                                        value={tenant.address}
                                        icon={MapPin}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-950">
                                    Owner Relationship
                                </h3>
                                <p className="text-sm text-slate-500">
                                    Current relationship between this tenant and the selected owner.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <InfoItem
                                label="Relationship Status"
                                value={formatLabel(relationship.relationship_status)}
                                icon={ShieldCheck}
                            />
                            <InfoItem
                                label="Primary Relationship"
                                value={relationship.is_primary_owner_relationship ? "Yes" : "No"}
                            />
                            <InfoItem
                                label="Relationship Created"
                                value={formatDateTime(relationship.created_at)}
                                icon={CalendarDays}
                            />
                            <InfoItem
                                label="Relationship Updated"
                                value={formatDateTime(relationship.updated_at)}
                                icon={CalendarDays}
                            />
                        </div>

                        {relationship.notes && (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Relationship Notes
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                    {relationship.notes}
                                </p>
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-950">
                            Audit Information
                        </h3>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <InfoItem
                                label="Created By"
                                value={createdBy.full_name || createdBy.email}
                            />
                            <InfoItem
                                label="Creator Email"
                                value={createdBy.email}
                                icon={Mail}
                            />
                            <InfoItem
                                label="Created At"
                                value={formatDateTime(tenant.created_at)}
                                icon={CalendarDays}
                            />
                            <InfoItem
                                label="Updated At"
                                value={formatDateTime(tenant.updated_at)}
                                icon={CalendarDays}
                            />
                        </div>
                    </section>
                </>
            )}

            <ActivateTenantModal
                open={activateOpen}
                tenant={tenant}
                owner={owner}
                relationship={relationship}
                ownerPublicId={ownerPublicId}
                onClose={() =>
                    setActivateOpen(false)
                }
                onActivated={async activatedTenant => {
                    setActivateOpen(false);
                    setSuccess(
                        `${activatedTenant?.display_name || tenant?.display_name || "Tenant"} activated successfully.`
                    );
                    await loadTenant();
                }}
            />

            <BlockTenantModal
                open={blockOpen}
                tenant={tenant}
                owner={owner}
                relationship={relationship}
                ownerPublicId={ownerPublicId}
                onClose={() =>
                    setBlockOpen(false)
                }
                onBlocked={async blockedTenant => {
                    setBlockOpen(false);
                    setSuccess(
                        `${blockedTenant?.display_name || tenant?.display_name || "Tenant"} blocked successfully.`
                    );
                    await loadTenant();
                }}
            />

            <UnblockTenantModal
                open={unblockOpen}
                tenant={tenant}
                owner={owner}
                relationship={relationship}
                ownerPublicId={ownerPublicId}
                onClose={() =>
                    setUnblockOpen(false)
                }
                onUnblocked={async unblockedTenant => {
                    setUnblockOpen(false);
                    setSuccess(
                        `${unblockedTenant?.display_name || tenant?.display_name || "Tenant"} unblocked successfully.`
                    );
                    await loadTenant();
                }}
            />

            <EndTenantRelationshipModal
                open={endRelationshipOpen}
                tenant={tenant}
                owner={owner}
                relationship={relationship}
                ownerPublicId={ownerPublicId}
                onClose={() =>
                    setEndRelationshipOpen(false)
                }
                onEnded={result => {
                    setEndRelationshipOpen(false);
                    setEndedRelationship(
                        result?.owner_relationship || {
                            ...relationship,
                            relationship_status: "ended",
                            is_primary_owner_relationship: false,
                            ended_at: new Date().toISOString()
                        }
                    );
                    setSuccess(
                        "Owner-tenant relationship ended successfully. You can now delete the tenant profile if no other deletion rule blocks it."
                    );
                }}
            />

            <DeleteTenantModal
                open={deleteOpen}
                tenant={tenant}
                owner={owner}
                ownerPublicId={ownerPublicId}
                onClose={() =>
                    setDeleteOpen(false)
                }
                onDeleted={() =>
                    navigate("/tenants")
                }
            />

            <EditTenantModal
                open={editOpen}
                tenant={tenant}
                ownerPublicId={ownerPublicId}
                onClose={() =>
                    setEditOpen(false)
                }
                onUpdated={async updatedTenant => {
                    setEditOpen(false);
                    setSuccess(
                        `${updatedTenant?.display_name || tenant?.display_name || "Tenant"} updated successfully.`
                    );
                    await loadTenant();
                }}
            />
        </div>
    );
}

export default TenantDetailPage;
