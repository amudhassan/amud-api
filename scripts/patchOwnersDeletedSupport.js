const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = process.cwd();

const files = {
    service: path.join(
        projectRoot,
        "services",
        "ownerService.js"
    ),
    controller: path.join(
        projectRoot,
        "controllers",
        "ownerController.js"
    ),
    routes: path.join(
        projectRoot,
        "routes",
        "ownerRoutes.js"
    )
};

for (const [label, filePath] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `${label} file not found: ${filePath}`
        );
    }
}

const originals = {
    service: fs.readFileSync(files.service, "utf8"),
    controller: fs.readFileSync(files.controller, "utf8"),
    routes: fs.readFileSync(files.routes, "utf8")
};

const lineEndings = {
    service: originals.service.includes("\r\n") ? "\r\n" : "\n",
    controller: originals.controller.includes("\r\n") ? "\r\n" : "\n",
    routes: originals.routes.includes("\r\n") ? "\r\n" : "\n"
};

const normalize = value =>
    value.replace(/\r\n/g, "\n");

const restoreLineEndings = (value, eol) =>
    eol === "\r\n"
        ? value.replace(/\n/g, "\r\n")
        : value;

let service = normalize(originals.service);
let controller = normalize(originals.controller);
let routes = normalize(originals.routes);

const deletedOwnersService = `const getDeletedOwners = async ({
    authenticatedUser,
    filters = {}
}) => {
    /*
     * Deleted owner inventory is administrative because
     * soft deletion revokes normal owner-user access links.
     */
    if (authenticatedUser.role !== "admin") {
        return {
            forbidden: true
        };
    }

    const page = Number(filters.page) || 1;
    const limit = Math.min(
        Number(filters.limit) || 20,
        100
    );
    const offset = (page - 1) * limit;

    const values = [];
    const conditions = [
        "o.deleted_at IS NOT NULL"
    ];

    if (filters.search) {
        values.push(
            \`%\${filters.search.trim()}%\`
        );

        const searchParameter =
            \`$\${values.length}\`;

        conditions.push(\`
            (
                o.display_name ILIKE \${searchParameter}
                OR COALESCE(o.email, '') ILIKE \${searchParameter}
                OR COALESCE(o.phone_number, '') ILIKE \${searchParameter}
                OR COALESCE(
                    o.registration_number,
                    ''
                ) ILIKE \${searchParameter}
                OR COALESCE(
                    o.tax_identification_number,
                    ''
                ) ILIKE \${searchParameter}
            )
        \`);
    }

    if (filters.owner_type) {
        values.push(filters.owner_type);
        conditions.push(
            \`o.owner_type = $\${values.length}\`
        );
    }

    if (filters.status) {
        values.push(filters.status);
        conditions.push(
            \`o.status = $\${values.length}\`
        );
    }

    if (filters.country) {
        values.push(filters.country.trim());
        conditions.push(
            \`LOWER(o.country) = LOWER($\${values.length})\`
        );
    }

    const whereClause =
        conditions.join(" AND ");

    const countResult = await pool.query(
        \`
        SELECT COUNT(*) AS total_records
        FROM owners AS o
        WHERE \${whereClause}
        \`,
        values
    );

    const totalRecords = Number(
        countResult.rows[0].total_records
    );

    const dataValues = [...values];

    dataValues.push(limit);
    const limitParameter =
        \`$\${dataValues.length}\`;

    dataValues.push(offset);
    const offsetParameter =
        \`$\${dataValues.length}\`;

    const ownersResult = await pool.query(
        \`
        SELECT
            o.public_id,
            o.owner_type,
            o.display_name,
            o.registration_number,
            o.tax_identification_number,
            o.email,
            o.phone_number,
            o.alternative_phone,
            o.address,
            o.city,
            o.region,
            o.country,
            o.status,
            o.created_at,
            o.updated_at,
            o.deleted_at,

            (
                SELECT COUNT(*)::INTEGER
                FROM owner_users AS ou
                WHERE ou.owner_id = o.id
                  AND ou.revoked_at IS NOT NULL
            ) AS historical_revoked_user_link_count

        FROM owners AS o
        WHERE \${whereClause}
        ORDER BY
            o.deleted_at DESC,
            o.created_at DESC
        LIMIT \${limitParameter}
        OFFSET \${offsetParameter}
        \`,
        dataValues
    );

    return {
        forbidden: false,
        owners: ownersResult.rows,
        pagination: {
            page,
            limit,
            total_records: totalRecords,
            total_pages: Math.ceil(
                totalRecords / limit
            )
        }
    };
};

`;

