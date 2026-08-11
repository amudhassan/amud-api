const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const pool = require("./config/db");

const authRoutes = require(
    "./routes/authRoutes"
);

const userRoutes = require(
    "./routes/userRoutes"
);

const ownerRoutes = require(
    "./routes/ownerRoutes"
);

const propertyRoutes = require(
    "./routes/propertyRoutes"
);

const unitRoutes = require(
    "./routes/unitRoutes"
);

const tenantRoutes = require(
    "./routes/tenantRoutes"
);

const leaseRoutes = require(
    "./routes/leaseRoutes"
);

const leaseClauseTemplateRoutes = require(
    "./routes/leaseClauseTemplateRoutes"
);

const invoiceRoutes = require(
    "./routes/invoiceRoutes"
);

const paymentRoutes = require(
    "./routes/paymentRoutes"
);

const receiptRoutes = require(
    "./routes/receiptRoutes"
);

const errorHandler = require(
    "./middleware/errorHandler"
);

const swaggerUi = require(
    "swagger-ui-express"
);

const swaggerSpec = require(
    "./config/swagger"
);

const maintenanceRoutes = require(
    "./routes/maintenanceRoutes"
);

const notificationRoutes = require(
    "./routes/notificationRoutes"
);

const reportRoutes = require(
    "./routes/reportRoutes"
);

dotenv.config();

const app = express();
const allowedOrigins = [
    "http://localhost:5173",
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins,
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);
app.use(express.json());

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);

/*
 * API routes
 */
app.use(
    "/api/owners",
    ownerRoutes
);

app.use(
    "/api/properties",
    propertyRoutes
);

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/users",
    userRoutes
);

app.use(
    "/api/units",
    unitRoutes
);

app.use(
    "/api/tenants",
    tenantRoutes
);

app.use(
    "/api/leases",
    leaseRoutes
);

app.use(
    "/api/lease-clause-templates",
    leaseClauseTemplateRoutes
);

app.use(
    "/api/invoices",
    invoiceRoutes
);

app.use(
    "/api/payments",
    paymentRoutes
);

app.use(
    "/api/receipts",
    receiptRoutes
);

app.use(
    "/api/maintenance",
    maintenanceRoutes
);
app.use(
    "/api/notifications",
    notificationRoutes
);
app.use(
    "/api/reports",
    reportRoutes
);
/*
 * Swagger documentation
 */
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

/*
 * Server health test
 */
app.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Server is working"
    });
});

/*
 * Database connection test
 */
app.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT NOW()"
        );

        res.status(200).json({
            message:
                "API yetu inafanya kazi!",

            database:
                "Connected",

            server_time:
                result.rows[0].now
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message:
                "Database connection failed"
        });
    }
});

/*
 * Global error handler must remain last.
 */
app.use(errorHandler);

const PORT =
    process.env.PORT || 3000;

module.exports = app;
