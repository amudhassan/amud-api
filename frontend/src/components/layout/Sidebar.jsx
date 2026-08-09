import {
    BarChart3,
    Bell,
    Building2,
    DoorOpen,
    FileText,
    LayoutDashboard,
    PanelLeftClose,
    PanelLeftOpen,
    ReceiptText,
    Settings,
    Users,
    UserRoundCog,
    Wrench,
    X
} from "lucide-react";

import {
    NavLink
} from "react-router-dom";

const navigationItems = [
    {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard
    },
    {
        label: "Users",
        path: "/users",
        icon: UserRoundCog
    },
    {
        label: "Owners",
        path: "/owners",
        icon: Users
    },
    {
        label: "Properties",
        path: "/properties",
        icon: Building2
    },
    {
        label: "Units",
        path: "/units",
        icon: DoorOpen
    },
    {
        label: "Tenants",
        path: "/tenants",
        icon: Users
    },
    {
        label: "Leases",
        path: "/leases",
        icon: FileText
    },
    {
        label: "Invoices",
        path: "/invoices",
        icon: ReceiptText
    },
    {
        label: "Payments & Receipts",
        path: "/payments",
        icon: ReceiptText
    },
    {
        label: "Maintenance",
        path: "/maintenance",
        icon: Wrench
    },
    {
        label: "Notifications",
        path: "/notifications",
        icon: Bell
    },
    {
        label: "Reports",
        path: "/reports",
        icon: BarChart3
    }
];

function Sidebar({
    isOpen = false,
    onClose = () => {},
    collapsed = false,
    onToggleCollapse = () => {}
}) {
    const getNavigationClass = ({
        isActive
    }) => {
        return `
            flex w-full items-center
            rounded-xl py-3
            text-sm font-medium
            transition
            ${
                collapsed
                    ? "gap-0 px-2 lg:justify-center"
                    : "gap-3 px-3"
            }
            ${
                isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }
        `;
    };

    return (
        <>
            {isOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar overlay"
                    onClick={onClose}
                    className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
                />
            )}

            <aside
                className={`
                    fixed inset-y-0 left-0 z-40
                    flex w-72 flex-col
                    bg-slate-950 text-white
                    transition-[width,transform] duration-300
                    lg:translate-x-0
                    ${
                        collapsed
                            ? "lg:w-20"
                            : "lg:w-72"
                    }
                    ${
                        isOpen
                            ? "translate-x-0"
                            : "-translate-x-full"
                    }
                `}
            >
                <div
                    className={`
                        flex h-20 items-center
                        border-b border-slate-800
                        ${
                            collapsed
                                ? "justify-between px-4 lg:justify-center lg:px-2"
                                : "justify-between px-6"
                        }
                    `}
                >
                    <div
                        className={
                            collapsed
                                ? "lg:hidden"
                                : ""
                        }
                    >
                        <h1 className="text-lg font-bold tracking-wide">
                            Rental Manager
                        </h1>

                        <p className="mt-1 text-xs text-slate-400">
                            Property Management
                        </p>
                    </div>

                    <div
                        className={
                            collapsed
                                ? "hidden lg:flex"
                                : "hidden"
                        }
                    >
                        <div
                            className="
                                flex h-10 w-10
                                items-center justify-center
                                rounded-xl
                                bg-blue-600
                                text-sm font-bold
                                tracking-wide
                            "
                            title="Rental Manager"
                        >
                            RM
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close sidebar"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav
                    className={`
                        flex-1 overflow-y-auto py-6
                        ${
                            collapsed
                                ? "px-3"
                                : "px-4"
                        }
                    `}
                >
                    <p
                        className={`
                            mb-3 px-3
                            text-xs font-semibold
                            uppercase tracking-wider
                            text-slate-500
                            ${
                                collapsed
                                    ? "lg:hidden"
                                    : ""
                            }
                        `}
                    >
                        Management
                    </p>

                    <div className="space-y-1">
                        {navigationItems.map(
                            ({
                                label,
                                path,
                                icon: Icon
                            }) => (
                                <NavLink
                                    key={path}
                                    to={path}
                                    onClick={onClose}
                                    className={getNavigationClass}
                                    title={
                                        collapsed
                                            ? label
                                            : undefined
                                    }
                                >
                                    <Icon
                                        size={19}
                                        className="shrink-0"
                                    />

                                    <span
                                        className={
                                            collapsed
                                                ? "lg:hidden"
                                                : ""
                                        }
                                    >
                                        {label}
                                    </span>
                                </NavLink>
                            )
                        )}
                    </div>
                </nav>

                <div
                    className={`
                        border-t border-slate-800
                        ${
                            collapsed
                                ? "p-3"
                                : "p-4"
                        }
                    `}
                >
                    <NavLink
                        to="/settings"
                        onClick={onClose}
                        className={getNavigationClass}
                        title={
                            collapsed
                                ? "Settings"
                                : undefined
                        }
                    >
                        <Settings
                            size={19}
                            className="shrink-0"
                        />

                        <span
                            className={
                                collapsed
                                    ? "lg:hidden"
                                    : ""
                            }
                        >
                            Settings
                        </span>
                    </NavLink>

                    <div
                        className={`
                            mt-4 rounded-xl bg-slate-900
                            ${
                                collapsed
                                    ? "p-3 lg:flex lg:justify-center"
                                    : "p-4"
                            }
                        `}
                        title={
                            collapsed
                                ? "Backend Connected"
                                : undefined
                        }
                    >
                        <div
                            className={
                                collapsed
                                    ? "lg:hidden"
                                    : ""
                            }
                        >
                            <p className="text-sm font-semibold">
                                System Status
                            </p>

                            <div className="mt-2 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                                <span className="text-xs text-slate-400">
                                    Backend Connected
                                </span>
                            </div>
                        </div>

                        <span
                            className={`
                                hidden h-2.5 w-2.5
                                rounded-full
                                bg-emerald-400
                                ${
                                    collapsed
                                        ? "lg:block"
                                        : ""
                                }
                            `}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-label={
                            collapsed
                                ? "Expand sidebar"
                                : "Collapse sidebar"
                        }
                        title={
                            collapsed
                                ? "Expand sidebar"
                                : "Collapse sidebar"
                        }
                        className="
                            mt-3 hidden w-full
                            items-center justify-center
                            gap-2
                            rounded-xl
                            border border-slate-800
                            px-3 py-2.5
                            text-sm font-semibold
                            text-slate-300
                            transition
                            hover:bg-slate-800
                            hover:text-white
                            lg:flex
                        "
                    >
                        {collapsed ? (
                            <PanelLeftOpen size={18} />
                        ) : (
                            <PanelLeftClose size={18} />
                        )}

                        <span
                            className={
                                collapsed
                                    ? "hidden"
                                    : ""
                            }
                        >
                            Shrink Sidebar
                        </span>
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
