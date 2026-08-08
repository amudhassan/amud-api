import {
    useState
} from "react";

import {
    Outlet
} from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

function MainLayout() {
    const [
        sidebarOpen,
        setSidebarOpen
    ] = useState(false);

    const openSidebar = () => {
        setSidebarOpen(true);
    };

    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={closeSidebar}
            />

            <div className="min-h-screen lg:pl-72">
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