"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualLogin = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const credentials_1 = require("./credentials");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const chunk_1 = __importDefault(require("lodash/chunk"));
const cli_progress_1 = __importDefault(require("cli-progress"));
const dotenv_1 = __importDefault(require("dotenv"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const prompts_1 = __importDefault(require("prompts"));
/**
 * Creates a new browser session using puppeteer
 */
const login = async (page) => {
    console.log("Getting credentials");
    const { user, password, otp } = await (0, credentials_1.getCredentials)();
    console.log("Got credentials");
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
        console.log("Filling username");
        await emailInput.type(user);
        await page.click("#continue");
        await page.waitForNavigation();
    }
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
        console.log("Filling password");
        await passwordInput.type(password);
        await page.click("input[name=rememberMe]");
        await page.click("#signInSubmit");
        await page.waitForNavigation();
    }
    const otpInput = await page.$("#auth-mfa-otpcode");
    if (otpInput) {
        console.log("Filling OTP");
        await otpInput.type(otp);
        await page.click("#auth-mfa-remember-device");
        await page.click("#auth-signin-button");
        await page.waitForNavigation();
    }
};
/**
 * Pauses the script until user confirms login. Use when automated login doesn't work.
 */
const manualLogin = async () => {
    await (0, prompts_1.default)({
        name: "Waiting to confirm login",
        type: "confirm",
        message: "Press enter once you've logged in",
    });
};
exports.manualLogin = manualLogin;
/**
 * Extracts cookies and csrfToken from the current browser session
 */
const getAuth = async (page) => {
    const cookie = (await page.cookies())
        .map((c) => c.name + "=" + c.value)
        .join(";");
    // @ts-expect-error haven't bothered to add custom type defs for this
    const csrfToken = await page.evaluate(() => window.csrfToken);
    return { cookie, csrfToken };
};
/**
 * Generates the 'base' headers sent with most requests (includes cookie auth)
 */
const getHeaders = ({ cookie }) => {
    return {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0",
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
    };
};
/**
 * Gets the first 'KINDLE' device associated with the authed account
 */
const getKindleDevice = async (auth, options) => {
    const data = (await fetch(`${options.baseUrl}/hz/mycd/digital-console/ajax`, {
        headers: getHeaders(auth),
        body: new URLSearchParams({
            csrfToken: auth.csrfToken,
            activity: "GetDevicesOverview",
            activityInput: JSON.stringify({
                surfaceType: "Desktop",
            }),
        }),
        method: "POST",
    }).then((res) => res.json()));
    if (data.success !== true) {
        throw new Error(`getDevice failed: ${data.error}`);
    }
    const kindleDevice = data.GetDevicesOverview.deviceList.find((d) => d.deviceFamily === "KINDLE");
    if (!kindleDevice) {
        throw new Error("Did not find a KINDLE device");
    }
    return kindleDevice;
};
/**
 * Get's all content items available to download
 */
const getAllContentItems = async (auth, options) => {
    const data = (await fetch(`${options.baseUrl}/hz/mycd/digital-console/ajax`, {
        headers: getHeaders(auth),
        body: new URLSearchParams({
            csrfToken: auth.csrfToken,
            activity: "GetContentOwnershipData",
            activityInput: JSON.stringify({
                contentType: "Ebook",
                contentCategoryReference: "booksPurchases",
                itemStatusList: ["Active"],
                originTypes: ["Purchase", "Pottermore"],
                fetchCriteria: {
                    sortOrder: "DESCENDING",
                    sortIndex: "DATE",
                    startIndex: 0,
                    batchSize: 999,
                    totalContentCount: -1,
                },
                surfaceType: "Desktop",
            }),
        }),
        method: "POST",
    }).then((res) => res.json()));
    return data.GetContentOwnershipData.items;
};
/**
 * Get the download *final* download URL for a given {@link ContentItem}
 */
const getDownloadUrl = async (auth, device, asin, options) => {
    const data = (await fetch(`${options.baseUrl}/hz/mycd/ajax`, {
        headers: getHeaders(auth),
        body: new URLSearchParams({
            csrfToken: auth.csrfToken,
            data: JSON.stringify({
                param: {
                    DownloadViaUSB: {
                        contentName: asin.asin,
                        encryptedDeviceAccountId: device.deviceAccountID,
                        originType: "Purchase",
                    },
                },
            }),
        }),
        method: "POST",
    }).then((res) => res.json()));
    if (data.DownloadViaUSB.success !== true) {
        throw new Error("Failed to fetch download URL");
    }
    const redirectRes = await fetch(data.DownloadViaUSB.URL, {
        headers: { Cookie: auth.cookie },
        redirect: "manual",
    });
    const realDownloadUrl = redirectRes.headers.get("location");
    if (!realDownloadUrl) {
        throw new Error("Did not get a file download URL");
    }
    return realDownloadUrl;
};
/**
 * Used to get progress updates on an inflight fetch response
 */
