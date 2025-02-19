/**
 * Pulls username, password and OTP code from env vars
 */
export const getCredentials = async () => {
  const user = process.env["AMAZON_USER"];
  const password = process.env["PASSWORD"];
  const otp = process.env["OTP"];

  if (!user || !password) {
    throw new Error("Failed to get login credentials from env");
  }

  return { user, password, otp };
};
