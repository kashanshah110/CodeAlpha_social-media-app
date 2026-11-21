const User = require("../models/User");
const Follow = require("../models/Follow");
const Post = require("../models/Post");
const { addPostStats } = require("./postController");
const {
    AppError,
    assertObject,
    readString,
    readObjectId,
    readLimit,
    escapeRegExp,
} = require("../utils/validation");

function publicProfile(user) {
    return {
        id: String(user._id),
        username: user.username,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        createdAt: user.createdAt,
    };
}

async function updateMe(req, res) {
    assertObject(req.body);
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "username")) {
        const username = readString(req.body.username, "Username", {
            min: 3,
            max: 24,
        }).toLowerCase();
        if (!/^[a-z0-9_]+$/.test(username)) {
            throw new AppError(400, "Username may contain letters, numbers, and underscores.");
        }
        updates.username = username;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "bio")) {
        updates.bio = readString(req.body.bio, "Bio", {
            min: 0,
            max: 160,
        });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "profileImageUrl")) {
        updates.profileImageUrl = readString(
            req.body.profileImageUrl,
            "Profile image URL",
            { min: 0, max: 2048 }
        );
    }
    if (Object.keys(updates).length === 0) {
        throw new AppError(400, "Provide a username, bio, or profile image URL to update.");
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
    });
    res.json({ user: publicProfile(user) });
}

async function searchUsers(req, res) {
    const search = readString(req.query.search, "Search", {
        min: 1,
        max: 32,
    });
    const limit = readLimit(req.query.limit, 10, 25);
    const users = await User.find({
        username: { $regex: escapeRegExp(search.toLowerCase()) },
        _id: { $ne: req.user ? req.user._id : null },
    })
        .select("username bio profileImageUrl")
        .sort({ username: 1 })
        .limit(limit);
    res.json({ users: users.map(publicProfile) });
}

async function getProfile(req, res) {
    const username = readString(req.params.username, "Username", {
        min: 3,
        max: 24,
    }).toLowerCase();
    const user = await User.findOne({ username });
    if (!user) throw new AppError(404, "User not found.");

    const [followerCount, followingCount, posts, isFollowing] =
        await Promise.all([
            Follow.countDocuments({ following: user._id }),
            Follow.countDocuments({ follower: user._id }),
            Post.find({ author: user._id })
                .sort({ createdAt: -1 })
                .limit(50)
                .populate("author", "username profileImageUrl"),
            req.user && !req.user._id.equals(user._id)
                ? Follow.exists({ follower: req.user._id, following: user._id })
                : null,
        ]);
    res.json({
        user: publicProfile(user),
        posts: await addPostStats(posts, req.user),
        followerCount,
        followingCount,
        isFollowing: Boolean(isFollowing),
        isMe: Boolean(req.user && req.user._id.equals(user._id)),
    });
}

async function listConnections(req, res, direction) {
    const username = readString(req.params.username, "Username", {
        min: 3,
        max: 24,
    }).toLowerCase();
    const limit = readLimit(req.query.limit, 50, 100);
    const user = await User.findOne({ username }).select("_id");
    if (!user) throw new AppError(404, "User not found.");

    const field = direction === "followers" ? "following" : "follower";
    const reference = direction === "followers" ? "follower" : "following";
    const links = await Follow.find({ [field]: user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate(reference, "username bio profileImageUrl");
    res.json({
        users: links.map((link) => publicProfile(link[reference])),
    });
}

async function getFollowers(req, res) {
    await listConnections(req, res, "followers");
}

async function getFollowing(req, res) {
    await listConnections(req, res, "following");
}

async function followUser(req, res) {
    const userId = readObjectId(req.params.userId, "User ID");
    if (req.user._id.equals(userId)) {
        throw new AppError(400, "You cannot follow yourself.");
    }
    if (!(await User.exists({ _id: userId }))) {
        throw new AppError(404, "User not found.");
    }

    try {
        await Follow.updateOne(
            { follower: req.user._id, following: userId },
            { $setOnInsert: { follower: req.user._id, following: userId } },
            { upsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) throw error;
    }
    const followerCount = await Follow.countDocuments({ following: userId });
    res.json({ following: true, followerCount });
}

async function unfollowUser(req, res) {
    const userId = readObjectId(req.params.userId, "User ID");
    if (req.user._id.equals(userId)) {
        throw new AppError(400, "You cannot unfollow yourself.");
    }
    if (!(await User.exists({ _id: userId }))) {
        throw new AppError(404, "User not found.");
    }

    await Follow.deleteOne({ follower: req.user._id, following: userId });
    const followerCount = await Follow.countDocuments({ following: userId });
    res.json({ following: false, followerCount });
}

module.exports = {
    updateMe,
    searchUsers,
    getProfile,
    getFollowers,
    getFollowing,
    followUser,
    unfollowUser,
};
