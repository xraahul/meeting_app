import { generateAISummary } from "./src/services/aiService.js";

async function test() {
    const transcript = [
        { username: "Alice", text: "We need to fix the server error.", timestamp: new Date() },
        { username: "Bob", text: "I will check the logs and update the code.", timestamp: new Date() }
    ];
    try {
        const result = await generateAISummary("Test Meeting", transcript);
        console.log("Success:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
