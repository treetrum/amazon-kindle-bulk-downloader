import puppeteer, { Page } from "puppeteer";
import { getCredentials } from "./credentials";
import {
    DeviceList as Device,
    GetDevicesOverviewResponse,
} from "./types/GetDevicesOverviewResponse";
import { GetContentOwnershipDataResponse } from "./types/GetContentOwnershipData";
import { ContentItem } from "./types/GetContentOwnershipData";
import { DownloadViaUSBResponse } from "./types/DownloadViaUSBResponse";
import path from "path";
import fs from "fs";
import chunk from "lodash/chunk";
import cliProgress from "cli-progress";
import dotenv from "dotenv";

type Auth = { csrfToken: string; cookie: string };

const OPTIONS = {
    /** Base URL to get books from */
    baseUrl: "https://www.amazon.com.au",
    /** Total number of items to download */
    totalDownloads: 9999,
    /** How many concurrent downloads to run */
    downloadChunkSize: 25,
    /** Offest which asset to begin downloading from (useful for resuming previous failures) */
    startFromOffset: 0,
};

/**
 * Creates a new browser session using puppeteer
 */
const login = async (page: Page) => {
    console.log("Getting credentials from 1Password");
    const { user, password, otp } = await getCredentials();
    console.log("Got credentials from 1Password");

    console.log("Filling username");
    await page.type('input[type="email"]', user);
    await page.click("#continue");
    await page.waitForNavigation();

    console.log("Filling password");
    await page.type('input[type="password"]', password);
    await page.click("#signInSubmit");
    await page.waitForNavigation();

    console.log("Filling OTP");
    await page.type('input[type="tel"]', otp);
    await page.click("#auth-signin-button");
    await page.waitForNavigation();
};

/**
 * Extracts cookies and csrfToken from the current browser session
 */
const getAuth = async (page: Page): Promise<Auth> => {
    const cookie = (await page.cookies())
        .map((c) => c.name + "=" + c.value)
        .join(";");
    // @ts-expect-error
    const csrfToken = await page.evaluate(() => window.csrfToken);
    return { cookie, csrfToken };
};

/**
 * Generates the 'base' headers sent with most requests (includes cookie auth)
 */
const getHeaders = ({ cookie }: Auth) => {
    return {
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0",
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
    };
};

/**
 * Gets the first 'KINDLE' device associated with the authed account
 */
const getKindleDevice = async (auth: Auth) => {
    const data = (await fetch(
        `${OPTIONS.baseUrl}/hz/mycd/digital-console/ajax`,
        {
            headers: getHeaders(auth),
            body: new URLSearchParams({
                csrfToken: auth.csrfToken,
                activity: "GetDevicesOverview",
                activityInput: JSON.stringify({
                    surfaceType: "Desktop",
                }),
            }),
            method: "POST",
        }
    ).then((res) => res.json())) as GetDevicesOverviewResponse;
    if (data.success !== true) {
        throw new Error(`getDevice failed: ${data.error}`);
    }
    const kindleDevice = data.GetDevicesOverview.deviceList.find(
        (d) => d.deviceFamily === "KINDLE"
    );
    if (!kindleDevice) {
        throw new Error("Did not find a KINDLE device");
    }
    return kindleDevice;
};

/**
 * Get's all content items available to download
 */
const getAllContentItems = async (auth: Auth) => {
    const data = (await fetch(
        `${OPTIONS.baseUrl}/hz/mycd/digital-console/ajax`,
        {
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
        }
    ).then((res) => res.json())) as GetContentOwnershipDataResponse;
    return data.GetContentOwnershipData.items;
};

/**
 * Get the download *final* download URL for a given {@link ContentItem}
 */
const getDownloadUrl = async (
    auth: Auth,
    device: Device,
    asin: ContentItem
) => {
    const data = (await fetch(`${OPTIONS.baseUrl}/hz/mycd/ajax`, {
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
    }).then((res) => res.json())) as DownloadViaUSBResponse;

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
const observeResponse = (
    response: Response,
    fns: { onUpdate: (progress: number) => void; onComplete: () => void }
) => {
    const total = parseInt(response.headers.get("content-length") ?? "0", 10);
    let loaded = 0;
    const outputRes = new Response(
        new ReadableStream({
            async start(controller) {
                const reader = response.body?.getReader();
                if (!reader) throw new Error("Bad response");
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    loaded += value.byteLength;
                    fns.onUpdate(loaded);
                    controller.enqueue(value);
                }
                controller.close();
                fns.onComplete();
            },
        })
    );
    return { response: outputRes, totalSize: total };
};

/**
 * Downloads a single book and updates a passed in {@link cliProgress.MultiBar}
 */
const downloadSingleBook = async (
    auth: Auth,
    device: Device,
    book: ContentItem,
    progressBar: cliProgress.MultiBar
) => {
    const bar = progressBar.create(1, 0, { filename: book.title });

    const downloadURL = await getDownloadUrl(auth, device, book);

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
        const extension =
            content
                .split(";")
                .map((i) => {
                    const [key, value] = i.trim().split("=");
                    return { key, value };
                })
                .find((i) => i.key === "filename")
                ?.value.split(".")[1] ?? "azw3";

        const filename = book.title + "." + extension;
        const data = await response.arrayBuffer();
        await fs.writeFileSync(
            path.join(__dirname, "../downloads", filename),
            Buffer.from(data)
        );
    } else {
        console.error(
            "Request failed with status",
            response.status,
            response.statusText
        );
        throw new Error("Download failed");
    }
};

/**
 * Downloads a list of books and updates a {@link cliProgress.MultiBar}
 */
const downloadBooks = async (
    auth: Auth,
    device: Device,
    books: ContentItem[]
) => {
    const bookChunks = chunk(
        books.slice(OPTIONS.startFromOffset, OPTIONS.totalDownloads),
        OPTIONS.downloadChunkSize
    );

    for (let index = 0; index < bookChunks.length; index++) {
        const chunk = bookChunks[index];
        console.log(
            "Starting chunk of downloads",
            `${index + 1}/${bookChunks.length}`
        );
        const progressBar = new cliProgress.MultiBar(
            {
                hideCursor: true,
                clearOnComplete: false,
                format: "| {bar} | {filename} | {value}/{total}",
            },
            cliProgress.Presets.shades_grey
        );
        await Promise.all(
            chunk.map((b) => downloadSingleBook(auth, device, b, progressBar))
        );
        progressBar.stop();
    }
};

/**
 * Application entry point
 */
const main = async () => {
    dotenv.config();

    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: "./user_data",
    });
    const page = await browser.newPage();

    // Navigate to content and devices
    await page.goto(
        `${OPTIONS.baseUrl}/hz/mycd/digital-console/contentlist/booksPurchases/dateDsc`
    );

    // If we find email input, it means we've been logged out
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
        await login(page);
    }

    const auth = await getAuth(page);
    console.log("Got auth");

    const device = await getKindleDevice(auth);
    console.log("Got device", device.deviceName, device.deviceSerialNumber);

    const books = await getAllContentItems(auth);
    console.log("Got books", books.length);

    await downloadBooks(auth, device, books);

    await browser.close();
};

main();
