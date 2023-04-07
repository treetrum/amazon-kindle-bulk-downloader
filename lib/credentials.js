"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredentials = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(child_process_1.exec);
/**
 * Requires the one passsword CLI to be available with an item called 'Amazon'.
 * The item needs to have the following fields:
 * - username
 * - password
 * - one-time password
 */
const getCredentials = async () => {
    const { stdout } = await exec('op item get amazon --fields label=username,label=password,label="one-time password" --format json');
    const credentials = JSON.parse(stdout);
    const user = credentials.find((f) => f.label === "username")?.value;
    const password = credentials.find((f) => f.label === "password")?.value;
    const otp = credentials.find((f) => f.label === "one-time password")?.totp;
    if (!user || !password || !otp)
        throw new Error("Failed to get login credentials");
    return { user, password, otp };
};
exports.getCredentials = getCredentials;
