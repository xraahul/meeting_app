import User from "../models/User.js";

export const createProfile = async (req, res) => {

    try {

        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        user.bio = req.body.bio || user.bio;

        if (req.file) {
            user.avatar = req.file.path;
        }

        await user.save();

        res.status(200).json({
            message: "Profile updated",
            user
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });
    }
};