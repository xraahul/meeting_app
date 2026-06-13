import express from "express";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

import { signup, login, refreshAccessToken, logout, googleLogin, sendInvitation, getInvitations, acceptInvitation, getTeamMembers, uploadAvatar } from "../controllers/authController.js";

import authLimiter from "../middleware/rateLimiter.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", authLimiter, signup);

router.post("/login", authLimiter, login);

router.post("/google-login", authLimiter, googleLogin);

router.post("/refresh", refreshAccessToken);

router.post("/logout", logout);

// Team and invitation routes
router.post("/invite", protect, sendInvitation);
router.get("/invitations", protect, getInvitations);
router.post("/accept-invite", protect, acceptInvitation);
router.get("/team", protect, getTeamMembers);
router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);

export default router;