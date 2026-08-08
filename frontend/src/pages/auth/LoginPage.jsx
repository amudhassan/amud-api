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
    className="
        text-sm
        font-semibold
        text-blue-600
        hover:text-blue-700
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

export default LoginPage;