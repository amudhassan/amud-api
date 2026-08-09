import {
    Navigate,
    Route,
    Routes
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import OwnersPage from "./pages/owners/OwnersPage";
import PropertiesPage from "./pages/properties/PropertiesPage";
import PropertyDetailPage from "./pages/properties/PropertyDetailPage";
import UnitsPage from "./pages/units/UnitsPage";
import DeletedUnitsPage from "./pages/units/DeletedUnitsPage";
import UnitDetailPage from "./pages/units/UnitDetailPage";
import TenantsPage from "./pages/tenants/TenantsPage";
import DeletedTenantsPage from "./pages/tenants/DeletedTenantsPage";
import TenantDetailPage from "./pages/tenants/TenantDetailPage";
import TenantUsersPage from "./pages/tenants/TenantUsersPage";
import LeasesPage from "./pages/leases/LeasesPage";
import InvoicesPage from "./pages/invoices/InvoicesPage";
import PaymentsPage from "./pages/payments/PaymentsPage";
import MaintenancePage from "./pages/maintenance/MaintenancePage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import ReportsPage from "./pages/reports/ReportsPage";
import SettingsPage from "./pages/settings/SettingsPage";

function App() {
    return (
        <Routes>
            <Route
                path="/login"
                element={<LoginPage />}
            />

            <Route
                path="/register"
                element={<RegisterPage />}
            />

            <Route
                path="/forgot-password"
                element={<ForgotPasswordPage />}
            />

            <Route
                path="/reset-password"
                element={<ResetPasswordPage />}
            />

            <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                    <Route
                        index
                        element={
                            <Navigate
                                to="/dashboard"
                                replace
                            />
                        }
                    />

                    <Route
                        path="dashboard"
                        element={<DashboardPage />}
                    />

                    <Route
                        path="owners"
                        element={<OwnersPage />}
                    />

                    <Route
                        path="properties"
                        element={<PropertiesPage />}
                    />

                    <Route
                        path="properties/:property_public_id"
                        element={<PropertyDetailPage />}
                    />

                    <Route
                        path="units"
                        element={<UnitsPage />}
                    />

                    <Route
                        path="units/deleted"
                        element={<DeletedUnitsPage />}
                    />

                    <Route
                        path="units/:unit_public_id"
                        element={<UnitDetailPage />}
                    />

                    <Route
                        path="tenants"
                        element={<TenantsPage />}
                    />

                    <Route
                        path="tenants/deleted"
                        element={<DeletedTenantsPage />}
                    />

                    <Route
                        path="tenants/:tenant_public_id/users"
                        element={<TenantUsersPage />}
                    />

                    <Route
                        path="tenants/:tenant_public_id"
                        element={<TenantDetailPage />}
                    />

                    <Route
                        path="leases"
                        element={<LeasesPage />}
                    />

                    <Route
                        path="invoices"
                        element={<InvoicesPage />}
                    />

                    <Route
                        path="payments"
                        element={<PaymentsPage />}
                    />

                    <Route
                        path="maintenance"
                        element={<MaintenancePage />}
                    />

                    <Route
                        path="notifications"
                        element={<NotificationsPage />}
                    />

                    <Route
                        path="reports"
                        element={<ReportsPage />}
                    />

                    <Route
                        path="settings"
                        element={<SettingsPage />}
                    />
                </Route>
            </Route>

            <Route
                path="*"
                element={
                    <Navigate
                        to="/dashboard"
                        replace
                    />
                }
            />
        </Routes>
    );
}

export default App;