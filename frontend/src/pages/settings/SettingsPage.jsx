import {
    BellRing,
    Camera,
    CheckCircle2,
    KeyRound,
    Laptop,
    Loader2,
    LockKeyhole,
    Mail,
    RefreshCw,
    Save,
    ShieldCheck,
    Smartphone,
    UserRound,
    Wifi,
    XCircle
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

import {
    useAuth
} from "../../contexts/AuthContext";

import NotificationPreferencesModal from "../notifications/NotificationPreferencesModal";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to complete this settings action.";

const formatRole = value =>
    String(value || "Authenticated user")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "Not available";
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

const getDeviceLabel = userAgent => {
    const value = String(userAgent || "").toLowerCase();

    let browser = "Browser";
    let platform = "Device";

    if (value.includes("edg/")) {
        browser = "Microsoft Edge";
    } else if (
        value.includes("chrome/") &&
        !value.includes("chromium/")
    ) {
        browser = "Google Chrome";
    } else if (value.includes("firefox/")) {
        browser = "Mozilla Firefox";
    } else if (
        value.includes("safari/") &&
        !value.includes("chrome/")
    ) {
        browser = "Safari";
    }

    if (value.includes("windows")) {
        platform = "Windows";
    } else if (
        value.includes("iphone") ||
        value.includes("ipad")
    ) {
        platform = "iOS";
    } else if (value.includes("android")) {
        platform = "Android";
    } else if (value.includes("mac os")) {
        platform = "macOS";
    } else if (value.includes("linux")) {
        platform = "Linux";
    }

    return `${browser} on ${platform}`;
};

const getDeviceIcon = userAgent => {
    const value = String(userAgent || "").toLowerCase();

    if (
        value.includes("android") ||
        value.includes("iphone") ||
        value.includes("mobile")
    ) {
        return Smartphone;
    }

    return Laptop;
};

function SectionCard({
    icon: Icon,
    title,
    description,
    children,
    action = null
}) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" />
                    </div>

                    <div>
                        <h2 className="text-base font-bold text-slate-950">
                            {title}
                        </h2>

                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                            {description}
                        </p>
                    </div>
                </div>

                {action}
            </div>

            <div className="p-5 sm:p-6">
                {children}
            </div>
        </section>
    );
}

