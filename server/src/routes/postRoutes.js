const express = require("express");
const controller = require("../controllers/postController");
const { optionalAuth, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalAuth, controller.listPosts);
router.post("/", requireAuth, controller.createPost);
router.get("/:postId", optionalAuth, controller.getPost);
router.patch("/:postId", requireAuth, controller.updatePost);
router.delete("/:postId", requireAuth, controller.deletePost);
router.get("/:postId/comments", optionalAuth, controller.listComments);
router.post("/:postId/comments", requireAuth, controller.createComment);
router.post("/:postId/like", requireAuth, controller.likePost);
router.delete("/:postId/like", requireAuth, controller.unlikePost);

module.exports = router;
