const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const errorHandler = require("./middleware/errorHandler");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

dotenv.config();



const app = express();

app.use(express.json());
app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);
app.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Server is working"
    });
});

app.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.status(200).json({
            message: "API yetu inafanya kazi!",
            database: "Connected",
            server_time: result.rows[0].now
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});
app.use(errorHandler);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
module.exports = app;