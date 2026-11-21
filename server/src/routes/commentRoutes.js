const express = require("express");
const controller = require("../controllers/postController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.patch("/:commentId", requireAuth, controller.updateComment);
router.delete("/:commentId", requireAuth, controller.deleteComment);

module.exports = router;
