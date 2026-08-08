import {
    ArrowLeft,
    Building2,
    Mail
} from "lucide-react";

import {
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import apiClient from "../../api/apiClient";

function ForgotPasswordPage() {
    const navigate = useNavigate();

    const [
        email,
        setEmail
    ] = useState("");

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

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrorMessage("");
        setSuccessMessage("");
        setIsSubmitting(true);

        try {
            const response =
                await apiClient.post(
                    "/auth/forgot-password",
                    {
                        email:
                            email.trim()
                    }
                );

            setSuccessMessage(
                response.data?.message ||
                    "If an account with that email exists, a password reset link has been sent."
            );
        } catch (error) {
            const message =
                error.response?.data?.message ||
                error.message ||
                "Unable to process the password reset request. Please try again.";

            setErrorMessage(
                message
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackToLogin = () => {
        navigate(
            "/login",
            {
                replace: true
            }
        );
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
                            Account Recovery
                        </p>

                        <h2
                            className="
                                mt-5
                                text-5xl
                                font-bold
                                leading-tight
                            "
                        >
                            Recover access to your management account securely.
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
                            Enter your registered email address
                            and we will send password recovery
                            instructions if an account exists.
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
                                    Forgot password?
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Enter your email address and
                                    we will send you instructions
                                    to reset your password.
                                </p>
                            </div>

                            <form
                                onSubmit={handleSubmit}
                                className="mt-8 space-y-5"
                            >
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
                                        htmlFor="email"
                                        className="
                                            mb-2 block
                                            text-sm
                                            font-semibold
                                            text-slate-700
                                        "
                                    >
                                        Email address
                                    </label>

                                    <div className="relative">
                                        <Mail
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
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={email}
                                            onChange={(event) => {
                                                setEmail(
                                                    event.target.value
                                                );

                                                if (errorMessage) {
                                                    setErrorMessage("");
                                                }

                                                if (successMessage) {
                                                    setSuccessMessage("");
                                                }
                                            }}
                                            autoComplete="email"
                                            placeholder="name@example.com"
                                            required
                                            disabled={isSubmitting}
                                            className="
                                                w-full
                                                rounded-xl
                                                border
                                                border-slate-200
                                                bg-slate-50
                                                py-3
                                                pl-11
                                                pr-4
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
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
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
                                        ? "Sending..."
                                        : "Send Reset Link"}
                                </button>
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

export default ForgotPasswordPage;