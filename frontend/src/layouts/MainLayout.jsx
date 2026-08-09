import {
    useState
} from "react";

import {
    Outlet
} from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

const getInitialSidebarCollapsed = () => {
    try {
        return (
            window.localStorage.getItem(
                "rental_manager_sidebar_collapsed"
            ) === "true"
        );
    } catch {
        return false;
    }
};

function MainLayout() {
    const [
        sidebarOpen,
        setSidebarOpen
    ] = useState(false);

    const [
        sidebarCollapsed,
        setSidebarCollapsed
    ] = useState(
        getInitialSidebarCollapsed
    );

    const openSidebar = () => {
        setSidebarOpen(true);
    };

    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    const toggleSidebarCollapsed = () => {
        setSidebarCollapsed(current => {
            const next = !current;

            try {
                window.localStorage.setItem(
                    "rental_manager_sidebar_collapsed",
                    String(next)
                );
            } catch {
                // The sidebar still works if localStorage is unavailable.
            }

            return next;
        });
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={closeSidebar}
                collapsed={sidebarCollapsed}
                onToggleCollapse={
                    toggleSidebarCollapsed
                }
            />

            <div
                className={`
                    min-h-screen
                    transition-[padding] duration-300
                    ${
                        sidebarCollapsed
                            ? "lg:pl-20"
                            : "lg:pl-72"
                    }
                `}
            >
                <Topbar
                    onMenuClick={openSidebar}
                />

                <main className="px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-[1600px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default MainLayout;
