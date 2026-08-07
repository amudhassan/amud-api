const assert = require("assert");

const {
    REPORT_LOADERS
} = require(
    "../services/reports/reportExportService"
);

assert(
    Object.keys(
        REPORT_LOADERS
    ).length >= 11,
    "Expected all report loaders."
);

require(
    "../validators/reports/reportExportValidator"
);

require(
    "../controllers/reports/reportExportController"
);

const router = require(
    "../routes/reportRoutes"
);

const routePaths = router.stack
    .filter(layer => layer.route)
    .map(layer => layer.route.path);

for (const path of [
    "/financial/revenue/export",
    "/financial/outstanding/export",
    "/occupancy/export",
    "/leases/expiring/export",
    "/maintenance/summary/export",
    "/dashboard/export"
]) {
    assert(
        routePaths.includes(path),
        `Missing export route ${path}`
    );
}

console.log(
    "Reports Batch F import and route check passed."
);
