import {
    ArrowLeft,
    CheckCircle2,
    Save,
    UserRoundCog
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import apiClient from "../../api/apiClient";

import {
    ActionGroup,
    Button
} from "../../components/ui/Button";

const getErrorMessage = error => {
    if (error?.response?.status === 403) {
        return "Only an administrator can edit system users.";
    }

    if (error?.response?.status === 404) {
        return "Active user not found.";
    }

    if (error?.response?.status === 409) {
        return (
            error.response?.data?.message ||
            "That email address is already in use."
        );
    }

    return (
        error?.response?.data?.message ||
        error?.message ||
        "Unable to update the user."
    );
};

const validEmail = value =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value
    );

function EditUserPage() {
    const navigate = useNavigate();

    const {
        public_id: publicId
    } = useParams();

    const [user, setUser] =
        useState(null);

    const [
        fullName,
        setFullName
    ] = useState("");

    const [email, setEmail] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [error, setError] =
        useState("");

    const [
        success,
        setSuccess
    ] = useState("");

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

                    const loadedUser =
                        response?.data?.user ||
                        null;

                    setUser(
                        loadedUser
                    );

                    setFullName(
                        loadedUser
                            ?.full_name ||
                        ""
                    );

                    setEmail(
                        loadedUser
                            ?.email ||
                        ""
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

    const validationError =
        useMemo(() => {
            const name =
                fullName.trim();

            const normalizedEmail =
                email
                    .trim()
                    .toLowerCase();

            if (
                name.length < 2 ||
                name.length > 150
            ) {
                return "Full name must contain between 2 and 150 characters.";
            }

            if (
                normalizedEmail.length >
                    255 ||
                !validEmail(
                    normalizedEmail
                )
            ) {
                return "Enter a valid email address.";
            }

            return "";
        }, [
            fullName,
            email
        ]);

    const hasChanges =
        useMemo(() => {
            if (!user) {
                return false;
            }

            return (
                fullName.trim() !==
                    String(
                        user.full_name ||
                            ""
                    ).trim() ||
                email
                    .trim()
                    .toLowerCase() !==
                    String(
                        user.email ||
                            ""
                    )
                        .trim()
                        .toLowerCase()
            );
        }, [
            user,
            fullName,
            email
        ]);

    const submit = async event => {
        event.preventDefault();

        if (
            validationError ||
            !hasChanges ||
            submitting ||
            user?.deleted_at
        ) {
            return;
        }

        try {
            setSubmitting(true);
            setError("");
            setSuccess("");

            await apiClient.put(
                `/users/${publicId}`,
                {
                    full_name:
                        fullName.trim(),
                    email:
                        email
                            .trim()
                            .toLowerCase()
                }
            );

            setSuccess(
                "User updated successfully."
            );

            window.setTimeout(
                () => {
                    navigate(
                        `/users/${publicId}`
                    );
                },
                600
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

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
                Loading user...
            </div>
        );
    }

    if (error && !user) {
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
                    {error}
                </div>
            </div>
        );
    }

    const deleted =
        Boolean(
            user?.deleted_at
        );

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={
                        ArrowLeft
                    }
                    onClick={() =>
                        navigate(
                            `/users/${publicId}`
                        )
                    }
                >
                    Back to Profile
                </Button>

                <div className="mt-5 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <UserRoundCog className="h-6 w-6" />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                            Edit User
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Update the account holder's name and email address.
                        </p>
                    </div>
                </div>
            </div>

            {deleted && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                    This account is soft-deleted. Restore it before editing account details.
                </div>
            )}

            {error && user && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
                >
                    {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                </div>
            )}

            <form
                onSubmit={submit}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
                <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="font-semibold text-slate-950">
                        Account Details
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                        The account role and verification state are not changed by this form.
                    </p>
                </div>

                <div className="space-y-5 p-5">
                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Full Name
                        </label>

                        <input
                            value={fullName}
                            disabled={
                                deleted ||
                                submitting
                            }
                            onChange={
                                event => {
                                    setFullName(
                                        event
                                            .target
                                            .value
                                    );
                                    setError("");
                                    setSuccess("");
                                }
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Email Address
                        </label>

                        <input
                            type="email"
                            value={email}
                            disabled={
                                deleted ||
                                submitting
                            }
                            onChange={
                                event => {
                                    setEmail(
                                        event
                                            .target
                                            .value
                                    );
                                    setError("");
                                    setSuccess("");
                                }
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Role
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                {user?.role || "—"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Verification
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                {user?.is_verified
                                    ? "Verified"
                                    : "Unverified"}
                            </p>
                        </div>
                    </div>

                    {validationError && (
                        <p className="text-sm text-rose-600">
                            {
                                validationError
                            }
                        </p>
                    )}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <ActionGroup>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                navigate(
                                    `/users/${publicId}`
                                )
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={Save}
                            loading={
                                submitting
                            }
                            disabled={
                                deleted ||
                                Boolean(
                                    validationError
                                ) ||
                                !hasChanges
                            }
                        >
                            Save Changes
                        </Button>
                    </ActionGroup>
                </div>
            </form>
        </div>
    );
}

export default EditUserPage;