function StatusMessage({ type, children }) {
    if (!children) {
        return null;
    }

    const success = type === "success";
    const Icon = success
        ? CheckCircle2
        : XCircle;

    return (
        <div
            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
        >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}

function SettingsPage() {
    const {
        user
    } = useAuth();

    const fileInputRef = useRef(null);

    const [profile, setProfile] = useState(user || null);
    const [fullName, setFullName] = useState(
        user?.full_name || ""
    );
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileUploading, setProfileUploading] = useState(false);
    const [profileError, setProfileError] = useState("");
    const [profileSuccess, setProfileSuccess] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [sessionsError, setSessionsError] = useState("");
    const [revokingSessionId, setRevokingSessionId] = useState("");

    const [preferencesOpen, setPreferencesOpen] = useState(false);
    const [preferencesMessage, setPreferencesMessage] = useState("");

    const dispatchProfileUpdate = useCallback(
        updatedProfile => {
            window.dispatchEvent(
                new CustomEvent(
                    "rental-manager:profile-updated",
                    {
                        detail: updatedProfile
                    }
                )
            );
        },
        []
    );

    const loadProfile = useCallback(async () => {
        setProfileLoading(true);
        setProfileError("");

        try {
            const response = await apiClient.get(
                "/auth/profile"
            );

            const loadedProfile =
                response?.data?.user ||
                null;

            if (loadedProfile) {
                setProfile(loadedProfile);
                setFullName(
                    loadedProfile.full_name || ""
                );
            }
        } catch (error) {
            setProfileError(
                getErrorMessage(error)
            );
        } finally {
            setProfileLoading(false);
        }
    }, []);

    const loadSessions = useCallback(async () => {
        setSessionsLoading(true);
        setSessionsError("");

        try {
            const response = await apiClient.get(
                "/auth/sessions"
            );

            setSessions(
                Array.isArray(
                    response?.data?.sessions
                )
                    ? response.data.sessions
                    : []
            );
        } catch (error) {
            setSessions([]);
            setSessionsError(
                getErrorMessage(error)
            );
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
        loadSessions();
    }, [loadProfile, loadSessions]);

    const avatarInitial = useMemo(
        () =>
            String(
                profile?.full_name ||
                user?.full_name ||
                "U"
            )
                .trim()
                .charAt(0)
                .toUpperCase() || "U",
        [profile, user]
    );

    const handleProfileSubmit = async event => {
        event.preventDefault();
        setProfileError("");
        setProfileSuccess("");

        const normalizedName = fullName.trim();

        if (!normalizedName) {
            setProfileError(
                "Full name is required."
            );
            return;
        }

        setProfileSaving(true);

        try {
            const response = await apiClient.put(
                "/auth/profile",
                {
                    full_name: normalizedName
                }
            );

            const updatedProfile =
                response?.data?.user ||
                {
                    ...profile,
                    full_name: normalizedName
                };

            setProfile(current => ({
                ...current,
                ...updatedProfile
            }));
            setFullName(
                updatedProfile.full_name ||
                normalizedName
            );
            setProfileSuccess(
                response?.data?.message ||
                "Profile updated successfully."
            );
            dispatchProfileUpdate(
                updatedProfile
            );
        } catch (error) {
            setProfileError(
                getErrorMessage(error)
            );
        } finally {
            setProfileSaving(false);
        }
    };

    const handleProfilePictureChange = async event => {
        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setProfileError(
                "Please choose an image file."
            );
            return;
        }

        setProfileUploading(true);
        setProfileError("");
        setProfileSuccess("");

        try {
            const formData = new FormData();
            formData.append(
                "profile_image",
                file
            );

            const response = await apiClient.put(
                "/auth/profile-picture",
                formData
            );

            const updatedProfile =
                response?.data?.user ||
                null;

            if (updatedProfile) {
                setProfile(current => ({
                    ...current,
                    ...updatedProfile
                }));
                dispatchProfileUpdate(
                    updatedProfile
                );
            }

            setProfileSuccess(
                response?.data?.message ||
                "Profile picture updated successfully."
            );
        } catch (error) {
            setProfileError(
                getErrorMessage(error)
            );
        } finally {
            setProfileUploading(false);
        }
    };

    const handlePasswordSubmit = async event => {
        event.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");

        if (!currentPassword || !newPassword) {
            setPasswordError(
                "Current password and new password are required."
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError(
                "New password and confirmation do not match."
            );
            return;
        }

        if (currentPassword === newPassword) {
            setPasswordError(
                "New password must be different from the current password."
            );
            return;
        }

        setPasswordSaving(true);

        try {
            const response = await apiClient.put(
                "/auth/change-password",
                {
                    currentPassword,
                    newPassword
                }
            );

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordSuccess(
                response?.data?.message ||
                "Password changed successfully."
            );
        } catch (error) {
            setPasswordError(
                getErrorMessage(error)
            );
        } finally {
            setPasswordSaving(false);
        }
    };

    const revokeSession = async session => {
        if (!session?.public_id) {
            return;
        }

        const confirmed = window.confirm(
            `Sign out ${getDeviceLabel(session.user_agent)}?`
        );

        if (!confirmed) {
            return;
        }

        setRevokingSessionId(
            session.public_id
        );
        setSessionsError("");

        try {
            await apiClient.delete(
                `/auth/sessions/${session.public_id}`
            );

            setSessions(current =>
                current.filter(
                    item =>
                        item.public_id !==
                        session.public_id
                )
            );
        } catch (error) {
            setSessionsError(
                getErrorMessage(error)
            );
        } finally {
            setRevokingSessionId("");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <ShieldCheck className="h-5 w-5" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-950">
                            Settings
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Manage your profile, security, sessions and notification preferences.
                        </p>
                    </div>
                </div>
            </div>

            <SectionCard
                icon={UserRound}
                title="My Profile"
                description="Update your display name and profile picture. Your email and account role are shown for reference."
                action={
                    <button
                        type="button"
                        onClick={loadProfile}
                        disabled={profileLoading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${
                                profileLoading
                                    ? "animate-spin"
                                    : ""
                            }`}
                        />
                        Refresh
                    </button>
                }
            >
                {profileLoading ? (
                    <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading profile...
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                            <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-3xl font-bold text-white ring-4 ring-white shadow-sm">
                                {profile?.profile_image_url ? (
                                    <img
                                        src={profile.profile_image_url}
                                        alt={profile?.full_name || "Profile"}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    avatarInitial
                                )}
                            </div>

                            <h3 className="mt-4 truncate text-sm font-bold text-slate-900">
                                {profile?.full_name || "User"}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                                {formatRole(profile?.role || user?.role)}
                            </p>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleProfilePictureChange}
                                className="hidden"
                            />

                            <button
                                type="button"
                                disabled={profileUploading}
                                onClick={() =>
                                    fileInputRef.current?.click()
                                }
                                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {profileUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Camera className="h-4 w-4" />
                                )}
                                Change Photo
                            </button>
                        </div>

                        <form
                            onSubmit={handleProfileSubmit}
                            className="space-y-4"
                        >
                            <StatusMessage type="error">
                                {profileError}
                            </StatusMessage>

                            <StatusMessage type="success">
                                {profileSuccess}
                            </StatusMessage>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-sm font-semibold text-slate-700">
                                        Full Name
                                    </span>
                                    <div className="relative">
                                        <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={fullName}
                                            onChange={event =>
                                                setFullName(event.target.value)
                                            }
                                            required
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-sm font-semibold text-slate-700">
                                        Email Address
                                    </span>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={profile?.email || user?.email || ""}
                                            readOnly
                                            className="h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-600 outline-none"
                                        />
                                    </div>
                                    <span className="block text-xs text-slate-400">
                                        Email changes are not enabled in the current profile API.
                                    </span>
                                </label>
                            </div>

                            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Account Role
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-800">
                                        {formatRole(profile?.role || user?.role)}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Email Verification
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                        {profile?.is_verified ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                Verified
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="h-4 w-4 text-amber-600" />
                                                Not verified
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    leftIcon={Save}
                                    disabled={profileSaving}
                                >
                                    {profileSaving
                                        ? "Saving..."
                                        : "Save Profile"}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </SectionCard>

            <SectionCard
                icon={LockKeyhole}
                title="Security"
                description="Change your account password using your current password for verification."
            >
                <form
                    onSubmit={handlePasswordSubmit}
                    className="space-y-4"
                >
                    <StatusMessage type="error">
                        {passwordError}
                    </StatusMessage>

                    <StatusMessage type="success">
                        {passwordSuccess}
                    </StatusMessage>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <label className="space-y-1.5">
                            <span className="text-sm font-semibold text-slate-700">
                                Current Password
                            </span>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={event =>
                                        setCurrentPassword(event.target.value)
                                    }
                                    required
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-sm font-semibold text-slate-700">
                                New Password
                            </span>
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={event =>
                                    setNewPassword(event.target.value)
                                }
                                required
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>

                        <label className="space-y-1.5">
                            <span className="text-sm font-semibold text-slate-700">
                                Confirm New Password
                            </span>
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={event =>
                                    setConfirmPassword(event.target.value)
                                }
                                required
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            leftIcon={KeyRound}
                            disabled={passwordSaving}
                        >
                            {passwordSaving
                                ? "Changing..."
                                : "Change Password"}
                        </Button>
                    </div>
                </form>
            </SectionCard>

            <SectionCard
                icon={Laptop}
                title="Active Sessions"
                description="Review browsers and devices currently signed in to your account and revoke sessions you no longer recognize."
                action={
                    <button
                        type="button"
                        onClick={loadSessions}
                        disabled={sessionsLoading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${
                                sessionsLoading
                                    ? "animate-spin"
                                    : ""
                            }`}
                        />
                        Refresh
                    </button>
                }
            >
                <StatusMessage type="error">
                    {sessionsError}
                </StatusMessage>

                {sessionsLoading ? (
                    <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading active sessions...
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        No active sessions were returned by the server.
                    </div>
                ) : (
                    <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                        {sessions.map(session => {
                            const DeviceIcon =
                                getDeviceIcon(
                                    session.user_agent
                                );

                            const revoking =
                                revokingSessionId ===
                                session.public_id;

                            return (
                                <div
                                    key={session.public_id}
                                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                            <DeviceIcon className="h-5 w-5" />
                                        </div>

                                        <div className="min-w-0">
                                            <div className="font-semibold text-slate-900">
                                                {getDeviceLabel(
                                                    session.user_agent
                                                )}
                                            </div>

                                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                                <span className="inline-flex items-center gap-1">
                                                    <Wifi className="h-3.5 w-3.5" />
                                                    {session.ip_address || "IP unavailable"}
                                                </span>
                                                <span>
                                                    Last used: {formatDateTime(session.last_used_at)}
                                                </span>
                                                <span>
                                                    Expires: {formatDateTime(session.expires_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={
                                            Boolean(revokingSessionId)
                                        }
                                        onClick={() =>
                                            revokeSession(session)
                                        }
                                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {revoking
                                            ? "Signing out..."
                                            : "Sign Out Session"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>

            <SectionCard
                icon={BellRing}
                title="Notification Preferences"
                description="Choose notification channels, priority threshold, quiet hours and categories using the notification preferences already supported by the system."
                action={
                    <Button
                        type="button"
                        leftIcon={BellRing}
                        onClick={() => {
                            setPreferencesMessage("");
                            setPreferencesOpen(true);
                        }}
                    >
                        Manage Preferences
                    </Button>
                }
            >
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-800">
                        Notification controls are managed from one shared preference record.
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                        Changes made here are the same preferences used by the Notifications module.
                    </p>

                    {preferencesMessage ? (
                        <div className="mt-3">
                            <StatusMessage type="success">
                                {preferencesMessage}
                            </StatusMessage>
                        </div>
                    ) : null}
                </div>
            </SectionCard>

            <NotificationPreferencesModal
                open={preferencesOpen}
                onClose={() =>
                    setPreferencesOpen(false)
                }
                onSaved={() => {
                    setPreferencesMessage(
                        "Notification preferences saved successfully."
                    );
                }}
            />
        </div>
    );
}

export default SettingsPage;
