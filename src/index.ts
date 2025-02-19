import dotenv from "dotenv";
import fs from "fs/promises";
import logUpdate from "log-update";
import path from "path";
import prompts from "prompts";
import puppeteer, { Page } from "puppeteer";
import sanitize from "sanitize-filename";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ProgressBars } from "./ProgressBars";
import { getCredentials } from "./credentials";
import type { DownloadViaUSBResponse } from "./types/DownloadViaUSBResponse";
import type { GetContentOwnershipDataResponse } from "./types/GetContentOwnershipData";
import type { ContentItem } from "./types/GetContentOwnershipData";
import type {
  DeviceList as Device,
  GetDevicesOverviewResponse,
} from "./types/GetDevicesOverviewResponse";

type Auth = { csrfToken: string; cookie: string };

/**
 * Creates a new browser session using puppeteer
 */
const login = async (page: Page) => {
  console.log("Getting credentials");
  const { user, password, otp } = await getCredentials();
  console.log("Got credentials");

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log("Filling username");
    await emailInput.type(user);
  }

  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    console.log("Filling password");
    await passwordInput.type(password);
    await page.click("#signInSubmit");
    await page.waitForNavigation();
  }

  const otpInput = await page.$("#auth-mfa-otpcode");
  if (otpInput) {
    if (!otp) {
      throw new Error("OTP is required for this account but was not provided");
    }
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
export const manualLogin = async () => {
  await prompts({
    name: "Waiting to confirm login",
    type: "confirm",
    message: "Press enter once you've logged in",
  });
};

/**
 * Extracts cookies and csrfToken from the current browser session
 */
const getAuth = async (page: Page): Promise<Auth> => {
  const cookie = (await page.browser().cookies())
    .map((c) => c.name + "=" + c.value)
    .join(";");
  // @ts-expect-error - This is set by the page
  const csrfToken = await page.evaluate(() => window.csrfToken);
  if (!csrfToken) throw new Error("Failed to get csrfToken");
  return { cookie, csrfToken };
};

/**
 * Generates the 'base' headers sent with most requests (includes cookie auth)
 */
const getHeaders = ({ cookie }: Auth) => {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    Cookie: cookie,
    "Content-Type": "application/x-www-form-urlencoded",
  };
};

/**
 * Gets the first 'KINDLE' or 'FIRE_TABLET' device associated with the authed account
 */
const getSupportedDevice = async (auth: Auth, options: Options) => {
  const data = (await fetch(`${options.baseUrl}/hz/mycd/digital-console/ajax`, {
    headers: getHeaders(auth),
    body: new URLSearchParams({
      csrfToken: auth.csrfToken,
      activity: "GetDevicesOverview",
      activityInput: JSON.stringify({
        surfaceType: "LargeDesktop",
      }),
    }),
    method: "POST",
  }).then((res) => res.json())) as GetDevicesOverviewResponse;

  if (data.success !== true) {
    throw new Error(`getDevice failed: ${data.error}`);
  }

  const supportedDevices = data.GetDevicesOverview.deviceList.filter(
    (d) => d.deviceFamily === "KINDLE" || d.deviceFamily === "FIRE_TABLET"
  );

  if (supportedDevices.length === 0) {
    throw new Error("Did not find a KINDLE or FIRE_TABLET device");
  }

  if (supportedDevices.length === 1) {
    return supportedDevices[0];
  }

  // If the user has more than one device, prompt them to select one
  const response = await prompts({
    type: "select",
    name: "device",
    message: "Select a Kindle device (note, eink devices are preferred)",
    choices: supportedDevices.map((d) => ({
      title: d.deviceName,
      value: d,
    })),
  });
  return response.device;
};

/**
 * Get's all content items available to download
 */
const getAllContentItems = async (auth: Auth, options: Options) => {
  let allItems: ContentItem[] = [];
  let startIndex = 0;
  let hasMore = true;
  const batchSize = 200;

  while (hasMore) {
    const data = (await fetch(
      `${options.baseUrl}/hz/mycd/digital-console/ajax`,
      {
        headers: getHeaders(auth),
        body: new URLSearchParams({
          csrfToken: auth.csrfToken,
          clientId: "MYCD_WebService",
          activity: "GetContentOwnershipData",
          activityInput: JSON.stringify({
            contentType: "Ebook",
            contentCategoryReference: "booksAll",
            itemStatusList: ["Active"],
            showSharedContent: true,
            originTypes: [
              "Purchase",
              "Pottermore",
              "ComicsUnlimited",
              "KOLL",
              "Prime",
              "Comixology",
            ],
            fetchCriteria: {
              sortOrder: "DESCENDING",
              sortIndex: "TITLE",
              startIndex: startIndex,
              batchSize: batchSize,
              totalContentCount: -1,
            },
            surfaceType: "LargeDesktop",
          }),
        }),
        method: "POST",
      }
    ).then((res) => res.json())) as GetContentOwnershipDataResponse;

    if (!data.GetContentOwnershipData?.items?.length) {
      hasMore = false;
      break;
    }

    allItems = allItems.concat(data.GetContentOwnershipData.items);
    logUpdate(`Found ${allItems.length} books so far...`);

    // If we got fewer items than the batch size, we've reached the end
    if (data.GetContentOwnershipData.items.length < batchSize) {
      hasMore = false;
    } else {
      startIndex += batchSize;
    }
  }

  logUpdate(`Found ${allItems.length} books in total`);
  logUpdate.done();

  return allItems;
};

