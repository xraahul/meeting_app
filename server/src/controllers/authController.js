import bcrypt from "bcryptjs";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import cloudinary from "../config/cloudinary.js";

import {
    generateAccessToken,
    generateRefreshToken,
} from "../utils/generateTokens.js";


// ─── SIGNUP ───────────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required",
            });
        }

        // Check existing user
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            username,
            password: hashedPassword,
        });

        res.status(201).json({
            message: "User created successfully",
            user: {
                id: user._id,
                username: user.username,
            },
        });

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};


// ─── LOGIN ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required",
            });
        }

        // Find user
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({
                message: "Invalid credentials",
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid credentials",
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        // Set refresh token in cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar,
            },
        });

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};


// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
export const refreshAccessToken = async (req, res) => {
    try {

        const token = req.cookies.refreshToken;

        if (!token) {
            return res.status(401).json({
                message: "No refresh token",
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_REFRESH_SECRET
        );

        const user = await User.findById(decoded.userId);

        if (!user || user.refreshToken !== token) {
            return res.status(403).json({
                message: "Invalid refresh token",
            });
        }

        const newAccessToken = generateAccessToken(user._id);

        res.status(200).json({
            accessToken: newAccessToken,
        });

    } catch (error) {
        res.status(403).json({
            message: "Refresh token expired",
        });
    }
};


// ─── LOGOUT ───────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;

        if (token) {
            const user = await User.findOne({ refreshToken: token });
            if (user) {
                user.refreshToken = null;
                await user.save();
            }
        }

        res.clearCookie("refreshToken");
        res.status(200).json({ message: "Logged out successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ─── GOOGLE LOGIN (MOCK OAUTH) ────────────────────────────────────────────────
export const googleLogin = async (req, res) => {
    try {
        const { email, username, avatar } = req.body;

        if (!email || !username) {
            return res.status(400).json({
                message: "Email and username are required from Google OAuth",
            });
        }

        // Find or create user
        let user = await User.findOne({ email });

        if (!user) {
            // Generate a random password for OAuth users
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            user = await User.create({
                username,
                email,
                password: hashedPassword,
                avatar: avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
                role: "Member" // Default role
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        user.refreshToken = refreshToken;
        await user.save();

        // Set refresh token in cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                team: user.team
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ─── SEND INVITATION ─────────────────────────────────────────────────────────
export const sendInvitation = async (req, res) => {
    try {
        const { email, team, role } = req.body;

        if (!email || !team) {
            return res.status(400).json({ message: "Email and Team Name are required" });
        }

        // Generate a random token for the invitation
        const token = crypto.randomBytes(20).toString("hex");

        const invite = await Invitation.create({
            email,
            team,
            role: role || "Member",
            invitedBy: req.user.userId,
            token
        });

        res.status(201).json({
            message: "Invitation sent successfully",
            invite
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ─── GET USER INVITATIONS ─────────────────────────────────────────────────────
export const getInvitations = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const invites = await Invitation.find({
            email: user.email,
            status: "Pending"
        }).populate("invitedBy", "username email");

        res.status(200).json(invites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ─── ACCEPT INVITATION ────────────────────────────────────────────────────────
export const acceptInvitation = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Invitation token is required" });
        }

        const invite = await Invitation.findOne({ token, status: "Pending" });
        if (!invite) {
            return res.status(404).json({ message: "Valid pending invitation not found" });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Join team
        user.team = invite.team;
        if (invite.role === "Admin") {
            user.role = "Admin";
        }
        await user.save();

        // Mark invite accepted
        invite.status = "Accepted";
        await invite.save();

        res.status(200).json({
            message: `Successfully joined team "${invite.team}"`,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                team: user.team
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ─── GET TEAM MEMBERS ─────────────────────────────────────────────────────────
export const getTeamMembers = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.team) {
            return res.status(200).json([]);
        }

        const members = await User.find({ team: user.team }, "username email avatar role team");
        res.status(200).json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── UPLOAD AVATAR ────────────────────────────────────────────────────────────
export const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "intellmeet_avatars", transformation: [{ width: 256, height: 256, crop: "fill" }] },
            async (error, result) => {
                if (error) {
                    return res.status(500).json({ message: "Cloudinary upload failed", error });
                }

                user.avatar = result.secure_url;
                await user.save();

                res.status(200).json({
                    message: "Avatar updated successfully",
                    avatar: result.secure_url,
                });
            }
        );

        uploadStream.end(req.file.buffer);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
