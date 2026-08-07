const express = require("express");

const router = express.Router();

const {
    authMiddleware
} = require(
    "../middleware/authMiddleware"
);

const validateRequest = require(
    "../middleware/validateRequest"
);

const {
    reportContextValidator
} = require(
    "../validators/reports/reportContextValidator"
);

const {
    financialSummaryValidator,
    financialRevenueValidator,
    financialOutstandingValidator,
    financialCollectionsValidator
} = require(
    "../validators/reports/financialReportValidator"
);

const {
    occupancyReportValidator,
    leaseReportValidator,
    expiringLeaseReportValidator
} = require(
    "../validators/reports/occupancyLeaseReportValidator"
);

const {
    maintenanceSummaryValidator,
    maintenancePerformanceValidator,
    maintenanceCostsValidator
} = require(
    "../validators/reports/maintenanceReportValidator"
);

const {
    dashboardValidator
} = require(
    "../validators/reports/dashboardValidator"
);

const {
    buildReportExportValidator
} = require(
    "../validators/reports/reportExportValidator"
);

const {
    getReportContextController
} = require(
    "../controllers/reports/reportContextController"
);

const {
    getFinancialSummaryController,
    getRevenueReportController,
    getOutstandingReportController,
    getCollectionsReportController
} = require(
    "../controllers/reports/financialReportController"
);

const {
    getOccupancyReportController,
    getLeaseReportController,
    getExpiringLeasesReportController
} = require(
    "../controllers/reports/occupancyLeaseReportController"
);

const {
    getMaintenanceSummaryController,
    getMaintenancePerformanceController,
    getMaintenanceCostsController
} = require(
    "../controllers/reports/maintenanceReportController"
);

const {
    getDashboardController
} = require(
    "../controllers/reports/dashboardController"
);

const {
    createReportExportController
} = require(
    "../controllers/reports/reportExportController"
);

router.get(
    "/context",
    authMiddleware,
    reportContextValidator,
    validateRequest,
    getReportContextController
);

router.get(
    "/financial/summary",
    authMiddleware,
    financialSummaryValidator,
    validateRequest,
    getFinancialSummaryController
);

router.get(
    "/financial/revenue",
    authMiddleware,
    financialRevenueValidator,
    validateRequest,
    getRevenueReportController
);

router.get(
    "/financial/outstanding",
    authMiddleware,
    financialOutstandingValidator,
    validateRequest,
    getOutstandingReportController
);

router.get(
    "/financial/collections",
    authMiddleware,
    financialCollectionsValidator,
    validateRequest,
    getCollectionsReportController
);

router.get(
    "/occupancy",
    authMiddleware,
    occupancyReportValidator,
    validateRequest,
    getOccupancyReportController
);

router.get(
    "/leases",
    authMiddleware,
    leaseReportValidator,
    validateRequest,
    getLeaseReportController
);

router.get(
    "/leases/expiring",
    authMiddleware,
    expiringLeaseReportValidator,
    validateRequest,
    getExpiringLeasesReportController
);

router.get(
    "/maintenance/summary",
    authMiddleware,
    maintenanceSummaryValidator,
    validateRequest,
    getMaintenanceSummaryController
);

router.get(
    "/maintenance/performance",
    authMiddleware,
    maintenancePerformanceValidator,
    validateRequest,
    getMaintenancePerformanceController
);

router.get(
    "/maintenance/costs",
    authMiddleware,
    maintenanceCostsValidator,
    validateRequest,
    getMaintenanceCostsController
);

router.get(
    "/dashboard",
    authMiddleware,
    dashboardValidator,
    validateRequest,
    getDashboardController
);

/*
 * Batch F export aliases.
 * Every export reuses the same report service and therefore
 * the same authorization scope as the JSON endpoint.
 */
const exportRoutes = [
    {
        path: "/financial/summary/export",
        reportType: "financial_summary",
        validator:
            buildReportExportValidator()
    },
    {
        path: "/financial/revenue/export",
        reportType: "financial_revenue",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "period"
                ]
            })
    },
    {
        path: "/financial/outstanding/export",
        reportType:
            "financial_outstanding",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "limit"
                ]
            })
    },
    {
        path: "/financial/collections/export",
        reportType:
            "financial_collections",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "period"
                ]
            })
    },
    {
        path: "/occupancy/export",
        reportType: "occupancy",
        validator:
            buildReportExportValidator()
    },
    {
        path: "/leases/export",
        reportType: "leases",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "lease_status",
                    "limit"
                ]
            })
    },
    {
        path: "/leases/expiring/export",
        reportType:
            "expiring_leases",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "days",
                    "limit"
                ]
            })
    },
    {
        path: "/maintenance/summary/export",
        reportType:
            "maintenance_summary",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "maintenance_status",
                    "priority",
                    "category"
                ]
            })
    },
    {
        path: "/maintenance/performance/export",
        reportType:
            "maintenance_performance",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "maintenance_status",
                    "priority",
                    "category",
                    "limit"
                ]
            })
    },
    {
        path: "/maintenance/costs/export",
        reportType:
            "maintenance_costs",
        validator:
            buildReportExportValidator({
                allowedExtraFields: [
                    "maintenance_status",
                    "priority",
                    "category"
                ]
            })
    },
    {
        path: "/dashboard/export",
        reportType: "dashboard",
        validator:
            buildReportExportValidator()
    }
];

for (const exportRoute of exportRoutes) {
    router.get(
        exportRoute.path,
        authMiddleware,
        exportRoute.validator,
        validateRequest,
        createReportExportController(
            exportRoute.reportType
        )
    );
}

module.exports = router;
