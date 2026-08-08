import {
    ArrowLeft,
    Building2,
    Eye,
    EyeOff,
    LockKeyhole
} from "lucide-react";

import {
    useState
} from "react";

import {
    useNavigate,
    useSearchParams
} from "react-router-dom";

import apiClient from "../../api/apiClient";

function ResetPasswordPage() {
    const navigate = useNavigate();

    const [
        searchParams
    ] = useSearchParams();

    const resetToken =
        searchParams.get("token") || "";

    const [
        newPassword,
        setNewPassword
    ] = useState("");

    const [
        confirmPassword,
        setConfirmPassword
    ] = useState("");

    const [
        showNewPassword,
        setShowNewPassword
    ] = useState(false);

    const [
        showConfirmPassword,
        setShowConfirmPassword
    ] = useState(false);

    const [
        isSubmitting,
        setIsSubmitting
    ] = useState(false);

    const [
        errorMessage,
        setErrorMessage
    ] = useState("");

    const [
        successMessage,
        setSuccessMessage
    ] = useState("");

    const handleBackToLogin = () => {
        navigate(
            "/login",
            {
                replace: true
            }
        );
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrorMessage("");
        setSuccessMessage("");

        if (!resetToken) {
            setErrorMessage(
                "The password reset link is invalid or incomplete."
            );
            return;
        }

        if (!newPassword) {
            setErrorMessage(
                "New password is required."
            );
            return;
        }

        if (
            newPassword !==
            confirmPassword
        ) {
            setErrorMessage(
                "Passwords do not match."
            );
            return;
        }

        setIsSubmitting(true);

        try {
            const response =
                await apiClient.post(
                    "/auth/reset-password",
                    {
                        resetToken,
                        newPassword
                    }
                );

            setSuccessMessage(
                response.data?.message ||
                    "Password reset successfully"
            );

            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            const message =
                error.response?.data?.message ||
                error.message ||
                "Unable to reset your password. Please try again.";

            setErrorMessage(
                message
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="grid min-h-screen lg:grid-cols-2">
                <div
                    className="
                        hidden
                        bg-slate-950
                        px-12 py-16
                        text-white
                        lg:flex
                        lg:flex-col
                        lg:justify-between
                    "
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="
                                flex h-12 w-12
                                items-center justify-center
                                rounded-2xl
                                bg-blue-600
                            "
                        >
                            <Building2 size={25} />
                        </div>

                        <div>
                            <h1 className="text-xl font-bold">
                                Rental Manager
                            </h1>

                            <p className="text-sm text-slate-400">
                                Property Management System
                            </p>
                        </div>
                    </div>

                    <div className="max-w-xl">
                        <p
                            className="
                                text-sm font-semibold
                                uppercase
                                tracking-[0.25em]
                                text-blue-400
                            "
                        >
                            Secure Recovery
                        </p>

                        <h2
                            className="
                                mt-5
                                text-5xl
                                font-bold
                                leading-tight
                            "
                        >
                            Create a new password and restore access securely.
                        </h2>

                        <p
                            className="
                                mt-6
                                max-w-lg
                                text-lg
                                leading-8
                                text-slate-400
                            "
                        >
                            Use the secure recovery link sent
                            to your email to choose a new
                            password for your account.
                        </p>
                    </div>

                    <p className="text-sm text-slate-500">
                        Secure Property Management Platform
                    </p>
                </div>

                <div
                    className="
                        flex items-center
                        justify-center
                        px-5 py-12
                        sm:px-8
                    "
                >
                    <div className="w-full max-w-md">
                        <div className="mb-8 lg:hidden">
                            <div className="flex items-center gap-3">
                                <div
                                    className="
                                        flex h-11 w-11
                                        items-center justify-center
                                        rounded-xl
                                        bg-blue-600
                                        text-white
                                    "
                                >
                                    <Building2 size={23} />
                                </div>

                                <div>
                                    <h1 className="font-bold text-slate-900">
                                        Rental Manager
                                    </h1>

                                    <p className="text-xs text-slate-500">
                                        Property Management
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div
                            className="
                                rounded-3xl
                                border border-slate-200
                                bg-white
                                p-7
                                shadow-sm
                                sm:p-9
                            "
                        >
                            <button
                                type="button"
                                onClick={handleBackToLogin}
                                className="
                                    mb-7
                                    flex items-center gap-2
                                    text-sm
                                    font-semibold
                                    text-slate-500
                                    transition
                                    hover:text-blue-600
                                "
                            >
                                <ArrowLeft size={17} />
                                Back to sign in
                            </button>

                            <div>
                                <h2
                                    className="
                                        text-3xl
                                        font-bold
                                        text-slate-900
                                    "
                                >
                                    Reset password
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Enter and confirm the new password
                                    you want to use for your account.
                                </p>
                            </div>

                            <form
                                onSubmit={handleSubmit}
                                className="mt-8 space-y-5"
                            >
                                {!resetToken && (
                                    <div
                                        role="alert"
                                        aria-live="polite"
                                        className="
                                            rounded-xl
                                            border border-amber-200
                                            bg-amber-50
                                            px-4 py-3
                                            text-sm
                                            leading-6
                                            text-amber-700
                                        "
                                    >
                                        This reset link does not contain
                                        a valid reset token. Please request
                                        a new password reset link.
                                    </div>
                                )}

                                {errorMessage && (
                                    <div
                                        role="alert"
                                        aria-live="polite"
                                        className="
                                            rounded-xl
                                            border border-red-200
                                            bg-red-50
                                            px-4 py-3
                                            text-sm
                                            leading-6
                                            text-red-700
                                        "
                                    >
                                        {errorMessage}
                                    </div>
                                )}

                                {successMessage && (
                                    <div
                                        role="status"
                                        aria-live="polite"
                                        className="
                                            rounded-xl
                                            border border-emerald-200
                                            bg-emerald-50
                                            px-4 py-3
                                            text-sm
                                            leading-6
                                            text-emerald-700
                                        "
                                    >
                                        {successMessage}
                                    </div>
                                )}

                                <div>
                                    <label
                                        htmlFor="newPassword"
                                        className="
                                            mb-2 block
                                            text-sm
                                            font-semibold
                                            text-slate-700
                                        "
                                    >
                                        New password
                                    </label>

                                    <div className="relative">
                                        <LockKeyhole
                                            size={18}
                                            className="
                                                absolute
                                                left-3.5
                                                top-1/2
                                                -translate-y-1/2
                                                text-slate-400
                                            "
                                        />

                                        <input
                                            id="newPassword"
                                            name="newPassword"
                                            type={
                                                showNewPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={newPassword}
                                            onChange={(event) => {
                                                setNewPassword(
                                                    event.target.value
                                                );

                                                if (errorMessage) {
                                                    setErrorMessage("");
                                                }

                                                if (successMessage) {
                                                    setSuccessMessage("");
                                                }
                                            }}
                                            autoComplete="new-password"
                                            placeholder="Enter new password"
                                            required
                                            disabled={
                                                isSubmitting ||
                                                !resetToken
                                            }
                                            className="
                                                w-full
                                                rounded-xl
                                                border
                                                border-slate-200
                                                bg-slate-50
                                                py-3
                                                pl-11
                                                pr-12
                                                text-sm
                                                text-slate-800
                                                outline-none
                                                transition
                                                placeholder:text-slate-400
                                                focus:border-blue-500
                                                focus:bg-white
                                                focus:ring-4
                                                focus:ring-blue-100
                                                disabled:cursor-not-allowed
                                                disabled:opacity-60
                                            "
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowNewPassword(
                                                    (current) =>
                                                        !current
                                                )
                                            }
                                            disabled={
                                                isSubmitting ||
                                                !resetToken
                                            }
                                            aria-label={
                                                showNewPassword
                                                    ? "Hide new password"
                                                    : "Show new password"
                                            }
                                            className="
                                                absolute
                                                right-3
                                                top-1/2
                                                -translate-y-1/2
                                                rounded-lg
                                                p-1.5
                                                text-slate-400
                                                transition
                                                hover:bg-slate-100
                                                hover:text-slate-700
                                                disabled:cursor-not-allowed
                                                disabled:opacity-60
                                            "
                                        >
                                            {showNewPassword ? (
                                                <EyeOff size={18} />
                                            ) : (
                                                <Eye size={18} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="confirmPassword"
                                        className="
                                            mb-2 block
                                            text-sm
                                            font-semibold
                                            text-slate-700
                                        "
                                    >
                                        Confirm new password
                                    </label>

                                    <div className="relative">
                                        <LockKeyhole
                                            size={18}
                                            className="
                                                absolute
                                                left-3.5
                                                top-1/2
                                                -translate-y-1/2
                                                text-slate-400
                                            "
                                        />

                                        <input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type={
                                                showConfirmPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={confirmPassword}
                                            onChange={(event) => {
                                                setConfirmPassword(
                                                    event.target.value
                                                );

                                                if (errorMessage) {
                                                    setErrorMessage("");
                                                }

                                                if (successMessage) {
                                                    setSuccessMessage("");
                                                }
                                            }}
                                            autoComplete="new-password"
                                            placeholder="Confirm new password"
                                            required
                                            disabled={
                                                isSubmitting ||
                                                !resetToken
                                            }
                                            className="
                                                w-full
                                                rounded-xl
                                                border
                                                border-slate-200
                                                bg-slate-50
                                                py-3
                                                pl-11
                                                pr-12
                                                text-sm
                                                text-slate-800
                                                outline-none
                                                transition
                                                placeholder:text-slate-400
                                                focus:border-blue-500
                                                focus:bg-white
                                                focus:ring-4
                                                focus:ring-blue-100
                                                disabled:cursor-not-allowed
                                                disabled:opacity-60
                                            "
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowConfirmPassword(
                                                    (current) =>
                                                        !current
                                                )
                                            }
                                            disabled={
                                                isSubmitting ||
                                                !resetToken
                                            }
                                            aria-label={
                                                showConfirmPassword
                                                    ? "Hide confirmation password"
                                                    : "Show confirmation password"
                                            }
                                            className="
                                                absolute
                                                right-3
                                                top-1/2
                                                -translate-y-1/2
                                                rounded-lg
                                                p-1.5
                                                text-slate-400
                                                transition
                                                hover:bg-slate-100
                                                hover:text-slate-700
                                                disabled:cursor-not-allowed
                                                disabled:opacity-60
                                            "
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff size={18} />
                                            ) : (
                                                <Eye size={18} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={
                                        isSubmitting ||
                                        !resetToken
                                    }
                                    className="
                                        w-full
                                        rounded-xl
                                        bg-blue-600
                                        px-5 py-3
                                        text-sm
                                        font-semibold
                                        text-white
                                        shadow-sm
                                        transition
                                        hover:bg-blue-700
                                        focus:outline-none
                                        focus:ring-4
                                        focus:ring-blue-200
                                        disabled:cursor-not-allowed
                                        disabled:bg-blue-400
                                    "
                                >
                                    {isSubmitting
                                        ? "Resetting..."
                                        : "Reset Password"}
                                </button>

                                {successMessage && (
                                    <button
                                        type="button"
                                        onClick={handleBackToLogin}
                                        className="
                                            w-full
                                            rounded-xl
                                            border border-slate-200
                                            bg-white
                                            px-5 py-3
                                            text-sm
                                            font-semibold
                                            text-slate-700
                                            transition
                                            hover:bg-slate-50
                                        "
                                    >
                                        Continue to Sign In
                                    </button>
                                )}
                            </form>
                        </div>

                        <p
                            className="
                                mt-6
                                text-center
                                text-xs
                                text-slate-400
                            "
                        >
                            Protected access to the Real Estate
                            Management System
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ResetPasswordPage;