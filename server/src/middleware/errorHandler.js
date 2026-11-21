const mongoose = require("mongoose");
const { AppError } = require("../utils/validation");

function notFound(req, res, next) {
    next(new AppError(404, "The requested API route was not found."));
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        next(error);
        return;
    }

    let status = error.statusCode || error.status || 500;
    let message = error.message || "An unexpected server error occurred.";

    if (error.type === "entity.parse.failed") {
        status = 400;
        message = "Request body must contain valid JSON.";
    } else if (error.type === "entity.too.large") {
        status = 413;
        message = "Request body is too large.";
    } else if (error instanceof mongoose.Error.ValidationError) {
        status = 400;
        message = Object.values(error.errors)
            .map((item) => item.message)
            .join(" ");
    } else if (error instanceof mongoose.Error.CastError) {
        status = 400;
        message = "A submitted ID or value is not valid.";
    } else if (error.code === 11000) {
        status = 409;
        message = "A record with the same unique value already exists.";
    }

    if (status >= 500) {
        console.error("Request failed:", error);
        message = "An unexpected server error occurred.";
    }

    res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
