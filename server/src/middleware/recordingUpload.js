import multer from "multer";
import fs from "fs";
import path from "path";

// Ensure the local uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads", "recordings");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `recording-${uniqueSuffix}.webm`);
    }
});

const recordingUpload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept webm, mp4, etc.
        if (file.mimetype === "video/webm" || file.mimetype === "audio/webm" || file.mimetype === "video/mp4") {
            cb(null, true);
        } else {
            cb(null, true); // Fallback to accept whatever browser captures
        }
    }
});

export default recordingUpload;
