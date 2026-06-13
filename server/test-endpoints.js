import axios from "axios";

const BASE_URL = "http://localhost:5000/api";

const runTests = async () => {
    console.log("=== Testing IntellMeet Endpoints ===");
    try {
        // Test 1: Mock Google Login
        console.log("\n1. Testing Mock Google Login...");
        const response = await axios.post(`${BASE_URL}/auth/google-login`, {
            email: "test.google.user@example.com",
            username: "Test Google User",
            avatar: "https://example.com/avatar.png"
        });
        
        console.log("Status Code:", response.status);
        console.log("Access Token received:", !!response.data.accessToken);
        console.log("User details:", response.data.user);

        const token = response.data.accessToken;

        // Test 2: Create a meeting
        console.log("\n2. Testing Create Meeting...");
        const meetingResponse = await axios.post(`${BASE_URL}/meetings`, {
            title: "Verification Sync"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Status Code:", meetingResponse.status);
        console.log("Meeting created:", meetingResponse.data.title, "ID:", meetingResponse.data.meetingId);

        const meetingId = meetingResponse.data.meetingId;

        // Test 3: Save Notes
        console.log("\n3. Testing Save Notes...");
        const notesResponse = await axios.post(`${BASE_URL}/meetings/${meetingId}/notes`, {
            notes: "This note was saved by verification script."
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Status Code:", notesResponse.status);
        console.log("Notes response:", notesResponse.data.message);

        // Test 4: End Meeting & Generate Summary
        console.log("\n4. Testing End Meeting (AI summary)...");
        const endResponse = await axios.post(`${BASE_URL}/meetings/${meetingId}/end`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Status Code:", endResponse.status);
        console.log("Meeting ended status:", endResponse.data.meeting.status);
        console.log("AI Summary text:", endResponse.data.meeting.summary.text);
        console.log("AI Key points:", endResponse.data.meeting.summary.keyPoints);
        console.log("AI Action Items:", endResponse.data.meeting.summary.actionItems);

        console.log("\n✓ All tests passed successfully!");
    } catch (error) {
        console.error("Test failed:", error.response?.data || error.message);
    }
};

runTests();
