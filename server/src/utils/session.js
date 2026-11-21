const crypto = require("crypto");

const COOKIE_NAME = "socially_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function getSessionSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(
            "SESSION_SECRET must be set to a random value of at least 32 characters."
        );
    }
    return secret;
}

function sign(value) {
    return crypto
        .createHmac("sha256", getSessionSecret())
        .update(value)
        .digest("base64url");
}

function createSessionToken(user) {
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
        JSON.stringify({
            sub: String(user._id),
            ver: user.tokenVersion || 0,
            exp: now + SESSION_SECONDS,
        })
    ).toString("base64url");

    return `${payload}.${sign(payload)}`;
}

function readSessionToken(token) {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    const expected = sign(payload);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
        actualBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
        return null;
    }

    let claims;
    try {
        claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }

    if (
        !claims ||
        typeof claims.sub !== "string" ||
        !Number.isInteger(claims.ver) ||
        !Number.isInteger(claims.exp) ||
        claims.exp <= Math.floor(Date.now() / 1000)
    ) {
        return null;
    }
    return claims;
}

function getCookie(req) {
    const cookies = (req.headers.cookie || "").split(";");
    const cookie = cookies
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    return cookie ? cookie.slice(COOKIE_NAME.length + 1) : null;
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`
    );
}

function clearSessionCookie(res) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
    );
}

module.exports = {
    COOKIE_NAME,
    getSessionSecret,
    createSessionToken,
    readSessionToken,
    getCookie,
    setSessionCookie,
    clearSessionCookie,
};
