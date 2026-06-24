import mongoose from "mongoose";
import Task from "./src/models/Task.js";
import db from "./src/config/db.js";

async function test() {
    await db();
    try {
        await Task.insertMany([]);
        console.log("Empty insertMany succeeded");
    } catch (err) {
        console.log("Empty insertMany failed:", err.message);
    }
    process.exit(0);
}
test();
