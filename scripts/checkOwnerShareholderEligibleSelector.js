const fs = require("fs");
const path = require("path");

const root = process.cwd();

const read = relativePath =>
    fs.readFileSync(
        path.join(root, relativePath),
        "utf8"
    );

const service = read(
    "services/ownerShareholderService.js"
);
const controller = read(
    "controllers/ownerShareholderController.js"
);
const validator = read(
    "validators/ownerShareholderValidator.js"
);
const routes = read(
    "routes/ownerRoutes.js"
);

const requiredChecks = [
    [
        service,
        "const getEligibleOwnerShareholders = async ({",
        "eligible shareholder service"
    ],
    [
        service,
        "active_shareholder_types",
        "active shareholder type metadata"
    ],
    [
        service,
        "getEligibleOwnerShareholders,",
        "eligible service export"
    ],
    [
        controller,
        "const getEligibleOwnerShareholdersController =",
        "eligible shareholder controller"
    ],
    [
        controller,
        "Eligible shareholder owners retrieved successfully.",
        "eligible controller response"
    ],
    [
        validator,
        "const getEligibleOwnerShareholdersValidator = [",
        "eligible selector validator"
    ],
    [
        routes,
        "\"/:company_public_id/shareholders/eligible\"",
        "eligible selector route"
    ],
    [
        routes,
        "getEligibleOwnerShareholdersController",
        "eligible controller route wiring"
    ]
];

const missing = requiredChecks.filter(
    ([text, needle]) => !text.includes(needle)
);

if (missing.length > 0) {
    for (const [, , label] of missing) {
        console.error(`Missing: ${label}`);
    }

    process.exit(1);
}

const eligibleRouteIndex = routes.indexOf(
    '"/:company_public_id/shareholders/eligible"'
);
const listRouteIndex = routes.indexOf(
    '"/:company_public_id/shareholders"'
);

if (
    eligibleRouteIndex === -1 ||
    listRouteIndex === -1 ||
    eligibleRouteIndex > listRouteIndex
) {
    console.error(
        "Eligible shareholder route must remain before the generic shareholder list route."
    );
    process.exit(1);
}

console.log(
    "Owner Shareholder eligible selector import and route check passed."
);
