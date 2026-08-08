import {
    Bell,
    ChevronDown,
    LogOut,
    Menu,
    Search
} from "lucide-react";

import {
    useAuth
} from "../../contexts/AuthContext";

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
    const {
        user,
        logout
    } = useAuth();

    const displayName =
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
            user?.role
        );

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={onMenuClick}
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
                        className="
                            relative rounded-xl
                            border border-slate-200
                            p-2.5 text-slate-600
                            hover:bg-slate-100
                        "
                    >
                        <Bell size={20} />

                        <span
                            className="
                                absolute right-2 top-2
                                h-2.5 w-2.5
                                rounded-full
                                border-2 border-white
                                bg-red-500
                            "
                        />
                    </button>

                    <button
                        type="button"
                        className="
                            flex items-center gap-3
                            rounded-xl
                            border border-slate-200
                            bg-white
                            px-2 py-1.5
                            hover:bg-slate-50
                        "
                    >
                        <div
                            className="
                                flex h-9 w-9
                                items-center justify-center
                                rounded-xl
                                bg-blue-600
                                text-sm font-bold
                                text-white
                            "
                        >
                            {avatarInitial}
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
                            className="hidden text-slate-400 md:block"
                        />
                    </button>

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