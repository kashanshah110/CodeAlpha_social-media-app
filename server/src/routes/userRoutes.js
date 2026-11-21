const express = require("express");
const controller = require("../controllers/userController");
const { optionalAuth, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalAuth, controller.searchUsers);
router.patch("/me", requireAuth, controller.updateMe);
router.get("/:username/followers", optionalAuth, controller.getFollowers);
router.get("/:username/following", optionalAuth, controller.getFollowing);
router.post("/:userId/follow", requireAuth, controller.followUser);
router.delete("/:userId/follow", requireAuth, controller.unfollowUser);
router.get("/:username", optionalAuth, controller.getProfile);

module.exports = router;
