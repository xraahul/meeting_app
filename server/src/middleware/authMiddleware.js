import jwt from "jsonwebtoken";

const protect = async (req, res, next) => {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Unauthorized — no token provided"
            });
        }

        const token = authHeader.split(" ")[1];

        // Fixed: use JWT_ACCESS_SECRET (was incorrectly JWT_SECRET)
        const decoded = jwt.verify(
            token,
            process.env.JWT_ACCESS_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

export const optionalProtect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_ACCESS_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        // If token is invalid or expired, we still let them proceed anonymously
        req.user = null;
        next();
    }
};

export default protect;