import fs from "fs";
import FormData from "form-data";
import axios from "axios";

/**
 * Transcribe an audio/video file using OpenAI Whisper.
 * @param {string} filePath - Absolute path to the recording file.
 * @param {string} [username="System"] - Speaker label for transcript entries.
 * @returns {Promise<Array<{username: string, text: string, timestamp: Date}>>}
 */
export const transcribeWithWhisper = async (filePath, username = "System") => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.warn("OPENAI_API_KEY not set — skipping Whisper transcription.");
        return [];
    }

    if (!fs.existsSync(filePath)) {
        throw new Error("Recording file not found for transcription.");
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
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