const deletedOwnersController = `const getDeletedOwnersController = asyncHandler(
    async (req, res, next) => {
        if (req.user.role !== "admin") {
            return next(
                new AppError(
                    "Only administrators can view deleted owners.",
                    403
                )
            );
        }

        const result = await getDeletedOwners({
            authenticatedUser: req.user,
            filters: req.query
        });

        if (result.forbidden) {
            return next(
                new AppError(
                    "Only administrators can view deleted owners.",
                    403
                )
            );
        }

        return res.status(200).json({
            success: true,
            message:
                "Deleted owners retrieved successfully.",
            count: result.owners.length,
            pagination: result.pagination,
            data: result.owners
        });
    }
);

`;

const deletedOwnersRoute = `/*
 * GET /api/owners/deleted
 *
 * Must remain before dynamic owner routes so the literal
 * word "deleted" is never treated as an owner public ID.
 */
router.get(
    "/deleted",
    authMiddleware,
    getOwnersValidator,
    validateRequest,
    getDeletedOwnersController
);

`;

function addToModuleExports(source, identifier, label) {
    if (new RegExp(
        `module\\.exports\\s*=\\s*\\{[\\s\\S]*?\\b${identifier}\\b[\\s\\S]*?\\}\\s*;`,
        "m"
    ).test(source)) {
        return source;
    }

    const pattern = /module\.exports\s*=\s*\{([\s\S]*?)\}\s*;/m;
    const match = pattern.exec(source);

    if (!match) {
        throw new Error(
            `${label} module.exports block not found. No files were changed.`
        );
    }

    let inner = match[1].trimEnd();
    const indentMatch = /\n([ \t]+)[A-Za-z_$][\w$]*\s*,?\s*$/.exec(inner);
    const indent = indentMatch ? indentMatch[1] : "    ";

    if (inner.trim().length > 0) {
        inner = inner.replace(/\s*$/, "");
        if (!inner.trimEnd().endsWith(",")) {
            inner += ",";
        }
    }

    inner += `\n${indent}${identifier},\n`;

    return source.slice(0, match.index) +
        match[0].replace(match[1], inner) +
        source.slice(match.index + match[0].length);
}

function addToNamedRequire({
    source,
    requirePath,
    identifier,
    label
}) {
    const escapedPath = requirePath
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const pattern = new RegExp(
        `const\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*require\\(\\s*["']${escapedPath}["']\\s*\\)\\s*;`,
        "m"
    );

    const match = pattern.exec(source);

    if (!match) {
        throw new Error(
            `${label} require block not found. No files were changed.`
        );
    }

    if (new RegExp(`\\b${identifier}\\b`).test(match[1])) {
        return source;
    }

    let inner = match[1].trimEnd();
    const indentMatch = /\n([ \t]+)[A-Za-z_$][\w$]*\s*,?\s*$/.exec(inner);
    const indent = indentMatch ? indentMatch[1] : "    ";

    if (inner.trim().length > 0) {
        inner = inner.replace(/\s*$/, "");
        if (!inner.trimEnd().endsWith(",")) {
            inner += ",";
        }
    }

    inner += `\n${indent}${identifier},\n`;

    return source.slice(0, match.index) +
        match[0].replace(match[1], inner) +
        source.slice(match.index + match[0].length);
}

