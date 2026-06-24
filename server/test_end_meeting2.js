import axios from "axios";

async function run() {
    try {
        console.log("Creating meeting...");
        const createRes = await axios.post("http://localhost:5001/api/meetings/", { title: "Test Meeting" });
        const roomId = createRes.data.meetingId;
        const _id = createRes.data._id;
        console.log("Created meeting", roomId);

        // manually update transcript
        await axios.post(`http://localhost:5001/api/meetings/${roomId}/notes`, { notes: "test" });
        
        // Let's directly connect to mongo to add transcript because there's no endpoint for it
        
        console.log("Ending meeting...");
        const endRes = await axios.post(`http://localhost:5001/api/meetings/${roomId}/end`);
        console.log("Success!", endRes.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}
run();
