import axios from "axios";

async function run() {
    try {
        console.log("Creating meeting...");
        const createRes = await axios.post("http://localhost:5001/api/meetings/", { title: "Test Meeting" });
        const roomId = createRes.data.meetingId;
        console.log("Created meeting", roomId);
        
        console.log("Ending meeting...");
        const endRes = await axios.post(`http://localhost:5001/api/meetings/${roomId}/end`);
        console.log("Success!", endRes.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}
run();
