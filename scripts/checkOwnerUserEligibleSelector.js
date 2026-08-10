const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = process.cwd();
const servicePath = path.join(root, "services", "ownerUserService.js");
const controllerPath = path.join(root, "controllers", "ownerUserController.js");
const routesPath = path.join(root, "routes", "ownerRoutes.js");

for (const filePath of [servicePath, controllerPath, routesPath]) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Required file not found: ${filePath}`);
    }
}

const service = fs.readFileSync(servicePath, "utf8");
const controller = fs.readFileSync(controllerPath, "utf8");
const routes = fs.readFileSync(routesPath, "utf8");

const checks = [
    [service.includes("const getEligibleOwnerUsers = async"), "service function"],
    [service.includes("u.deleted_at IS NULL"), "deleted-user exclusion"],
    [service.includes("u.is_verified = TRUE"), "verified-user filter"],
    [service.includes("existing_link.revoked_at IS NULL"), "active-link exclusion"],
    [service.includes("requester_link.is_primary = TRUE"), "primary requester authorization"],
    [service.includes("getEligibleOwnerUsers"), "service export"],
    [controller.includes("const getEligibleOwnerUsersController"), "controller function"],
    [controller.includes("Eligible owner users retrieved successfully."), "controller response"],
    [routes.includes("/:owner_public_id/users/eligible"), "eligible route"],
    [routes.includes("getEligibleOwnerUsersController"), "route controller wiring"]
];

for (const [passed, label] of checks) {
    if (!passed) {
        throw new Error(`Owner-user eligible selector check failed: ${label}`);
    }
}

for (const filePath of [servicePath, controllerPath, routesPath]) {
    execFileSync(process.execPath, ["--check", filePath], {
        stdio: "pipe"
    });
}

console.log("Owner-user eligible selector backend support check passed.");
