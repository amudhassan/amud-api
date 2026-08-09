import {
    Building2,
    CheckCircle2,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    UserRound,
    UserPlus
} from "lucide-react";

import {
    useMemo,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import apiClient from "../../api/apiClient";

const getApiMessage = error => {
    const responseData =
        error?.response?.data;

    if (
        Array.isArray(
            responseData?.errors
        ) &&
        responseData.errors.length > 0
    ) {
        return responseData.errors
            .map(item =>
                item?.msg ||
                item?.message
            )
            .filter(Boolean)
            .join(" ");
    }

    return (
        responseData?.message ||
        error?.message ||
        "Unable to create account. Please try again."
    );
};

function RegisterPage() {
    const navigate = useNavigate();

    const [
        fullName,
        setFullName
    ] = useState("");

    const [
        email,
        setEmail
    ] = useState("");

    const [
        password,
        setPassword
    ] = useState("");

    const [
        confirmPassword,
        setConfirmPassword
    ] = useState("");

    const [
        showPassword,
        setShowPassword
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
        registrationResult,
        setRegistrationResult
    ] = useState(null);

    const [
        resendLoading,
        setResendLoading
    ] = useState(false);

    const [
        resendMessage,
        setResendMessage
    ] = useState("");

    const validationMessage =
        useMemo(() => {
            if (!fullName.trim()) {
                return "Full name is required.";
            }

            if (!email.trim()) {
                return "Email address is required.";
            }

            if (!password) {
                return "Password is required.";
            }

            if (
                password !==
                confirmPassword
            ) {
                return "Passwords do not match.";
            }

            return "";
        }, [
            fullName,
            email,
            password,
            confirmPassword
        ]);

    const handleSubmit = async event => {
        event.preventDefault();

        if (validationMessage) {
            setErrorMessage(
                validationMessage
            );
            return;
        }

        setErrorMessage("");
        setResendMessage("");
        setIsSubmitting(true);

        try {
            const response =
                await apiClient.post(
                    "/auth/register",
                    {
                        full_name:
                            fullName.trim(),

                        email:
                            email
                                .trim()
                                .toLowerCase(),

                        password
                    }
                );

            setRegistrationResult({
                message:
                    response?.data
                        ?.message ||
                    "User registered successfully. Please verify your email.",

                user:
                    response?.data
                        ?.user ||
                    null,

                email:
                    email
                        .trim()
                        .toLowerCase()
            });
        } catch (error) {
            setErrorMessage(
                getApiMessage(error)
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const resendVerification =
        async () => {
            const targetEmail =
                registrationResult
                    ?.email ||
                email
                    .trim()
                    .toLowerCase();

            if (!targetEmail) {
                return;
            }

            setResendLoading(true);
            setResendMessage("");
            setErrorMessage("");

            try {
                const response =
                    await apiClient.post(
                        "/auth/resend-verification",
                        {
                            email:
                                targetEmail
                        }
                    );

                setResendMessage(
                    response?.data
                        ?.message ||
                    "Verification email request completed."
                );
            } catch (error) {
                setErrorMessage(
                    getApiMessage(error)
                );
            } finally {
                setResendLoading(false);
            }
        };

    if (registrationResult) {
        return (
            <div className="min-h-screen bg-slate-100">
                <div className="grid min-h-screen lg:grid-cols-2">
                    <BrandPanel />

                    <div className="flex items-center justify-center px-5 py-12 sm:px-8">
                        <div className="w-full max-w-md">
                            <MobileBrand />

                            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                                    <CheckCircle2 size={29} />
                                </div>

                                <h2 className="mt-6 text-3xl font-bold text-slate-900">
                                    Account created
                                </h2>

                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    {registrationResult.message}
                                </p>

                                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                    <p className="text-sm font-semibold text-blue-900">
                                        Check your email
                                    </p>

                                    <p className="mt-1 break-all text-sm text-blue-700">
                                        {registrationResult.email}
                                    </p>

                                    <p className="mt-2 text-xs leading-5 text-blue-700">
                                        Open the verification email and follow the verification link before signing in.
                                    </p>
                                </div>

                                {registrationResult
                                    ?.user
                                    ?.public_id && (
                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Your User Public ID
                                        </p>

                                        <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-800">
                                            {
                                                registrationResult
                                                    .user
                                                    .public_id
                                            }
                                        </p>

                                        <p className="mt-2 text-xs leading-5 text-slate-500">
                                            This is the account identifier used when linking this login account to a tenant or owner relationship.
                                        </p>
                                    </div>
                                )}

                                {resendMessage && (
                                    <div
                                        role="status"
                                        className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                                    >
                                        {resendMessage}
                                    </div>
                                )}

                                {errorMessage && (
                                    <div
                                        role="alert"
                                        className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                    >
                                        {errorMessage}
                                    </div>
                                )}

                                <div className="mt-6 space-y-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                "/login"
                                            )
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
                                        "
                                    >
                                        Go to Sign In
                                    </button>

                                    <button
                                        type="button"
                                        onClick={
                                            resendVerification
                                        }
                                        disabled={
                                            resendLoading
                                        }
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
                                            hover:border-blue-200
                                            hover:bg-blue-50
                                            hover:text-blue-700
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60
                                        "
                                    >
                                        {resendLoading
                                            ? "Sending..."
                                            : "Resend Verification Email"}
                                    </button>
                                </div>
                            </div>

                            <FooterText />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="grid min-h-screen lg:grid-cols-2">
                <BrandPanel />

                <div className="flex items-center justify-center px-5 py-12 sm:px-8">
                    <div className="w-full max-w-md">
                        <MobileBrand />

                        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900">
                                    Create your account
                                </h2>

                                <p className="mt-2 text-sm text-slate-500">
                                    Register a secure login account for Rental Manager.
                                </p>
                            </div>

                            <form
                                onSubmit={
                                    handleSubmit
                                }
                                className="mt-8 space-y-5"
                            >
                                {errorMessage && (
                                    <div
                                        role="alert"
                                        aria-live="polite"
                                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                    >
                                        {errorMessage}
                                    </div>
                                )}

                                <Field
                                    id="full_name"
                                    label="Full name"
                                    icon={UserRound}
                                >
                                    <input
                                        id="full_name"
                                        name="full_name"
                                        type="text"
                                        value={fullName}
                                        onChange={event => {
                                            setFullName(
                                                event
                                                    .target
                                                    .value
                                            );

                                            setErrorMessage(
                                                ""
                                            );
                                        }}
                                        autoComplete="name"
                                        placeholder="Enter your full name"
                                        required
                                        disabled={isSubmitting}
                                        className={inputClass}
                                    />
                                </Field>

                                <Field
                                    id="email"
                                    label="Email address"
                                    icon={Mail}
                                >
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        onChange={event => {
                                            setEmail(
                                                event
                                                    .target
                                                    .value
                                            );

                                            setErrorMessage(
                                                ""
                                            );
                                        }}
                                        autoComplete="email"
                                        placeholder="name@example.com"
                                        required
                                        disabled={isSubmitting}
                                        className={inputClass}
                                    />
                                </Field>

                                <Field
                                    id="password"
                                    label="Password"
                                    icon={LockKeyhole}
                                >
                                    <input
                                        id="password"
                                        name="password"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={password}
                                        onChange={event => {
                                            setPassword(
                                                event
                                                    .target
                                                    .value
                                            );

                                            setErrorMessage(
                                                ""
                                            );
                                        }}
                                        autoComplete="new-password"
                                        placeholder="Create a password"
                                        required
                                        disabled={isSubmitting}
                                        className={`${inputClass} pr-12`}
                                    />

                                    <PasswordToggle
                                        shown={
                                            showPassword
                                        }
                                        onToggle={() =>
                                            setShowPassword(
                                                current =>
                                                    !current
                                            )
                                        }
                                        disabled={
                                            isSubmitting
                                        }
                                    />
                                </Field>

                                <Field
                                    id="confirm_password"
                                    label="Confirm password"
                                    icon={LockKeyhole}
                                >
                                    <input
                                        id="confirm_password"
                                        name="confirm_password"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={
                                            confirmPassword
                                        }
                                        onChange={event => {
                                            setConfirmPassword(
                                                event
                                                    .target
                                                    .value
                                            );

                                            setErrorMessage(
                                                ""
                                            );
                                        }}
                                        autoComplete="new-password"
                                        placeholder="Repeat your password"
                                        required
                                        disabled={isSubmitting}
                                        className={`${inputClass} pr-12`}
                                    />

                                    <PasswordToggle
                                        shown={
                                            showConfirmPassword
                                        }
                                        onToggle={() =>
                                            setShowConfirmPassword(
                                                current =>
                                                    !current
                                            )
                                        }
                                        disabled={
                                            isSubmitting
                                        }
                                    />
                                </Field>

                                <button
                                    type="submit"
                                    disabled={
                                        isSubmitting
                                    }
                                    className="
                                        flex w-full
                                        items-center
                                        justify-center
                                        gap-2
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
                                    <UserPlus
                                        size={18}
                                    />

                                    {isSubmitting
                                        ? "Creating Account..."
                                        : "Create Account"}
                                </button>

                                <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500">
                                    <span>
                                        Already have an account?
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                "/login"
                                            )
                                        }
                                        disabled={
                                            isSubmitting
                                        }
                                        className="font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-60"
                                    >
                                        Sign in
                                    </button>
                                </div>
                            </form>
                        </div>

                        <FooterText />
                    </div>
                </div>
            </div>
        </div>
    );
}

const inputClass = `
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
`;

function Field({
    id,
    label,
    icon: Icon,
    children
}) {
    return (
        <div>
            <label
                htmlFor={id}
                className="mb-2 block text-sm font-semibold text-slate-700"
            >
                {label}
            </label>

            <div className="relative">
                <Icon
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                {children}
            </div>
        </div>
    );
}

function PasswordToggle({
    shown,
    onToggle,
    disabled
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            aria-label={
                shown
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
                transition
                hover:bg-slate-100
                hover:text-slate-700
                disabled:cursor-not-allowed
                disabled:opacity-60
            "
        >
            {shown ? (
                <EyeOff size={18} />
            ) : (
                <Eye size={18} />
            )}
        </button>
    );
}

function BrandPanel() {
    return (
        <div className="hidden bg-slate-950 px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
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
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
                    Real Estate Management
                </p>

                <h2 className="mt-5 text-5xl font-bold leading-tight">
                    One account. Controlled access to the property ecosystem.
                </h2>

                <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
                    Register once, verify your email, then receive the owner or tenant permissions assigned to your account.
                </p>
            </div>

            <p className="text-sm text-slate-500">
                Secure Property Management Platform
            </p>
        </div>
    );
}

function MobileBrand() {
    return (
        <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
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
    );
}

function FooterText() {
    return (
        <p className="mt-6 text-center text-xs text-slate-400">
            Secure account registration for the Real Estate Management System
        </p>
    );
}

export default RegisterPage;
