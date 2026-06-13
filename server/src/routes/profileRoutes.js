import express from "express";

import protect from "../middleware/authMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

import { createProfile } from "../controllers/profileController.js";

const router = express.Router();

router.put("/update",protect,upload.single("avatar"),createProfile);

export default router;