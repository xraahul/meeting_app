import { createClient } from "redis";

let redisClient = {
    isReady: false,
    get: async () => null,
    setEx: async () => {},
    del: async () => {}
};

if (process.env.REDIS_URL) {
    const client = createClient({
        url: process.env.REDIS_URL
    });

    client.on("error", (err) => {
        console.error("Redis Error:", err.message);
    });

    (async () => {
        try {
            await client.connect();
            console.log("Redis Connected");
            redisClient = client;
        } catch (error) {
            console.warn("Redis Connection Failed. Proceeding without cache.");
        }
    })();
} else {
    console.warn("No REDIS_URL provided. Proceeding without cache.");
}

export default redisClient;