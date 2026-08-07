require("dotenv").config();

const assert = require("assert");

const reportRoutes = require(
    "../routes/reportRoutes"
);

const {
    PERIOD_SQL,
    resolveFinancialScope,
    getFinancialSummary,
    getRevenueReport,
    getOutstandingReport,
    getCollectionsReport
} = require(
    "../services/reports/financialReportService"
);

const {
    financialSummaryValidator,
    financialRevenueValidator,
    financialOutstandingValidator,
    financialCollectionsValidator
} = require(
    "../validators/reports/financialReportValidator"
);

assert(reportRoutes);
assert.strictEqual(
    typeof resolveFinancialScope,
    "function"
);
assert.strictEqual(
    typeof getFinancialSummary,
    "function"
);
assert.strictEqual(
    typeof getRevenueReport,
    "function"
);
assert.strictEqual(
    typeof getOutstandingReport,
    "function"
);
assert.strictEqual(
    typeof getCollectionsReport,
    "function"
);
assert.strictEqual(
    PERIOD_SQL.monthly,
    "month"
);

assert(Array.isArray(financialSummaryValidator));
assert(Array.isArray(financialRevenueValidator));
assert(Array.isArray(financialOutstandingValidator));
assert(Array.isArray(financialCollectionsValidator));

const expectedRoutes = [
    "/context",
    "/financial/summary",
    "/financial/revenue",
    "/financial/outstanding",
    "/financial/collections"
];

const routeStack =
    Array.isArray(reportRoutes.stack)
        ? reportRoutes.stack
        : [];

for (const path of expectedRoutes) {
    const found = routeStack.some(
        layer =>
            layer.route &&
            layer.route.path === path &&
            layer.route.methods &&
            layer.route.methods.get === true
    );

    assert.strictEqual(
        found,
        true,
        `GET ${path} route is missing.`
    );
}

console.log(
    "Reports Batch B import and route check passed."
);
