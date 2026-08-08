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

    return <Outlet />;
}

export default ProtectedRoute;