/**
 * Get the download *final* download URL for a given {@link ContentItem}
 */
const getDownloadUrl = async (
  auth: Auth,
  device: Device,
  asin: ContentItem,
  options: Options
) => {
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
  fns: { onUpdate: (progress: number) => void; onComplete?: () => void }
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
        fns.onComplete?.();
      },
    })
  );
  return { response: outputRes, totalSize: total };
};

/**
 * Downloads a single book and updates a passed in {@link ProgressBars}
 */
const downloadSingleBook = async (
  auth: Auth,
  device: Device,
  book: ContentItem,
  options: Options,
  progressBars: ProgressBars
) => {
  const safeFileName = sanitize(book.title);
  const progressBar = progressBars.create(safeFileName);
  const downloadURL = await getDownloadUrl(auth, device, book, options);

  const rawResponse = await fetch(downloadURL, {
    headers: { Cookie: auth.cookie },
  });
  if (!rawResponse.ok) {
    throw new Error(`${rawResponse.status}: ${rawResponse.statusText}`);
  }
  const { response, totalSize } = observeResponse(rawResponse, {
    onUpdate: (progress) => progressBar.update(totalSize, progress),
  });

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

    const filename = `${safeFileName}.${extension}`;
    const data = await response.arrayBuffer();

    const downloadsDir = path.join(__dirname, "../downloads");
    fs.mkdir(downloadsDir, { recursive: true });
    await fs.writeFile(path.join(downloadsDir, filename), Buffer.from(data));
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
  books: ContentItem[],
  options: Options
) => {
  const failedBooks: { book: ContentItem; error: Error }[] = [];
  const batchSize = options.maxConcurrency;
  const totalBooks = Math.min(books.length, options.totalDownloads);
  const totalBatches = Math.ceil(
    (totalBooks - options.startFromOffset) / batchSize
  );

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const progressBars = new ProgressBars();
    const start = options.startFromOffset + batchIndex * batchSize;
    const end = Math.min(start + batchSize, totalBooks);
    const batch = books.slice(start, end);

    console.log(
      `\nProcessing batch ${batchIndex + 1}/${totalBatches} (Books ${start + 1}-${end})`
    );

    const downloadWithErrorHandling = async (book: ContentItem) => {
      try {
        await downloadSingleBook(auth, device, book, options, progressBars);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`Failed to download "${book.title}":`, error.message);
        } else {
          console.error(`Failed to download "${book.title}":`, error);
        }
        failedBooks.push({ book, error: error as Error });
      }
    };

    await Promise.all(batch.map((book) => downloadWithErrorHandling(book)));
    progressBars.complete();
  }

  if (failedBooks.length > 0) {
    console.log("\nThe following books failed to download:");
    failedBooks.forEach(({ book, error }) => {
      console.log(`- ${book.title}: ${error.message}`);
    });
    console.log(`\nTotal failed downloads: ${failedBooks.length}`);
  }
};

/**
 * Application entry point
 */
const main = async (options: Options) => {
  dotenv.config();

  const browser = await puppeteer.launch({
    headless: false,
    // userDataDir: "./user_data",
  });
  const page = await browser.newPage();

  // Navigate to content and devices
  await page.goto(
    `${options.baseUrl}/hz/mycd/digital-console/contentlist/booksAll/dateDsc`
  );

  if (options.manualAuth) {
    await manualLogin();
  } else {
    // If we find email input, it means we've been logged out
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await login(page);
    }
  }

  const auth = await getAuth(page);
  console.log("Got auth");
  await browser.close();

  const device = await getSupportedDevice(auth, options);
  console.log("Got device", device.deviceName, device.deviceSerialNumber);

  const books = await getAllContentItems(auth, options);

  await downloadBooks(auth, device, books, options);

  await browser.close();
};

type Options = {
  baseUrl: string;
  totalDownloads: number;
  maxConcurrency: number;
  startFromOffset: number;
  manualAuth: boolean;
};

(async () => {
  const args = await yargs(hideBin(process.argv))
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
    .option("maxConcurrency", {
      type: "number",
      default: 25,
      description: "Maximum number of concurrent downloads",
    })
    .option("startFromOffset", {
      type: "number",
      default: 0,
      description:
        "Index offset to begin downloading from. Allows resuming of previous failed attempts.",
    })
    .option("manualAuth", {
      type: "boolean",
      default: false,
      description:
        "Allows user to manually login using the pupeteer UI instead of automatically using ENV vars. Use when auto login is not working.",
    })
    .parse();

  main(args);
})();
