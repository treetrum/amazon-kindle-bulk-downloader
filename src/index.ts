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
import { fetchJson, retry, throwingFetch } from "./networking";
import { DuplicateHandling, type Options } from "./types";
import type { DownloadViaUSBResponse } from "./types/DownloadViaUSBResponse";
import type {
  ContentItem,
  GetContentOwnershipDataResponse,
} from "./types/GetContentOwnershipData";
import type {
  DeviceList as Device,
  GetDevicesOverviewResponse,
} from "./types/GetDevicesOverviewResponse";
import { Colors, getDownloadsDir } from "./utils";

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

  const captchaInput = await page.$("input[name='cvf_captcha_input']");
  if (captchaInput) {
    console.log("CAPTCHA found");
    await prompts({
      name: "captcha",
      type: "confirm",
      message: "Press enter once you've solved the CAPTCHA",
    });
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
  const data = await fetchJson<GetDevicesOverviewResponse>(
    `${options.baseUrl}/hz/mycd/digital-console/ajax`,
    {
      headers: getHeaders(auth),
      body: new URLSearchParams({
        csrfToken: auth.csrfToken,
        activity: "GetDevicesOverview",
        activityInput: JSON.stringify({
          surfaceType: "LargeDesktop",
        }),
      }),
      method: "POST",
    }
  );

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
  let startIndex = options.startFromOffset;
  let hasMore = true;
  const batchSize = 200;

  if (options.searchPhrase) {
    console.log(
      `Limiting search to entries matching "${options.searchPhrase}"`
    );
  }

  //  Convert the sortOrder command-line value to a String value
  const sortOrderString = getSortOrderString(options.sortOrder);

  while (hasMore) {
    const data = await fetchJson<GetContentOwnershipDataResponse>(
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
              sortOrder: sortOrder,
              sortIndex: options.sortBy?.toString().toUpperCase(),
              startIndex: startIndex,
              batchSize: batchSize,
              totalContentCount: -1,
              searchPhrase: options.searchPhrase,
            },
            surfaceType: "LargeDesktop",
          }),
        }),
        method: "POST",
      }
    );

    if (!data.GetContentOwnershipData?.items?.length) {
      hasMore = false;
      break;
    }

    allItems = allItems.concat(data.GetContentOwnershipData.items);
    logUpdate(`Found ${allItems.length} books so far...`);

    if (
      data.GetContentOwnershipData.items.length < batchSize ||
      allItems.length >= options.totalDownloads
    ) {
      hasMore = false;
    } else {
      startIndex += batchSize;
    }
  }

  logUpdate(`Found ${allItems.length} books in total`);
  logUpdate.done();

  if (allItems.length > options.totalDownloads) {
    console.warn(
      `Found more books than "totalDownloads" option, only downloading the first ${options.totalDownloads}`
    );
  }

  const limited = allItems.slice(0, options.totalDownloads);

  const skipPhrases = options.skipBooksMatching;
  if (skipPhrases) {
    const skipped: ContentItem[] = [];
    const unskipped = limited.filter((b) => {
      const title = getDownloadTitle(b);
      const shouldSkip = skipPhrases.some((phrase) =>
        title.includes(String(phrase))
      );
      if (shouldSkip) {
        skipped.push(b);
        return false;
      }
      return true;
    });

    const skipPhrasesStr = skipPhrases?.map((p) => `"${p}"`).join(", ");
    if (skipped.length > 0) {
      console.log(
        `${Colors.yellow}\nSkipping the following books due to matching with one of the following skip phrases: ${skipPhrasesStr}\n${Colors.reset}`
      );
      skipped.forEach((b) => {
        const title = getDownloadTitle(b);
        console.log(`${Colors.yellow}- ${title}${Colors.reset}`);
      });
    } else {
      console.log(
        `${Colors.yellow}\nNo book were found matching the following skip phrases: ${skipPhrasesStr}${Colors.reset}`
      );
    }

    return unskipped;
  }

  return limited;
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
  const data = await fetchJson<DownloadViaUSBResponse>(
    `${options.baseUrl}/hz/mycd/ajax`,
    {
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
    }
  );

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

  if (realDownloadUrl.includes("/error")) {
    throw new Error("No valid download URL found");
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

const doesFileExistAndMatchSize = async (
  filePath: string,
  size: number
): Promise<boolean> => {
  try {
    const stats = await fs.stat(filePath);
    return stats.size === size;
  } catch (error) {
    return false;
  }
};

export const getDownloadTitle = (book: ContentItem): string => {
  return sanitize(`${book.title} ${book.asin}`);
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
  const safeFileName = getDownloadTitle(book);
  const progressBar = progressBars.create(
    `Getting download url: ${safeFileName}`
  );
  const downloadURL = await getDownloadUrl(auth, device, book, options);

  progressBar.setContent(`Downloading: ${safeFileName}`);
  const abortController = new AbortController();

  const rawResponse = await retry(
    async () =>
      throwingFetch(downloadURL, {
        headers: { Cookie: auth.cookie },
        signal: abortController.signal,
      }),
    (retryNumber) => {
      progressBar.setContent(
        `Downloading (Retry #${retryNumber}): ${safeFileName}`
      );
    }
  );
  const size = parseInt(rawResponse.headers.get("content-length") ?? "0", 10);
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

  const downloadsDir = getDownloadsDir(options);
  const filename = `${safeFileName}.${extension}`;
  const downloadPath = path.join(downloadsDir, filename);

  // If we already have a file with the same name and size, skip it.
  const shouldSkipDownload =
    options.duplicateHandling === DuplicateHandling.skip &&
    (await doesFileExistAndMatchSize(downloadPath, size));
  if (shouldSkipDownload) {
    progressBar.setContent(`Already downloaded — skipping: ${safeFileName}`);
    progressBar.update(size, size);
    abortController.abort();
    return;
  }

  const { response, totalSize } = observeResponse(rawResponse, {
    onUpdate: (progress) => progressBar.update(totalSize, progress),
  });
  if (response.ok) {
    const data = await response.arrayBuffer();
    fs.mkdir(downloadsDir, { recursive: true });
    progressBar.setContent(`Complete: ${safeFileName}`);
    await fs.writeFile(downloadPath, Buffer.from(data));
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
  const totalBooks = books.length;
  const totalBatches = Math.ceil(totalBooks / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const progressBars = new ProgressBars();
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, totalBooks);
    const batch = books.slice(start, end);

    const offset = options.startFromOffset;
    console.log(
      `\nProcessing batch ${batchIndex + 1}/${totalBatches} (Books ${
        start + offset + 1
      }-${end + offset})`
    );

    const downloadWithErrorHandling = async (book: ContentItem) => {
      try {
        await downloadSingleBook(auth, device, book, options, progressBars);
      } catch (error: unknown) {
        const titleForError = sanitize(
          book.title.length > 50 ? book.title.slice(0, 50) + "..." : book.title
        );
        if (error instanceof Error) {
          console.error(
            `Failed to download "${titleForError}":`,
            error.message
          );
        } else {
          console.error(`Failed to download "${titleForError}":`, error);
        }
        failedBooks.push({ book, error: error as Error });
      }
    };

    await Promise.all(batch.map((book) => downloadWithErrorHandling(book)));
    progressBars.complete();
  }

  if (failedBooks.length > 0) {
    const failedBooksContent = failedBooks
      .map((b) => b.book.title + " : " + b.error.message)
      .join("\n");
    const failedBooksLogPath = path.join(__dirname, "../failed-books.txt");
    await fs.writeFile(failedBooksLogPath, failedBooksContent);
    console.log(
      `\n${Colors.yellow}⚠️ ${failedBooks.length} book${
        failedBooks.length === 1 ? "" : "s"
      } failed to download. A list of failed books has been written to ${failedBooksLogPath}${
        Colors.reset
      }`
    );
  }
};

/**
 * Application entry point
 */
const main = async (options: Options) => {
  dotenv.config();

  const browser = await puppeteer.launch({
    args: [process.env["PUPPETEER_ARGS"] || ""],
    headless: process.env["PUPPETEER_HEADLESS"] === "true",
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

  const downloadsDir = getDownloadsDir(options);
  console.log(
    `\n${Colors.green}Downloading complete. You can find your books in the '${downloadsDir}' folder.${Colors.reset}`
  );
};

const sanitizeBaseURL = async (baseUrl: string | undefined) => {
  const url =
    baseUrl ??
    (
      await prompts({
        type: "text",
        name: "baseUrl",
        message: "Enter the Amazon base URL",
        instructions: "e.g. https://www.amazon.com",
      })
    ).baseUrl;

  if (!url.includes("www.")) {
    console.warn(
      [
        "",
        "================== WARNING ===================",
        "Base URL should include 'www.' to avoid issues",
        "==============================================",
        "",
      ].join("\n")
    );
  }

  return url;
};

(async () => {
  const args = await yargs(hideBin(process.argv))
    .option("baseUrl", {
      type: "string",
      description: "Which Amazon base URL to use",
    })
    .option("totalDownloads", {
      type: "number",
      default: Infinity,
      description: "Total number of downloads to do",
    })
    .option("maxConcurrency", {
      type: "number",
      default: 10,
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
    .option("duplicateHandling", {
      default: DuplicateHandling.skip,
      description: "How to handle duplicate downloads",
      choices: Object.values(DuplicateHandling),
    })
    .option("searchPhrase", {
      type: "string",
      description: "Search phrase to filter books by",
    })
    .option("searchPhraseDirs", {
      type: "boolean",
      default: false,
      description:
        "If set to true, downloaded books will be saved to a sub-directory named after the search phrase within the downloadsDir",
    })
    .option("downloadsDir", {
      type: "string",
      description: "Directory that downloaded books will be saved to",
    })
    .option("skipBooksMatching", {
      type: "array",
      description:
        "If a book title contains this phrase, don't attempt to download it. Case sensitive. Useful for ignoring books causing issues.",
    })

    //  Added the "SortBy" and "SortOrder" Command Line options
    .option("sortBy", {
      default: SortBy.title,
      description: "What value to sort books on (Author, Date or Title)",
      choices: Object.values(SortBy),
    })
    .option("sortOrder", {
      default: SortOrder.desc,
      description: "What order to sort books by (Ascending or Descending)",
      choices: Object.values(SortOrder),
    })

    .parse();

  const baseUrl = await sanitizeBaseURL(args.baseUrl);

  main({ ...args, baseUrl });
})();
