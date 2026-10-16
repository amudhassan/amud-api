import { canAccessPath } from "./navigationAccess";
import {
    Navigate,
    Outlet,
    useLocation
} from "react-router-dom";

import {
    useAuth
} from "../contexts/AuthContext";

function ProtectedRoute() {
    const {
        user,
        isAuthenticated,
        isAuthChecking
    } = useAuth();

    const location =
        useLocation();

    if (isAuthChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100">
                <p className="text-sm font-medium text-slate-500">
                    Verifying session...
                </p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from: location
                }}
            />
        );
    }

    if (!canAccessPath(user, location.pathname)) {
        return <div className="mx-auto max-w-xl p-8"><h1 className="text-xl font-bold">Access restricted</h1><p className="mt-3 text-slate-600">This page is not included in your assigned access.</p><a className="mt-4 inline-block text-blue-700 underline" href="/dashboard">Go to dashboard</a></div>;
    }
    return <Outlet />;
}

export default ProtectedRoute;