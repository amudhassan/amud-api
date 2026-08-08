import {
    Building2,
    DoorOpen,
    Users,
    Wallet
} from "lucide-react";

const stats = [
    {
        label: "Total Properties",
        value: "0",
        icon: Building2
    },
    {
        label: "Total Units",
        value: "0",
        icon: DoorOpen
    },
    {
        label: "Active Tenants",
        value: "0",
        icon: Users
    },
    {
        label: "Revenue",
        value: "0",
        icon: Wallet
    }
];

function DashboardPage() {
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                    Dashboard
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    Overview of your property management operations.
                </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map(
                    ({
                        label,
                        value,
                        icon: Icon
                    }) => (
                        <div
                            key={label}
                            className="
                                rounded-2xl
                                border border-slate-200
                                bg-white
                                p-6
                                shadow-sm
                            "
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">
                                        {label}
                                    </p>

                                    <p className="mt-3 text-3xl font-bold text-slate-900">
                                        {value}
                                    </p>
                                </div>

                                <div
                                    className="
                                        flex h-12 w-12
                                        items-center justify-center
                                        rounded-xl
                                        bg-blue-50
                                        text-blue-600
                                    "
                                >
                                    <Icon size={23} />
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <div
                    className="
                        rounded-2xl
                        border border-slate-200
                        bg-white
                        p-6
                        shadow-sm
                        xl:col-span-2
                    "
                >
                    <h2 className="text-lg font-bold text-slate-900">
                        Financial Overview
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Dashboard charts will appear here after API integration.
                    </p>

                    <div
                        className="
                            mt-6 flex h-72
                            items-center justify-center
                            rounded-xl
                            border border-dashed
                            border-slate-300
                            bg-slate-50
                            text-sm text-slate-400
                        "
                    >
                        Revenue Chart
                    </div>
                </div>

                <div
                    className="
                        rounded-2xl
                        border border-slate-200
                        bg-white
                        p-6
                        shadow-sm
                    "
                >
                    <h2 className="text-lg font-bold text-slate-900">
                        Recent Activity
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Latest system activities will appear here.
                    </p>

                    <div
                        className="
                            mt-6 flex h-72
                            items-center justify-center
                            rounded-xl
                            border border-dashed
                            border-slate-300
                            bg-slate-50
                            text-sm text-slate-400
                        "
                    >
                        No activity yet
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;