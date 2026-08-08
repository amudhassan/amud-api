import {
    BarChart3,
    Bell,
    Building2,
    DoorOpen,
    FileText,
    LayoutDashboard,
    ReceiptText,
    Settings,
    Users,
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
    onClose = () => {}
}) {
    const getNavigationClass = ({
        isActive
    }) => {
        return `
            flex w-full items-center gap-3
            rounded-xl px-3 py-3
            text-sm font-medium
            transition
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
                    transition-transform duration-300
                    lg:translate-x-0
                    ${
                        isOpen
                            ? "translate-x-0"
                            : "-translate-x-full"
                    }
                `}
            >
                <div className="flex h-20 items-center justify-between border-b border-slate-800 px-6">
                    <div>
                        <h1 className="text-lg font-bold tracking-wide">
                            Rental Manager
                        </h1>

                        <p className="mt-1 text-xs text-slate-400">
                            Property Management
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-6">
                    <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                                >
                                    <Icon size={19} />

                                    <span>
                                        {label}
                                    </span>
                                </NavLink>
                            )
                        )}
                    </div>
                </nav>

                <div className="border-t border-slate-800 p-4">
                    <NavLink
                        to="/settings"
                        onClick={onClose}
                        className={getNavigationClass}
                    >
                        <Settings size={19} />

                        <span>
                            Settings
                        </span>
                    </NavLink>

                    <div className="mt-4 rounded-xl bg-slate-900 p-4">
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
                </div>
            </aside>
        </>
    );
}

export default Sidebar;