import { exec as execDi } from "child_process";
import { promisify } from "util";
const exec = promisify(execDi);

/**
 * Requires the one passsword CLI to be available with an item called 'Amazon'.
 * The item needs to have the following fields:
 * - username
 * - password
 * - one-time password
 */
export const getCredentials = async () => {
    const { stdout } = await exec(
        'op item get amazon --fields label=username,label=password,label="one-time password" --format json'
    );
    const credentials: { label: string; value: string; totp: string }[] =
        JSON.parse(stdout);

    const user = credentials.find((f) => f.label === "username")?.value;
    const password = credentials.find((f) => f.label === "password")?.value;
    const otp = credentials.find((f) => f.label === "one-time password")?.totp;

    if (!user || !password || !otp)
        throw new Error("Failed to get login credentials");

    return { user, password, otp };
};
