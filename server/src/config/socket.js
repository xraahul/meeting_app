/** @type {import("socket.io").Server | null} */
let ioInstance = null;

export const setIO = (io) => {
    ioInstance = io;
};

export const getIO = () => ioInstance;
