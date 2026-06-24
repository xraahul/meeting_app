import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

// Use memory storage — we pipe directly to Cloudinary so no local disk needed
const recordingUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept webm, mp4, etc.
        if (
            file.mimetype === "video/webm" ||
            file.mimetype === "audio/webm" ||
            file.mimetype === "video/mp4"
        ) {
            cb(null, true);
        } else {
            cb(null, true); // Fallback to accept whatever browser captures
        }
    }
});

/**
 * Upload a recording buffer to Cloudinary and return the secure URL.
 * @param {Buffer} buffer - File buffer from multer memoryStorage.
 * @param {string} filename - Original filename (used as public_id).
 * @returns {Promise<string>} - Cloudinary secure URL.
 */
export const uploadRecordingToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const uniqueId = `recording-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "video",
                folder: "intellmeet_recordings",
                public_id: uniqueId,
                overwrite: false
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        // Pipe the buffer into the upload stream
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
    });
};

export default recordingUpload;
