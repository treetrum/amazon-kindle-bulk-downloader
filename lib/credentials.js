"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredentials = void 0;
/**
 * Pulls username, password and OTP code from env vars
 */
const getCredentials = async () => {
    const user = process.env.USERNAME;
    const password = process.env.PASSWORD;
    const otp = process.env.OTP;
    if (!user || !password || !otp)
        throw new Error("Failed to get login credentials from env");
    return { user, password, otp };
};
exports.getCredentials = getCredentials;
