const assert = require("assert");

require(
    "../validators/reports/occupancyLeaseReportValidator"
);

require(
    "../services/reports/occupancyLeaseReportService"
);

require(
    "../controllers/reports/occupancyLeaseReportController"
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
    "/occupancy",
    "/leases",
    "/leases/expiring"
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
    "Reports Batch C import and route check passed."
);
