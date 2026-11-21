const mongoose = require("mongoose");

async function connectDB() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error(
            "MONGODB_URI is missing. Check that server/.env exists and contains MONGODB_URI."
        );
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected");
}

module.exports = connectDB;