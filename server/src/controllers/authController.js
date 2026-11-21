const crypto = require("crypto");
const { promisify } = require("util");
const User = require("../models/User");
const { AppError, assertObject, readString } = require("../utils/validation");
const {
    createSessionToken,
    setSessionCookie,
    clearSessionCookie,
} = require("../utils/session");

const scrypt = promisify(crypto.scrypt);

function publicUser(user) {
    return {
        id: String(user._id),
        username: user.username,
        email: user.email,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
    };
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    return `scrypt$${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
    const [algorithm, salt, hashHex] = storedHash.split("$");
    if (algorithm !== "scrypt" || !salt || !/^[a-f0-9]{128}$/i.test(hashHex)) {
        return false;
    }

    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

function issueSession(user, res) {
    setSessionCookie(res, createSessionToken(user));
    return publicUser(user);
}

async function register(req, res) {
    assertObject(req.body);
    const username = readString(req.body.username, "Username", {
        min: 3,
        max: 24,
    }).toLowerCase();
    const email = readString(req.body.email, "Email", {
        min: 6,
        max: 254,
    }).toLowerCase();
    const password = readString(req.body.password, "Password", {
        min: 10,
        max: 128,
        trim: false,
    });

    if (!/^[a-z0-9_]+$/.test(username)) {
        throw new AppError(400, "Username may contain letters, numbers, and underscores.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError(400, "Enter a valid email address.");
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ username, email, passwordHash });
    res.status(201).json({ user: issueSession(user, res) });
}

async function login(req, res) {
    assertObject(req.body);
    const email = readString(req.body.email, "Email", {
        min: 6,
        max: 254,
    }).toLowerCase();
    const password = readString(req.body.password, "Password", {
        min: 1,
        max: 128,
        trim: false,
    });
    const user = await User.findOne({ email }).select(
        "+passwordHash +tokenVersion"
    );

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throw new AppError(401, "Email or password is incorrect.");
    }

    res.json({ user: issueSession(user, res) });
}

async function me(req, res) {
    res.json({ user: req.user ? publicUser(req.user) : null });
}

async function logout(req, res) {
    req.user.tokenVersion += 1;
    await req.user.save();
    clearSessionCookie(res);
    res.json({ message: "You have been logged out." });
}

module.exports = { register, login, me, logout };
