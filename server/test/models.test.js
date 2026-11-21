const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Post = require("../src/models/Post");
const Comment = require("../src/models/Comment");
const Like = require("../src/models/Like");
const Follow = require("../src/models/Follow");

const userId = () => new mongoose.Types.ObjectId();

test("user schema rejects malformed usernames and non-HTTPS image URLs", async () => {
    const user = new User({
        username: "bad name",
        email: "person@example.com",
        passwordHash: "hashed",
        profileImageUrl: "http://example.com/avatar.png",
    });

    await assert.rejects(user.validate(), (error) => {
        assert.ok(error.errors.username);
        assert.ok(error.errors.profileImageUrl);
        return true;
    });
});

test("post and comment text are trimmed and enforce their length limits", async () => {
    const author = userId();
    const post = new Post({ author, content: "  hello  " });
    await post.validate();
    assert.equal(post.content, "hello");

    const comment = new Comment({
        post: userId(),
        author,
        content: "x".repeat(501),
    });
    await assert.rejects(comment.validate(), mongoose.Error.ValidationError);
});

test("like and follow schemas have unique relationship indexes", () => {
    assert.ok(Like.schema.indexes().some(([keys, options]) =>
        keys.post === 1 && keys.user === 1 && options.unique
    ));
    assert.ok(Follow.schema.indexes().some(([keys, options]) =>
        keys.follower === 1 && keys.following === 1 && options.unique
    ));
});

test("follow schema rejects following the same user", async () => {
    const id = userId();
    const follow = new Follow({ follower: id, following: id });
    await assert.rejects(follow.validate(), (error) => {
        assert.ok(error.errors.following);
        return true;
    });
});
