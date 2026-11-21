const User = require("../models/User");
const { AppError } = require("../utils/validation");
const { getCookie, readSessionToken } = require("../utils/session");

async function loadUser(req) {
    const token = getCookie(req);
    if (!token) return null;

    const claims = readSessionToken(token);
    if (!claims) return null;

    const user = await User.findById(claims.sub).select("+tokenVersion");
    if (!user || user.tokenVersion !== claims.ver) return null;
    return user;
}

async function requireAuth(req, res, next) {
    try {
        req.user = await loadUser(req);
        if (!req.user) {
            throw new AppError(401, "Please log in to continue.");
        }
        next();
    } catch (error) {
        next(error);
    }
}

async function optionalAuth(req, res, next) {
    try {
        req.user = await loadUser(req);
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = { requireAuth, optionalAuth };