const observeResponse = (response, fns) => {
    const total = parseInt(response.headers.get("content-length") ?? "0", 10);
    let loaded = 0;
    const outputRes = new Response(new ReadableStream({
        async start(controller) {
            const reader = response.body?.getReader();
            if (!reader)
                throw new Error("Bad response");
            for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                loaded += value.byteLength;
                fns.onUpdate(loaded);
                controller.enqueue(value);
            }
            controller.close();
            fns.onComplete();
        },
    }));
    return { response: outputRes, totalSize: total };
};
/**
 * Downloads a single book and updates a passed in {@link cliProgress.MultiBar}
 */
const downloadSingleBook = async (auth, device, book, progressBar, options) => {
    const bar = progressBar.create(1, 0, { filename: book.title });
    const downloadURL = await getDownloadUrl(auth, device, book, options);
    const rawResponse = await fetch(downloadURL, {
        headers: { Cookie: auth.cookie },
    });
    const { response, totalSize } = observeResponse(rawResponse, {
        onUpdate: (progress) => {
            bar.update(progress, { filename: book.title });
        },
        onComplete: () => {
            bar.stop();
        },
    });
    bar.start(totalSize, 0);
    if (response.ok) {
        const content = rawResponse.headers.get("content-disposition") ?? "";
        const extension = content
            .split(";")
            .map((i) => {
            const [key, value] = i.trim().split("=");
            return { key, value };
        })
            .find((i) => i.key === "filename")
            ?.value.split(".")[1] ?? "azw3";
        const filename = book.title + "." + extension;
        const data = await response.arrayBuffer();
        await fs_1.default.writeFileSync(path_1.default.join(__dirname, "../downloads", filename), Buffer.from(data));
    }
    else {
        console.error("Request failed with status", response.status, response.statusText);
        throw new Error("Download failed");
    }
};
/**
 * Downloads a list of books and updates a {@link cliProgress.MultiBar}
 */
const downloadBooks = async (auth, device, books, options) => {
    const bookChunks = (0, chunk_1.default)(books.slice(options.startFromOffset, options.totalDownloads), options.downloadChunkSize);
    for (let index = 0; index < bookChunks.length; index++) {
        const chunk = bookChunks[index];
        console.log("Starting chunk of downloads", `${index + 1}/${bookChunks.length}`);
        const progressBar = new cli_progress_1.default.MultiBar({
            hideCursor: true,
            clearOnComplete: false,
            format: "| {bar} | {filename} | {value}/{total}",
        }, cli_progress_1.default.Presets.shades_grey);
        await Promise.all(chunk.map((b) => downloadSingleBook(auth, device, b, progressBar, options)));
        progressBar.stop();
    }
};
/**
 * Application entry point
 */
const main = async (options) => {
    dotenv_1.default.config();
    const browser = await puppeteer_1.default.launch({
        headless: false,
        // userDataDir: "./user_data",
    });
    const page = await browser.newPage();
    // Navigate to content and devices
    await page.goto(`${options.baseUrl}/hz/mycd/digital-console/contentlist/booksPurchases/dateDsc`);
    if (options.manualAuth) {
        await (0, exports.manualLogin)();
    }
    else {
        // If we find email input, it means we've been logged out
        const emailInput = await page.$('input[type="email"]');
        if (emailInput) {
            await login(page);
        }
    }
    const auth = await getAuth(page);
    console.log("Got auth");
    const device = await getKindleDevice(auth, options);
    console.log("Got device", device.deviceName, device.deviceSerialNumber);
    const books = await getAllContentItems(auth, options);
    console.log("Got books", books.length);
    await downloadBooks(auth, device, books, options);
    await browser.close();
};
(async () => {
    const args = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .option("baseUrl", {
        type: "string",
        default: "https://www.amazon.com.au",
        description: "Which Amazon base URL to use",
    })
        .option("totalDownloads", {
        type: "number",
        default: 9999,
        description: "Total number of downloads to do",
    })
        .option("downloadChunkSize", {
        type: "number",
        default: 25,
        description: "Maximum number of concurrent downloads",
    })
        .option("startFromOffset", {
        type: "number",
        default: 0,
        description: "Index offset to begin downloading from. Allows resuming of previous failed attempts.",
    })
        .option("manualAuth", {
        type: "boolean",
        default: false,
        description: "Allows user to manually login using the pupeteer UI instead of automatically using ENV vars. Use when auto login is not working.",
    })
        .parse();
    main(args);
})();
