const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const { getSessionSecret } = require("./utils/session");
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const userRoutes = require("./routes/userRoutes");
const commentRoutes = require("./routes/commentRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = Number(process.env.PORT || 5000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be a whole number between 1 and 65535.");
}
const clientPath = path.resolve(__dirname, "../../client");

app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
    next();
});
app.use(express.json({ limit: "20kb" }));
app.use(express.static(clientPath));

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Social app API is running",
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api", notFound);
app.use(errorHandler);

async function startServer() {
    try {
        getSessionSecret();
        await connectDB();

        return app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        throw error;
    }
}

if (require.main === module) {
    startServer().catch(() => process.exit(1));
}

module.exports = { app, startServer };