import {
    ArrowLeft,
    CheckCircle2,
    RefreshCw,
    Pencil,
    Shield,
    Trash2,
    UserRound,
    XCircle
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import apiClient from "../../api/apiClient";

import DeleteUserModal from "./components/DeleteUserModal";
import RestoreUserModal from "./components/RestoreUserModal";

import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

const formatDateTime = value => {
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
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
};

const formatRole = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

const getErrorMessage = error => {
    if (error?.response?.status === 403) {
        return "Only an administrator can view this user profile.";
    }

    if (error?.response?.status === 404) {
        return "User not found.";
    }

    return (
        error?.response?.data?.message ||
        error?.message ||
        "Unable to retrieve the user profile."
    );
};

function Badge({
    tone = "neutral",
    children
}) {
    const tones = {
        success:
            "bg-emerald-50 text-emerald-700 ring-emerald-200",
        warning:
            "bg-amber-50 text-amber-700 ring-amber-200",
        danger:
            "bg-rose-50 text-rose-700 ring-rose-200",
        blue:
            "bg-blue-50 text-blue-700 ring-blue-200",
        neutral:
            "bg-slate-100 text-slate-600 ring-slate-200"
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                tones[tone] ||
                tones.neutral
            }`}
        >
            {children}
        </span>
    );
}

function Field({
    label,
    value,
    mono = false
}) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {label}
            </p>

            <p
                className={`mt-1 break-words text-sm text-slate-800 ${
                    mono
                        ? "font-mono"
                        : "font-medium"
                }`}
            >
                {value || "—"}
            </p>
        </div>
    );
}

function UserDetailPage() {
    const navigate = useNavigate();

    const {
        public_id: publicId
    } = useParams();

    const [user, setUser] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [
        deleteDialogOpen,
        setDeleteDialogOpen
    ] = useState(false);

    const [
        restoreDialogOpen,
        setRestoreDialogOpen
    ] = useState(false);


    const loadUser =
        useCallback(
            async () => {
                try {
                    setLoading(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            `/users/${publicId}`
                        );

                    setUser(
                        response?.data?.user ||
                        null
                    );
                } catch (
                    requestError
                ) {
                    setUser(null);

                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [publicId]
        );

    useEffect(() => {
        loadUser();
    }, [loadUser]);


    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
                Loading user profile...
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="space-y-4">
                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={
                        ArrowLeft
                    }
                    onClick={() =>
                        navigate(
                            "/users"
                        )
                    }
                >
                    Back to Users
                </Button>

                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
                >
                    {error ||
                        "User not found."}
                </div>
            </div>
        );
    }

    const deleted =
        Boolean(
            user.deleted_at
        );

    const verified =
        user.is_verified === true;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={
                            ArrowLeft
                        }
                        onClick={() =>
                            navigate(
                                "/users"
                            )
                        }
                    >
                        Back to Users
                    </Button>

                    <div className="mt-5 flex items-start gap-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-slate-200">
                            {user.profile_image_url ? (
                                <img
                                    src={
                                        user.profile_image_url
                                    }
                                    alt={`${user.full_name} profile`}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <UserRound className="h-7 w-7" />
                                </div>
                            )}
                        </div>

                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                                {
                                    user.full_name
                                }
                            </h1>

                            <p className="mt-1 break-all text-sm text-slate-500">
                                {
                                    user.email
                                }
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <Badge
                                    tone={
                                        user.role ===
                                        "admin"
                                            ? "blue"
                                            : "neutral"
                                    }
                                >
                                    <Shield className="h-3.5 w-3.5" />
                                    {formatRole(
                                        user.role
                                    )}
                                </Badge>

                                <Badge
                                    tone={
                                        verified
                                            ? "success"
                                            : "warning"
                                    }
                                >
                                    {verified ? (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                        <XCircle className="h-3.5 w-3.5" />
                                    )}

                                    {verified
                                        ? "Verified"
                                        : "Unverified"}
                                </Badge>

                                <Badge
                                    tone={
                                        deleted
                                            ? "danger"
                                            : "success"
                                    }
                                >
                                    {deleted
                                        ? "Deleted"
                                        : "Active"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <ActionGroup>
                    {deleted && (
                        <button
                            type="button"
                            onClick={() =>
                                setRestoreDialogOpen(
                                    true
                                )
                            }
                            className="
                                inline-flex min-h-10
                                items-center justify-center
                                gap-2 rounded-xl
                                border border-emerald-200
                                bg-white
                                px-3.5 py-2
                                text-sm font-semibold
                                text-emerald-600
                                transition
                                hover:bg-emerald-50
                                hover:text-emerald-700
                                focus:outline-none
                                focus:ring-4
                                focus:ring-emerald-100
                            "
                        >
                            <RotateCcw className="h-4 w-4" />
                            Restore User
                        </button>
                    )}

                    {!deleted && (
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={Pencil}
                            onClick={() =>
                                navigate(
                                    `/users/${user.public_id}/edit`
                                )
                            }
                        >
                            Edit User
                        </Button>
                    )}

                    {!deleted && (
                        <button
                            type="button"
                            onClick={() =>
                                setDeleteDialogOpen(
                                    true
                                )
                            }
                            className="
                                inline-flex min-h-10
                                items-center justify-center
                                gap-2 rounded-xl
                                border border-rose-200
                                bg-white
                                px-3.5 py-2
                                text-sm font-semibold
                                text-rose-600
                                transition
                                hover:bg-rose-50
                                hover:text-rose-700
                                focus:outline-none
                                focus:ring-4
                                focus:ring-rose-100
                            "
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete User
                        </button>
                    )}

                    <IconButton
                        label="Refresh user profile"
                        icon={
                            RefreshCw
                        }
                        onClick={
                            loadUser
                        }
                    />
                </ActionGroup>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="font-semibold text-slate-950">
                            Account Information
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Core identity and lifecycle information for this login account.
                        </p>
                    </div>

                    <div className="grid gap-6 p-5 sm:grid-cols-2">
                        <Field
                            label="Full Name"
                            value={
                                user.full_name
                            }
                        />

                        <Field
                            label="Email Address"
                            value={
                                user.email
                            }
                        />

                        <Field
                            label="Role"
                            value={formatRole(
                                user.role
                            )}
                        />

                        <Field
                            label="Verification"
                            value={
                                verified
                                    ? "Verified"
                                    : "Unverified"
                            }
                        />

                        <Field
                            label="Registered"
                            value={formatDateTime(
                                user.created_at
                            )}
                        />

                        <Field
                            label="Last Updated"
                            value={formatDateTime(
                                user.updated_at
                            )}
                        />

                        <Field
                            label="Deleted At"
                            value={formatDateTime(
                                user.deleted_at
                            )}
                        />

                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-semibold text-slate-950">
                        Account State
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                        Current lifecycle and eligibility summary for this account.
                    </p>

                    <div className="mt-5 space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Status
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-800">
                                {deleted
                                    ? "Soft Deleted"
                                    : "Active"}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Email Verification
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-800">
                                {verified
                                    ? "Verified"
                                    : "Pending verification"}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Relationship Eligibility
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                {deleted
                                    ? "This account cannot be selected for new owner or tenant relationships while deleted."
                                    : verified
                                      ? "This account is eligible to be selected in relationship user selectors."
                                      : "Verify the email address before using this account in new relationships."}
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <DeleteUserModal
                user={
                    deleteDialogOpen
                        ? user
                        : null
                }
                onClose={() =>
                    setDeleteDialogOpen(
                        false
                    )
                }
                onDeleted={async () => {
                    setDeleteDialogOpen(
                        false
                    );

                    navigate(
                        "/users",
                        {
                            replace:
                                true
                        }
                    );
                }}
            />

            <RestoreUserModal
                user={
                    restoreDialogOpen
                        ? user
                        : null
                }
                onClose={() =>
                    setRestoreDialogOpen(
                        false
                    )
                }
                onRestored={async () => {
                    setRestoreDialogOpen(
                        false
                    );

                    await loadUser();
                }}
            />
        </div>
    );
}

export default UserDetailPage;
