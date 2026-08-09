const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const checks = [
    {
        file: path.join(root, "services", "ownerService.js"),
        required: [
            "const getDeletedOwners = async",
            "getDeletedOwners,"
        ]
    },
    {
        file: path.join(root, "controllers", "ownerController.js"),
        required: [
            "getDeletedOwners",
            "const getDeletedOwnersController = asyncHandler",
            "getDeletedOwnersController,"
        ]
    },
    {
        file: path.join(root, "routes", "ownerRoutes.js"),
        required: [
            '"/deleted"',
            "getOwnersValidator",
            "getDeletedOwnersController"
        ]
    }
];

for (const check of checks) {
    if (!fs.existsSync(check.file)) {
        throw new Error(
            `Missing file: ${check.file}`
        );
    }

    const content = fs.readFileSync(
        check.file,
        "utf8"
    );

    for (const marker of check.required) {
        if (!content.includes(marker)) {
            throw new Error(
                `Missing marker in ${check.file}: ${marker}`
            );
        }
    }

    const syntax = spawnSync(
        process.execPath,
        ["--check", check.file],
        {
            encoding: "utf8"
        }
    );

    if (syntax.status !== 0) {
        throw new Error(
            syntax.stderr ||
            syntax.stdout ||
            `Syntax check failed: ${check.file}`
        );
    }
}

console.log(
    "Owners deleted-list backend support check passed."
);
