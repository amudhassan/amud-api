import {
    Bell,
    ChevronDown,
    LogOut,
    Menu,
    Search,
    UserRound
} from "lucide-react";

import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import apiClient from "../../api/apiClient";

import {
    useAuth
} from "../../contexts/AuthContext";

const extractUnreadNotificationCount = response => {
    const root = response?.data || {};
    const data = root?.data || {};

    const candidates = [
        data.unread_count,
        data.count,
        root.unread_count,
        root.count
    ];

    for (const candidate of candidates) {
        const parsed = Number(candidate);

        if (Number.isFinite(parsed)) {
            return Math.max(0, parsed);
        }
    }

    return 0;
};

function formatRole(role) {
    if (!role) {
        return "Authenticated User";
    }

    return role
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            (character) =>
                character.toUpperCase()
        );
}

function Topbar({
    onMenuClick = () => {}
}) {
    const navigate = useNavigate();

    const {
        user,
        logout
    } = useAuth();

    const [
        profile,
        setProfile
    ] = useState(user || null);

    const [
        profileMenuOpen,
        setProfileMenuOpen
    ] = useState(false);

    const [
        unreadNotificationCount,
        setUnreadNotificationCount
    ] = useState(0);

    const profileMenuRef =
        useRef(null);

    useEffect(() => {
        let active = true;

        const loadProfile =
            async () => {
                try {
                    const response =
                        await apiClient.get(
                            "/auth/profile"
                        );

                    if (
                        active &&
                        response?.data?.user
                    ) {
                        setProfile(
                            response.data.user
                        );
                    }
                } catch {
                    /*
                     * The topbar remains usable with the
                     * authenticated session snapshot.
                     */
                }
            };

        loadProfile();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const handleProfileUpdated =
            event => {
                if (
                    event?.detail &&
                    typeof event.detail ===
                        "object"
                ) {
                    setProfile(
                        current => ({
                            ...current,
                            ...event.detail
                        })
                    );
                }
            };

        window.addEventListener(
            "rental-manager:profile-updated",
            handleProfileUpdated
        );

        return () => {
            window.removeEventListener(
                "rental-manager:profile-updated",
                handleProfileUpdated
            );
        };
    }, []);

    useEffect(() => {
        let active = true;

        const loadUnreadNotificationCount =
            async () => {
                try {
                    const response =
                        await apiClient.get(
                            "/notifications/unread-count"
                        );

                    if (active) {
                        setUnreadNotificationCount(
                            extractUnreadNotificationCount(
                                response
                            )
                        );
                    }
                } catch {
                    /*
                     * Notification count must never block the
                     * rest of the topbar when the request fails.
                     */
                }
            };

        const handleWindowFocus = () => {
            loadUnreadNotificationCount();
        };

        const handleUnreadCountUpdated = event => {
            const suppliedCount = Number(
                event?.detail?.unread_count ??
                event?.detail
            );

            if (
                Number.isFinite(suppliedCount) &&
                suppliedCount >= 0
            ) {
                if (active) {
                    setUnreadNotificationCount(
                        suppliedCount
                    );
                }

                return;
            }

            loadUnreadNotificationCount();
        };

        loadUnreadNotificationCount();

        const refreshTimer =
            window.setInterval(
                loadUnreadNotificationCount,
                30000
            );

        window.addEventListener(
            "focus",
            handleWindowFocus
        );

        window.addEventListener(
            "rental-manager:notification-unread-count",
            handleUnreadCountUpdated
        );

        return () => {
            active = false;

            window.clearInterval(
                refreshTimer
            );

            window.removeEventListener(
                "focus",
                handleWindowFocus
            );

            window.removeEventListener(
                "rental-manager:notification-unread-count",
                handleUnreadCountUpdated
            );
        };
    }, []);

    useEffect(() => {
        const handlePointerDown =
            event => {
                if (
                    profileMenuRef.current &&
                    !profileMenuRef.current.contains(
                        event.target
                    )
                ) {
                    setProfileMenuOpen(
                        false
                    );
                }
            };

        document.addEventListener(
            "mousedown",
            handlePointerDown
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handlePointerDown
            );
        };
    }, []);

    const displayName =
        profile?.full_name ||
        user?.full_name ||
        "User";

    const avatarInitial =
        displayName
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "U";

    const displayRole =
        formatRole(
            profile?.role ||
            user?.role
        );

    const profileImageUrl =
        profile?.profile_image_url ||
        null;

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        aria-label="Open navigation"
                        className="
                            rounded-xl border border-slate-200
                            p-2.5 text-slate-600
                            hover:bg-slate-100
                            lg:hidden
                        "
                    >
                        <Menu size={21} />
                    </button>

                    <div className="hidden min-w-0 sm:block">
                        <h2 className="truncate text-lg font-bold text-slate-900">
                            Property Management Dashboard
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            Manage properties, tenants and financial operations
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative hidden xl:block">
                        <Search
                            size={18}
                            className="
                                absolute left-3 top-1/2
                                -translate-y-1/2
                                text-slate-400
                            "
                        />

                        <input
                            type="search"
                            placeholder="Search..."
                            className="
                                w-72 rounded-xl
                                border border-slate-200
                                bg-slate-50
                                py-2.5 pl-10 pr-4
                                text-sm text-slate-700
                                outline-none
                                transition
                                placeholder:text-slate-400
                                focus:border-blue-500
                                focus:bg-white
                                focus:ring-4
                                focus:ring-blue-100
                            "
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/notifications"
                            )
                        }
                        aria-label="Notifications"
                        title="Open notifications"
                        className="
                            relative rounded-xl
                            border border-slate-200
                            p-2.5 text-slate-600
                            hover:bg-slate-100
                        "
                    >
                        <Bell size={20} />

                        {unreadNotificationCount > 0 && (
                            <span
                                className="
                                    absolute -right-2 -top-2
                                    flex h-5 min-w-5
                                    items-center justify-center
                                    rounded-full
                                    border-2 border-white
                                    bg-red-500 px-1
                                    text-[10px] font-bold
                                    leading-none text-white
                                "
                                aria-label={`${unreadNotificationCount} unread notifications`}
                            >
                                {unreadNotificationCount > 99
                                    ? "99+"
                                    : unreadNotificationCount}
                            </span>
                        )}
                    </button>

                    <div
                        ref={profileMenuRef}
                        className="relative"
                    >
                        <button
                            type="button"
                            onClick={() =>
                                setProfileMenuOpen(
                                    current =>
                                        !current
                                )
                            }
                            aria-haspopup="menu"
                            aria-expanded={
                                profileMenuOpen
                            }
                            className="
                                flex items-center gap-3
                                rounded-xl
                                border border-slate-200
                                bg-white
                                px-2 py-1.5
                                transition
                                hover:bg-slate-50
                                focus:outline-none
                                focus:ring-2
                                focus:ring-blue-100
                            "
                        >
                            <div
                                className="
                                    h-9 w-9
                                    overflow-hidden
                                    rounded-xl
                                    bg-blue-600
                                    text-sm font-bold
                                    text-white
                                    ring-1 ring-slate-200
                                "
                            >
                                {profileImageUrl ? (
                                    <img
                                        src={
                                            profileImageUrl
                                        }
                                        alt={`${displayName} profile`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        {
                                            avatarInitial
                                        }
                                    </div>
                                )}
                            </div>

                            <div className="hidden text-left md:block">
                                <p className="max-w-44 truncate text-sm font-semibold text-slate-800">
                                    {displayName}
                                </p>

                                <p className="text-xs text-slate-500">
                                    {displayRole}
                                </p>
                            </div>

                            <ChevronDown
                                size={16}
                                className={`hidden text-slate-400 transition-transform md:block ${
                                    profileMenuOpen
                                        ? "rotate-180"
                                        : ""
                                }`}
                            />
                        </button>

                        {profileMenuOpen && (
                            <div
                                role="menu"
                                className="
                                    absolute right-0 mt-2
                                    w-60 overflow-hidden
                                    rounded-2xl
                                    border border-slate-200
                                    bg-white
                                    p-2
                                    shadow-xl
                                "
                            >
                                <div className="border-b border-slate-100 px-3 py-2.5">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {displayName}
                                    </p>

                                    <p className="mt-0.5 truncate text-xs text-slate-500">
                                        {
                                            profile?.email ||
                                            user?.email ||
                                            ""
                                        }
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setProfileMenuOpen(
                                            false
                                        );

                                        navigate(
                                            "/profile"
                                        );
                                    }}
                                    className="
                                        mt-1 flex w-full
                                        items-center gap-2.5
                                        rounded-xl
                                        px-3 py-2.5
                                        text-left text-sm
                                        font-medium
                                        text-slate-700
                                        transition
                                        hover:bg-slate-50
                                    "
                                >
                                    <UserRound size={17} />
                                    My Profile
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={logout}
                        className="
                            flex items-center gap-2
                            rounded-xl
                            border border-slate-200
                            bg-white
                            px-3 py-2.5
                            text-sm font-medium
                            text-slate-600
                            transition
                            hover:bg-red-50
                            hover:text-red-600
                        "
                    >
                        <LogOut size={18} />

                        <span className="hidden sm:inline">
                            Logout
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Topbar;
