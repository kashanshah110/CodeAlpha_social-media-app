const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const {
    AppError,
    assertObject,
    readString,
    readObjectId,
    readLimit,
} = require("../utils/validation");

async function addPostStats(posts, viewer) {
    if (posts.length === 0) return [];
    const postIds = posts.map((post) => post._id);
    const [likeCounts, commentCounts, likedPosts] = await Promise.all([
        Like.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } },
        ]),
        Comment.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } },
        ]),
        viewer
            ? Like.find({ post: { $in: postIds }, user: viewer._id }).select("post")
            : [],
    ]);
    const likeCountByPost = new Map(
        likeCounts.map((item) => [String(item._id), item.count])
    );
    const commentCountByPost = new Map(
        commentCounts.map((item) => [String(item._id), item.count])
    );
    const likedIds = new Set(likedPosts.map((item) => String(item.post)));

    return posts.map((post) => ({
        ...post.toObject(),
        likeCount: likeCountByPost.get(String(post._id)) || 0,
        commentCount: commentCountByPost.get(String(post._id)) || 0,
        likedByMe: likedIds.has(String(post._id)),
        isAuthor: Boolean(viewer && String(post.author._id) === String(viewer._id)),
    }));
}

async function listPosts(req, res) {
    const limit = readLimit(req.query.limit);
    const posts = await Post.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("author", "username profileImageUrl");
    res.json({ posts: await addPostStats(posts, req.user) });
}

async function getPost(req, res) {
    const postId = readObjectId(req.params.postId, "Post ID");
    const post = await Post.findById(postId).populate(
        "author",
        "username profileImageUrl"
    );
    if (!post) throw new AppError(404, "Post not found.");
    const [result] = await addPostStats([post], req.user);
    res.json({ post: result });
}

async function createPost(req, res) {
    assertObject(req.body);
    const content = readString(req.body.content, "Post", {
        min: 1,
        max: 1000,
    });
    const post = await Post.create({ content, author: req.user._id });
    await post.populate("author", "username profileImageUrl");
    const [result] = await addPostStats([post], req.user);
    res.status(201).json({ post: result });
}

async function updatePost(req, res) {
    const postId = readObjectId(req.params.postId, "Post ID");
    assertObject(req.body);
    const content = readString(req.body.content, "Post", {
        min: 1,
        max: 1000,
    });
    const post = await Post.findById(postId);
    if (!post) throw new AppError(404, "Post not found.");
    if (!post.author.equals(req.user._id)) {
        throw new AppError(403, "You can only edit your own posts.");
    }

    post.content = content;
    await post.save();
    await post.populate("author", "username profileImageUrl");
    const [result] = await addPostStats([post], req.user);
    res.json({ post: result });
}

async function deletePost(req, res) {
    const postId = readObjectId(req.params.postId, "Post ID");
    const post = await Post.findById(postId);
    if (!post) throw new AppError(404, "Post not found.");
    if (!post.author.equals(req.user._id)) {
        throw new AppError(403, "You can only delete your own posts.");
    }

    await Promise.all([
        Comment.deleteMany({ post: postId }),
        Like.deleteMany({ post: postId }),
    ]);
    await post.deleteOne();
    res.json({ message: "Post deleted." });
}

async function listComments(req, res) {
    const postId = readObjectId(req.params.postId, "Post ID");
    const limit = readLimit(req.query.limit, 100, 100);
    if (!(await Post.exists({ _id: postId }))) {
        throw new AppError(404, "Post not found.");
    }
    const comments = await Comment.find({ post: postId })
        .sort({ createdAt: 1 })
        .limit(limit)
        .populate("author", "username profileImageUrl");
    res.json({ comments });
}

async function createComment(req, res) {
    const postId = readObjectId(req.params.postId, "Post ID");
    assertObject(req.body);
    const content = readString(req.body.content, "Comment", {
        min: 1,
        max: 500,
    });
    if (!(await Post.exists({ _id: postId }))) {
        throw new AppError(404, "Post not found.");
    }
    const comment = await Comment.create({
        post: postId,
        author: req.user._id,
        content,
    });
    await comment.populate("author", "username profileImageUrl");
    res.status(201).json({ comment });
}

async function updateComment(req, res) {
    const commentId = readObjectId(req.params.commentId, "Comment ID");
    assertObject(req.body);
    const content = readString(req.body.content, "Comment", {
        min: 1,
        max: 500,
    });
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError(404, "Comment not found.");
    if (!comment.author.equals(req.user._id)) {
        throw new AppError(403, "You can only edit your own comments.");
    }
    comment.content = content;
    await comment.save();
    await comment.populate("author", "username profileImageUrl");
    res.json({ comment });
}

async function deleteComment(req, res) {
    const commentId = readObjectId(req.params.commentId, "Comment ID");
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError(404, "Comment not found.");
    if (!comment.author.equals(req.user._id)) {
        throw new AppError(403, "You can only delete your own comments.");
    }
    await comment.deleteOne();
    res.json({ message: "Comment deleted." });
}

async function likePost(req, res) {
    const postId = readObjectId(req.params.postId, "Post ID");
    if (!(await Post.exists({ _id: postId }))) {
        throw new AppError(404, "Post not found.");
    }
    try {
        await Like.updateOne(
            { post: postId, user: req.user._id },
            { $setOnInsert: { post: postId, user: req.user._id } },
            { upsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) throw error;
    }
    const likeCount = await Like.countDocuments({ post: postId });
    res.json({ liked: true, likeCount });
}

async function unlikePost(req, res) {
    const postId = readObjectId(req.params.postId, "Post ID");
    if (!(await Post.exists({ _id: postId }))) {
        throw new AppError(404, "Post not found.");
    }
    await Like.deleteOne({ post: postId, user: req.user._id });
    const likeCount = await Like.countDocuments({ post: postId });
    res.json({ liked: false, likeCount });
}

module.exports = {
    addPostStats,
    listPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    listComments,
    createComment,
    updateComment,
    deleteComment,
    likePost,
    unlikePost,
};
