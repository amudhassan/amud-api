const assert = require("assert");

require(
    "../validators/reports/dashboardValidator"
);

require(
    "../services/reports/dashboardService"
);

require(
    "../controllers/reports/dashboardController"
);

const router = require(
    "../routes/reportRoutes"
);

const hasDashboard = router.stack
    .filter(layer => layer.route)
    .some(
        layer =>
            layer.route.path ===
                "/dashboard" &&
            layer.route.methods.get ===
                true
    );

assert(
    hasDashboard,
    "Missing GET /dashboard"
);

console.log(
    "Reports Batch E import and route check passed."
);
