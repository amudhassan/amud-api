import {
    Building2,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail
} from "lucide-react";

import {
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import apiClient from "../../api/apiClient";
import {
    useAuth
} from "../../contexts/AuthContext";

function LoginPage() {
    const navigate = useNavigate();
    const {
    saveAuthSession
} = useAuth();

    const rememberedEmail =
        localStorage.getItem("remembered_email") || "";

    const [
        showPassword,
        setShowPassword
    ] = useState(false);

    const [
        email,
        setEmail
    ] = useState(rememberedEmail);

    const [
        password,
        setPassword
    ] = useState("");

    const [
        rememberMe,
        setRememberMe
    ] = useState(Boolean(rememberedEmail));

    const [
        isSubmitting,
        setIsSubmitting
    ] = useState(false);

    const [
        errorMessage,
        setErrorMessage
    ] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrorMessage("");
        setIsSubmitting(true);

        try {
            const response = await apiClient.post(
                "/auth/login",
                {
                    email: email.trim(),
                    password
                }
            );

            const {
                accessToken,
                refreshToken,
                user: authenticatedUser
            } = response.data;

            if (
                !accessToken ||
                !refreshToken ||
                !authenticatedUser
            ) {
                throw new Error(
                    "Login response did not include a complete authentication session."
                );
            }

            saveAuthSession({
                token: accessToken,
                authenticatedUser
            });

            localStorage.setItem(
                "refresh_token",
                refreshToken
            );

            if (rememberMe) {
                localStorage.setItem(
                    "remembered_email",
                    email.trim()
                );
            } else {
                localStorage.removeItem(
                    "remembered_email"
                );
            }

            navigate(
                "/dashboard",
                {
                    replace: true
                }
            );
        } catch (error) {
            const message =
                error.response?.data?.message ||
                error.message ||
                "Unable to sign in. Please try again.";

            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
                    data-login-hero="real-estate-background"
                    className="min-h-screen bg-slate-100">
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

                        bg-cover bg-center"
                    style={{
                        backgroundImage: [
                            "linear-gradient(90deg, rgba(2, 6, 23, 0.94) 0%, rgba(2, 6, 23, 0.86) 36%, rgba(2, 6, 23, 0.62) 68%, rgba(2, 6, 23, 0.42) 100%)",
                            "url('/images/real-estate-login-background.png')"
                        ].join(", "),
                        backgroundSize: "cover",
                        backgroundPosition: "center right",
                        backgroundRepeat: "no-repeat"
                    }}
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
                            Real Estate Management
                        </p>

                        <h2
                            className="
                                mt-5
                                text-5xl
                                font-bold
                                leading-tight
                            "
                        >
                            Manage your rental operations from one secure platform.
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
                            Properties, tenants, leases,
                            invoices, payments, maintenance
                            and reports in one integrated
                            management system.
                        </p>
                    </div>

                    <p className="text-sm text-slate-500">
                        Secure Property Management Platform
                    </p>
                </div>

                <div
                    data-login-session="real-estate-background"
                    className="flex items-center justify-center px-5 py-12 sm:px-8 relative bg-slate-950 bg-cover bg-center"
                    style={{
                        backgroundImage: [
                            "linear-gradient(135deg, rgba(2, 6, 23, 0.72) 0%, rgba(8, 47, 107, 0.48) 48%, rgba(2, 6, 23, 0.68) 100%)",
                            "url('/images/real-estate-login-background.png')"
                        ].join(", "),
                        backgroundSize: "cover",
                        backgroundPosition: "center right",
                        backgroundRepeat: "no-repeat"
                    }}
                >
                    <div className="w-full max-w-md">
                        <div className="mb-8 rounded-2xl border border-white/20 bg-slate-950/45 p-4 text-white shadow-lg backdrop-blur-md lg:hidden">
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
                                    <h1 className="font-bold text-white">
                                        Rental Manager
                                    </h1>

                                    <p className="text-xs text-slate-200">
                                        Property Management
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div
                            className="rounded-3xl border border-white/70 bg-white/95 p-7 shadow-2xl sm:p-9 shadow-slate-950/25 backdrop-blur-xl"
                        >
                            <div>
                                <h2
                                    className="
                                        text-3xl
                                        font-bold
                                        text-slate-900
                                    "
                                >
                                    Welcome back
                                </h2>

                                <p className="mt-2 text-sm text-slate-500">
                                    Sign in to access your management dashboard.
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

                                <div>
                                    <label
                                        htmlFor="password"
                                        className="
                                            mb-2 block
                                            text-sm
                                            font-semibold
                                            text-slate-700
                                        "
                                    >
                                        Password
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
                                            id="password"
                                            name="password"
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={password}
                                            onChange={(event) => {
                                                setPassword(
                                                    event.target.value
                                                );

                                                if (errorMessage) {
                                                    setErrorMessage("");
                                                }
                                            }}
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
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
                                                setShowPassword(
                                                    (current) =>
                                                        !current
                                                )
                                            }
                                            disabled={isSubmitting}
                                            aria-label={
                                                showPassword
                                                    ? "Hide password"
                                                    : "Show password"
                                            }
                                            className="
                                                absolute
                                                right-3
                                                top-1/2
                                                -translate-y-1/2
                                                rounded-lg
                                                p-1.5
                                                text-slate-400
                                                hover:bg-slate-100
                                                hover:text-slate-700
                                                disabled:cursor-not-allowed
                                                disabled:opacity-60
                                            "
                                        >
                                            {showPassword ? (
                                                <EyeOff size={18} />
                                            ) : (
                                                <Eye size={18} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-sm text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(event) =>
                                                setRememberMe(
                                                    event.target.checked
                                                )
                                            }
                                            disabled={isSubmitting}
                                            className="
                                                h-4 w-4
                                                rounded
                                                border-slate-300
                                                text-blue-600
                                            "
                                        />

                                        Remember me
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                "/forgot-password"
                                            )
                                        }
                                        disabled={isSubmitting}
                                        className="
                                            text-sm
                                            font-semibold
                                            text-blue-600
                                            hover:text-blue-700
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    >
                                        Forgot password?
                                    </button>
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
                                        ? "Signing In..."
                                        : "Sign In"}
                                </button>

                                <div className="flex items-center gap-3">
                                    <div className="h-px flex-1 bg-slate-200" />
                                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                        New here?
                                    </span>
                                    <div className="h-px flex-1 bg-slate-200" />
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            "/register"
                                        )
                                    }
                                    disabled={isSubmitting}
                                    className="
                                        w-full
                                        rounded-xl
                                        border border-slate-200
                                        bg-white
                                        px-5 py-3
                                        text-sm
                                        font-semibold
                                        text-slate-700
                                        shadow-sm
                                        transition
                                        hover:border-blue-200
                                        hover:bg-blue-50
                                        hover:text-blue-700
                                        focus:outline-none
                                        focus:ring-4
                                        focus:ring-blue-100
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                >
                                    Create Account
                                </button>
                            </form>
                        </div>

                        <p
                            className="mt-6 text-center text-xs text-white/85 font-medium drop-shadow"
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

export default LoginPage;