if (!service.includes("const getDeletedOwners = async")) {
    const serviceMarker =
        "const getOwnerByPublicId = async ({";

    const markerIndex = service.indexOf(serviceMarker);

    if (markerIndex === -1) {
        throw new Error(
            "ownerService.js getOwnerByPublicId marker not found. No files were changed."
        );
    }

    service =
        service.slice(0, markerIndex) +
        deletedOwnersService +
        service.slice(markerIndex);
}

service = addToModuleExports(
    service,
    "getDeletedOwners",
    "ownerService.js"
);

controller = addToNamedRequire({
    source: controller,
    requirePath: "../services/ownerService",
    identifier: "getDeletedOwners",
    label: "ownerController.js ownerService"
});

if (!controller.includes(
    "const getDeletedOwnersController = asyncHandler"
)) {
    const controllerMarker =
        "const getSingleOwnerController = asyncHandler(";

    const markerIndex = controller.indexOf(
        controllerMarker
    );

    if (markerIndex === -1) {
        throw new Error(
            "ownerController.js getSingleOwnerController marker not found. No files were changed."
        );
    }

    controller =
        controller.slice(0, markerIndex) +
        deletedOwnersController +
        controller.slice(markerIndex);
}

controller = addToModuleExports(
    controller,
    "getDeletedOwnersController",
    "ownerController.js"
);

routes = addToNamedRequire({
    source: routes,
    requirePath: "../controllers/ownerController",
    identifier: "getDeletedOwnersController",
    label: "ownerRoutes.js ownerController"
});

if (!/router\.get\(\s*["']\/deleted["']/.test(routes)) {
    if (!/\bgetOwnersValidator\b/.test(routes)) {
        throw new Error(
            "ownerRoutes.js does not use getOwnersValidator. No files were changed."
        );
    }

    const dynamicRoutePattern =
        /router\.(?:get|post|patch|put|delete)\(\s*["']\/:/m;

    const dynamicMatch =
        dynamicRoutePattern.exec(routes);

    if (!dynamicMatch) {
        throw new Error(
            "ownerRoutes.js dynamic owner route marker not found. No files were changed."
        );
    }

    routes =
        routes.slice(0, dynamicMatch.index) +
        deletedOwnersRoute +
        routes.slice(dynamicMatch.index);
}

const normalizedOriginals = {
    service: normalize(originals.service),
    controller: normalize(originals.controller),
    routes: normalize(originals.routes)
};

const updated = {
    service,
    controller,
    routes
};

const changed = Object.keys(updated).filter(
    key => updated[key] !== normalizedOriginals[key]
);

if (changed.length === 0) {
    console.log(
        "Owners deleted-list backend support is already installed."
    );
    process.exit(0);
}

try {
    fs.writeFileSync(
        files.service,
        restoreLineEndings(
            service,
            lineEndings.service
        )
    );
    fs.writeFileSync(
        files.controller,
        restoreLineEndings(
            controller,
            lineEndings.controller
        )
    );
    fs.writeFileSync(
        files.routes,
        restoreLineEndings(
            routes,
            lineEndings.routes
        )
    );

    for (const filePath of Object.values(files)) {
        const check = spawnSync(
            process.execPath,
            ["--check", filePath],
            {
                encoding: "utf8"
            }
        );

        if (check.status !== 0) {
            throw new Error(
                check.stderr ||
                check.stdout ||
                `Syntax check failed: ${filePath}`
            );
        }
    }

    console.log(
        "Owners deleted-list backend support installed successfully."
    );
    console.log(
        "Syntax checks passed for ownerService.js, ownerController.js and ownerRoutes.js."
    );
} catch (error) {
    fs.writeFileSync(
        files.service,
        originals.service
    );
    fs.writeFileSync(
        files.controller,
        originals.controller
    );
    fs.writeFileSync(
        files.routes,
        originals.routes
    );

    console.error(
        "Patch failed. Original files were restored."
    );
    throw error;
}
