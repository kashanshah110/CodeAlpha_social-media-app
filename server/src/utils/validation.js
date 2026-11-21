const mongoose = require("mongoose");

class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

function assertObject(value, label = "Request body") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new AppError(400, `${label} must be a JSON object.`);
    }
}

function readString(value, field, options = {}) {
    const {
        min = 0,
        max = 1000,
        required = true,
        trim = true,
    } = options;

    if (value === undefined && !required) return undefined;
    if (typeof value !== "string") {
        throw new AppError(400, `${field} must be text.`);
    }

    const result = trim ? value.trim() : value;
    if (result.length < min || result.length > max) {
        throw new AppError(
            400,
            `${field} must be between ${min} and ${max} characters.`
        );
    }
    return result;
}

function readObjectId(value, field) {
    if (
        typeof value !== "string" ||
        !mongoose.isObjectIdOrHexString(value)
    ) {
        throw new AppError(400, `${field} is not valid.`);
    }
    return value;
}

function readLimit(value, defaultValue = 50, maximum = 100) {
    if (value === undefined) return defaultValue;
    if (!/^\d+$/.test(value)) {
        throw new AppError(400, "Limit must be a positive whole number.");
    }

    const limit = Number(value);
    if (limit < 1 || limit > maximum) {
        throw new AppError(400, `Limit must be between 1 and ${maximum}.`);
    }
    return limit;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
    AppError,
    assertObject,
    readString,
    readObjectId,
    readLimit,
    escapeRegExp,
};
