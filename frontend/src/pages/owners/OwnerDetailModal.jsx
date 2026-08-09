import {
    Building2,
    CalendarDays,
    Check,
    Copy,
    FileText,
    Landmark,
    Mail,
    MapPin,
    Phone,
    RefreshCw,
    ShieldCheck,
    UserRound,
    UsersRound,
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

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load owner detail.";

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

function DetailItem({
    icon: Icon,
    label,
    value
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                    <Icon className="h-4 w-4" />
                </div>

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

function PermissionBadge({
    allowed,
    children
}) {
    return (
        <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                allowed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
        >
            <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    allowed
                        ? "bg-emerald-100"
                        : "bg-slate-200"
                }`}
            >
                {allowed ? (
                    <Check className="h-3 w-3" />
                ) : (
                    <X className="h-3 w-3" />
                )}
            </span>

            {children}
        </div>
    );
}

function OwnerDetailModal({
    ownerPublicId,
    onClose
}) {
    const [
        owner,
        setOwner
    ] = useState(null);

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        copied,
        setCopied
    ] = useState(false);

    const loadOwner = useCallback(
        async () => {
            if (!ownerPublicId) {
                return;
            }

            try {
                setLoading(true);
                setError("");

                const response =
                    await apiClient.get(
                        `/owners/${ownerPublicId}`
                    );

                setOwner(
                    response?.data?.data ||
                        null
                );
            } catch (requestError) {
                setOwner(null);
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        [ownerPublicId]
    );

    useEffect(() => {
        if (!ownerPublicId) {
            setOwner(null);
            setError("");
            setCopied(false);
            return;
        }

        loadOwner();
    }, [
        ownerPublicId,
        loadOwner
    ]);

    useEffect(() => {
        if (!ownerPublicId) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        ownerPublicId,
        onClose
    ]);

    const location = useMemo(
        () =>
            [
                owner?.address,
                owner?.city,
                owner?.region,
                owner?.country
            ]
                .filter(Boolean)
                .join(", "),
        [owner]
    );

    const copyPublicId = async () => {
        if (!owner?.public_id) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                owner.public_id
            );

            setCopied(true);

            window.setTimeout(
                () => setCopied(false),
                1500
            );
        } catch {
            setCopied(false);
        }
    };

    if (!ownerPublicId) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={event => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="owner-detail-title"
                className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl"
            >
                <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            {owner?.owner_type ===
                            "individual" ? (
                                <UserRound className="h-5 w-5" />
                            ) : (
                                <Building2 className="h-5 w-5" />
                            )}
                        </div>

                        <div className="min-w-0">
                            <h2
                                id="owner-detail-title"
                                className="truncate text-lg font-bold text-slate-950"
                            >
                                {owner?.display_name ||
                                    "Owner Detail"}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Complete owner identity, activity and access summary.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close owner detail"
                        icon={X}
                        onClick={onClose}
                    />
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                    {error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <span>{error}</span>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={RefreshCw}
                                    onClick={loadOwner}
                                >
                                    Retry
                                </Button>
                            </div>
                        </div>
                    )}

                    {loading && !owner && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                            <p className="mt-3 text-sm text-slate-500">
                                Loading owner detail...
                            </p>
                        </div>
                    )}

                    {owner && (
                        <>
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                                                {formatLabel(
                                                    owner.owner_type
                                                )}
                                            </span>

                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                                                    owner.status
                                                )}`}
                                            >
                                                {formatLabel(
                                                    owner.status
                                                )}
                                            </span>
                                        </div>

                                        <h3 className="mt-3 text-xl font-bold text-slate-950">
                                            {owner.display_name}
                                        </h3>

                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-600">
                                                {owner.public_id}
                                            </code>

                                            <button
                                                type="button"
                                                onClick={copyPublicId}
                                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-600 transition hover:bg-slate-50"
                                            >
                                                {copied ? (
                                                    <Check className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5" />
                                                )}
                                                {copied
                                                    ? "Copied"
                                                    : "Copy ID"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                                            <UsersRound className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Active Users
                                            </p>
                                            <p className="mt-1 text-2xl font-bold text-slate-950">
                                                {Number(
                                                    owner.active_user_count ||
                                                        0
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Active Properties
                                            </p>
                                            <p className="mt-1 text-2xl font-bold text-slate-950">
                                                {Number(
                                                    owner.active_property_count ||
                                                        0
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                                            <Landmark className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Shareholders
                                            </p>
                                            <p className="mt-1 text-2xl font-bold text-slate-950">
                                                {Number(
                                                    owner.active_shareholder_count ||
                                                        0
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div>
                                    <h3 className="text-base font-bold text-slate-950">
                                        Owner Information
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Registration, contact and location details stored by the backend.
                                    </p>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <DetailItem
                                        icon={FileText}
                                        label="Registration Number"
                                        value={
                                            owner.registration_number
                                        }
                                    />

                                    <DetailItem
                                        icon={ShieldCheck}
                                        label="Tax Identification Number"
                                        value={
                                            owner.tax_identification_number
                                        }
                                    />

                                    <DetailItem
                                        icon={Mail}
                                        label="Email"
                                        value={owner.email}
                                    />

                                    <DetailItem
                                        icon={Phone}
                                        label="Phone"
                                        value={
                                            owner.phone_number
                                        }
                                    />

                                    <DetailItem
                                        icon={Phone}
                                        label="Alternative Phone"
                                        value={
                                            owner.alternative_phone
                                        }
                                    />

                                    <DetailItem
                                        icon={MapPin}
                                        label="Location"
                                        value={location}
                                    />
                                </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="text-base font-bold text-slate-950">
                                    Access Context
                                </h3>

                                {owner.relationship_role ? (
                                    <div className="mt-4 space-y-4">
                                        <div className="rounded-2xl bg-slate-50 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Relationship
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                {formatLabel(
                                                    owner.relationship_role
                                                )}
                                                {owner.is_primary
                                                    ? " · Primary representative"
                                                    : " · Linked representative"}
                                            </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <PermissionBadge
                                                allowed={Boolean(
                                                    owner.can_manage_properties
                                                )}
                                            >
                                                Manage Properties
                                            </PermissionBadge>

                                            <PermissionBadge
                                                allowed={Boolean(
                                                    owner.can_manage_finances
                                                )}
                                            >
                                                Manage Finances
                                            </PermissionBadge>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                                            <div>
                                                <p className="text-sm font-semibold text-blue-900">
                                                    Administrator access
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-blue-700">
                                                    No owner-user relationship is required for this view. Backend authorization remains authoritative.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="text-base font-bold text-slate-950">
                                    Record Timeline
                                </h3>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <DetailItem
                                        icon={CalendarDays}
                                        label="Created"
                                        value={formatDateTime(
                                            owner.created_at
                                        )}
                                    />

                                    <DetailItem
                                        icon={CalendarDays}
                                        label="Last Updated"
                                        value={formatDateTime(
                                            owner.updated_at
                                        )}
                                    />
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default OwnerDetailModal;
