require("dotenv").config();

const assert = require("assert");

const reportRoutes = require(
    "../routes/reportRoutes"
);

const {
    REPORT_PERMISSION_MODES,
    buildPermissionCondition,
    resolveReportScope
} = require(
    "../services/reports/reportAccessService"
);

const {
    getReportContext
} = require(
    "../services/reports/reportContextService"
);

const {
    reportContextValidator
} = require(
    "../validators/reports/reportContextValidator"
);

assert(reportRoutes);
assert(Array.isArray(reportContextValidator));
assert.strictEqual(
    typeof buildPermissionCondition,
    "function"
);
assert.strictEqual(
    typeof resolveReportScope,
    "function"
);
assert.strictEqual(
    typeof getReportContext,
    "function"
);
assert.strictEqual(
    REPORT_PERMISSION_MODES.FINANCIAL,
    "financial"
);
assert.strictEqual(
    REPORT_PERMISSION_MODES.PROPERTY,
    "property"
);

const routeStack =
    Array.isArray(reportRoutes.stack)
        ? reportRoutes.stack
        : [];

const hasContextRoute =
    routeStack.some(layer =>
        layer.route &&
        layer.route.path === "/context" &&
        layer.route.methods &&
        layer.route.methods.get === true
    );

assert.strictEqual(
    hasContextRoute,
    true,
    "GET /context route is missing."
);

console.log(
    "Reports Batch A import and route check passed."
);
