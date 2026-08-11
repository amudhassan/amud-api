const assert = require("assert");

const validators = require(
    "../validators/leaseClauseTemplateValidator"
);

const service = require(
    "../services/leaseClauseTemplateService"
);

const controllers = require(
    "../controllers/leaseClauseTemplateController"
);

const templateRoutes = require(
    "../routes/leaseClauseTemplateRoutes"
);

const leaseRoutes = require(
    "../routes/leaseRoutes"
);

const expectedValidators = [
    "getLeaseClauseTemplatesValidator",
    "createLeaseClauseTemplateValidator",
    "getSingleLeaseClauseTemplateValidator",
    "updateLeaseClauseTemplateValidator",
    "deleteLeaseClauseTemplateValidator",
    "createLeaseClauseTemplateItemValidator",
    "updateLeaseClauseTemplateItemValidator",
    "deleteLeaseClauseTemplateItemValidator",
    "applyLeaseClauseTemplateValidator"
];

const expectedServices = [
    "getLeaseClauseTemplates",
    "createLeaseClauseTemplate",
    "getSingleLeaseClauseTemplate",
    "updateLeaseClauseTemplate",
    "deleteLeaseClauseTemplate",
    "createLeaseClauseTemplateItem",
    "updateLeaseClauseTemplateItem",
    "deleteLeaseClauseTemplateItem",
    "applyLeaseClauseTemplate"
];

const expectedControllers = [
    "getLeaseClauseTemplatesController",
    "createLeaseClauseTemplateController",
    "getSingleLeaseClauseTemplateController",
    "updateLeaseClauseTemplateController",
    "deleteLeaseClauseTemplateController",
    "createLeaseClauseTemplateItemController",
    "updateLeaseClauseTemplateItemController",
    "deleteLeaseClauseTemplateItemController",
    "applyLeaseClauseTemplateController"
];

for (
    const name of expectedValidators
) {
    assert(
        Array.isArray(
            validators[name]
        ),
        `Missing validator: ${name}`
    );
}

for (
    const name of expectedServices
) {
    assert.strictEqual(
        typeof service[name],
        "function",
        `Missing service: ${name}`
    );
}

for (
    const name of expectedControllers
) {
    assert.strictEqual(
        typeof controllers[name],
        "function",
        `Missing controller: ${name}`
    );
}

assert(
    templateRoutes &&
        typeof templateRoutes ===
            "function",
    "Template routes did not load."
);

assert(
    leaseRoutes &&
        typeof leaseRoutes ===
            "function",
    "Lease routes did not load."
);

console.log(
    "Lease Clause Template Phase 11B import and route check passed."
);
