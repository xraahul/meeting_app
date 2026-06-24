import fs from "fs";
import FormData from "form-data";
import axios from "axios";

/**
 * Transcribe an audio/video file using OpenAI Whisper.
 * Accepts either a local file path or a remote URL (e.g. Cloudinary).
 * @param {string} filePathOrUrl - Local file path or HTTPS URL to the recording.
 * @param {string} [username="System"] - Speaker label for transcript entries.
 * @returns {Promise<Array<{username: string, text: string, timestamp: Date}>>}
 */
export const transcribeWithWhisper = async (filePathOrUrl, username = "System") => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.warn("OPENAI_API_KEY not set — skipping Whisper transcription.");
        return [];
    }

    const form = new FormData();

    const isRemoteUrl = filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://");

    if (isRemoteUrl) {
        // Download the remote file into a buffer and attach it
        const response = await axios.get(filePathOrUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data);
        form.append("file", buffer, {
            filename: "recording.webm",
            contentType: "video/webm"
        });
    } else {
        // Local file path
        if (!fs.existsSync(filePathOrUrl)) {
            throw new Error("Recording file not found for transcription.");
        }
        form.append("file", fs.createReadStream(filePathOrUrl));
    }

    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");

    const response = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        form,
        {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${apiKey}`
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 120000
        }
    );

    const segments = response.data?.segments || [];
    const fullText = response.data?.text?.trim();

    if (segments.length > 0) {
        return segments
            .filter((seg) => seg.text?.trim())
            .map((seg) => ({
                username,
                text: seg.text.trim(),
                timestamp: new Date(Date.now() + Math.round(seg.start * 1000))
            }));
    }

    if (fullText) {
        return [{
            username,
            text: fullText,
            timestamp: new Date()
        }];
    }

    return [];
};
