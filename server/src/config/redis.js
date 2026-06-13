import { createClient } from "redis";

let redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (err) => {
    console.error("Redis Error:", err);
});

(async () => {
    try {
        await redisClient.connect();
        console.log("Redis Connected");
    } catch (error) {
        console.warn("Redis Connection Failed. Proceeding without cache.");
        // Fallback dummy client to avoid crashes when Redis is unavailable
        const dummy = {
            isReady: false,
            get: async () => null,
            setEx: async () => {},
            del: async () => {}
        };
        redisClient = dummy;
    }
})();

export default redisClient;