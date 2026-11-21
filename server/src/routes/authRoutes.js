const express = require("express");
const controller = require("../controllers/authController");
const { optionalAuth, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.get("/me", optionalAuth, controller.me);
router.post("/logout", requireAuth, controller.logout);

module.exports = router;
