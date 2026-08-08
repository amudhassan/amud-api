import {
    Navigate,
    Route,
    Routes
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import OwnersPage from "./pages/owners/OwnersPage";
import PropertiesPage from "./pages/properties/PropertiesPage";
import PropertyDetailPage from "./pages/properties/PropertyDetailPage";
import UnitsPage from "./pages/units/UnitsPage";
import TenantsPage from "./pages/tenants/TenantsPage";
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
                        path="tenants"
                        element={<TenantsPage />}
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