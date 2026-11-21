const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 3,
            maxlength: 24,
            match: /^[a-z0-9_]+$/,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
            match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 160,
            default: "",
        },
        profileImageUrl: {
            type: String,
            trim: true,
            maxlength: 2048,
            default: "",
            validate: {
                validator(value) {
                    if (!value) return true;

                    try {
                        return new URL(value).protocol === "https:";
                    } catch {
                        return false;
                    }
                },
                message: "Profile image URL must be a valid HTTPS URL.",
            },
        },
        tokenVersion: {
            type: Number,
            default: 0,
            select: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
