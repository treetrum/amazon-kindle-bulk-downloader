import puppeteer, { Page, Browser } from "puppeteer";
import { getCredentials } from "./credentials";
import {
    DeviceList as Device,
    GetDevicesOverviewResponse,
} from "./types/GetDevicesOverviewResponse";
import { GetContentOwnershipDataResponse } from "./types/GetContentOwnershipData";
import { ContentItem } from "./types/GetContentOwnershipData";
import { DownloadViaUSBResponse } from "./types/DownloadViaUSBResponse";
import fetch from "node-fetch";
import { createWriteStream } from "fs";

const OPTIONS = {
    /** Pagination number to begin downloading from */
    startingPage: 1,
    /** If true, we will attempt to loop over pagination and download ALL books */
    downloadAllPages: true,
    /** Base URL to get books from */
    baseUrl: "https://www.amazon.com.au",
};

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

type Auth = { csrfToken: string; cookie: string };

const getAuth = async (page: Page): Promise<Auth> => {
    const cookie = (await page.cookies())
        .map((c) => c.name + "=" + c.value)
        .join(";");
    // @ts-expect-error
    const csrfToken = await page.evaluate(() => window.csrfToken);
    return { cookie, csrfToken };
};

const wait = (milliseconds: number) =>
    new Promise((r) => setTimeout(r, milliseconds));

const downloadBooksOnCurrentPage = async (page: Page) => {
    await page.waitForSelector(".Dropdown-module_container__S6U18");
    const dropdowns = await page.$$(".Dropdown-module_container__S6U18");
    const rows = await page.$$("#CONTENT_LIST tbody tr");
    console.log("Found rows", dropdowns.length);

    let currentRow = 0;
    for (const moreActionsButton of dropdowns) {
        const title = await rows[currentRow]?.$eval(
            ".digital_entity_title",
            (el) => el.textContent
        );

        console.log(`Starting row`, currentRow + 1, title);

        // Open "More actions" dropdown
        await moreActionsButton.click();

        // Click the "download and transfer" button
        const downloadMenuItem = await moreActionsButton.$(
            ".Dropdown-module_dropdown_container__2YGLm > *:nth-child(2)"
        );
        await downloadMenuItem?.click();

        // Select the first device that shows up
        await (
            await page.waitForSelector(
                ".RadioButton-module_radio_container__3ni_P > span"
            )
        )?.click();

        // Click the "Download" button in the modal
        const confirmDownloadButton = await downloadMenuItem?.$(
            ".DeviceDialogBox-module_button_container__1huSS > div:nth-child(2)"
        );
        await confirmDownloadButton?.click();

        // Wait a bit, close the modal, wait a bit more
        await wait(500);
        await page.click("body");
        await wait(500);
        currentRow += 1;
    }
};

const fullPupppeteerImpl = async (page: Page) => {
    // Find total pages count:
    await page.waitForSelector(".pagination .page-item");
    const [currentPageLink, ...remainingPageLinks] = await page.$$(
        ".pagination .page-item"
    );

    console.log("Pages other than this one: ", remainingPageLinks.length);

    // Download 'first' page right now
    console.log("Download initial page");
    await downloadBooksOnCurrentPage(page);
    console.log("Finished initial page");

    if (OPTIONS.downloadAllPages) {
        for (const _ of remainingPageLinks) {
            console.log("Navigating to next page");
            // Needs to be fetched each time due to navigation
            const pageLink = await page.$(
                ".pagination .page-item.active + .page-item"
            );
            await pageLink?.click();
            await page.waitForNavigation();
            console.log("Starting downloads for this page");
            await downloadBooksOnCurrentPage(page);
            console.log("Finished downloads for this page");
        }
    }
};

const getHeaders = ({ cookie }: Auth) => {
    return {
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0",
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
    };
};

const getDevice = async (auth: Auth) => {
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

const getAsins = async (auth: Auth) => {
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
    return data.DownloadViaUSB.URL;
};

import path from "path";

import fs from "fs";

async function waitForDownload(browser: Browser) {
    const dmPage = await browser.newPage();
    await dmPage.goto("chrome://downloads/");

    await dmPage.bringToFront();
    await dmPage.waitForFunction(
        () => {
            try {
                const donePath = document
                    .querySelector("downloads-manager")!
                    .shadowRoot!.querySelector("#frb0")!
                    .shadowRoot!.querySelector("#pauseOrResume")!;
                if ((donePath as HTMLButtonElement).innerText != "Pause") {
                    return true;
                }
            } catch {
                //
            }
        },
        { timeout: 0 }
    );

    await dmPage.close();

    console.log("Download finished");
}

const downloadBooks = async (
    auth: Auth,
    device: Device,
    books: ContentItem[],
    page: Page,
    browser: Browser
) => {
    let i = 0;
    for (const book of books) {
        console.log("Fetching book", `${i + 1}/${books.length}`, book.title);

        const downloadUrl2 = await getDownloadUrl(auth, device, book);

        console.log(downloadUrl2);

        await page.evaluate((downloadUrl2) => {
            window.open(downloadUrl2);
        }, downloadUrl2);

        await wait(5000);
        await waitForDownload(browser);
        i += 1;
    }
};

const ajaxImpl = async (page: Page, browser: Browser) => {
    const auth = await getAuth(page);
    console.log("Got auth");

    const device = await getDevice(auth);
    console.log("Got device", device.deviceName);

    const asins = await getAsins(auth);
    console.log("Got asins", asins.length);

    await downloadBooks(auth, device, asins, page, browser);
};

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: "./user_data",
        // slowMo: 50,
    });
    const page = await browser.newPage();

    // Navigate to content and devices
    await page.goto(
        `${OPTIONS.baseUrl}/hz/mycd/digital-console/contentlist/booksPurchases/dateDsc?pageNumber=${OPTIONS.startingPage}`
    );

    // If we find email input, it means we've been logged out
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
        await login(page);
    }

    // fullPupppeteerImpl(page);
    await ajaxImpl(page, browser);

    await browser.close();
})();
