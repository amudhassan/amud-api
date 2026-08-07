const assert = require("assert");

const {
    REPORT_PERMISSION_MODES
} = require(
    "../services/reports/reportAccessService"
);

assert.strictEqual(
    REPORT_PERMISSION_MODES.MAINTENANCE,
    "maintenance"
);

require(
    "../validators/reports/maintenanceReportValidator"
);

require(
    "../services/reports/maintenanceReportService"
);

require(
    "../controllers/reports/maintenanceReportController"
);

const router = require(
    "../routes/reportRoutes"
);

const routes = router.stack
    .filter(layer => layer.route)
    .map(layer => ({
        path: layer.route.path,
        methods: Object.keys(
            layer.route.methods
        )
    }));

for (const path of [
    "/maintenance/summary",
    "/maintenance/performance",
    "/maintenance/costs"
]) {
    assert(
        routes.some(
            route =>
                route.path === path &&
                route.methods.includes("get")
        ),
        `Missing GET ${path}`
    );
}

console.log(
    "Reports Batch D import and route check passed."
);
