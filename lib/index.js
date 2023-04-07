"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const credentials_1 = require("./credentials");
const OPTIONS = {
    /** Pagination number to begin downloading from */
    startingPage: 1,
    /** If true, we will attempt to loop over pagination and download ALL books */
    downloadAllPages: true,
};
const login = async (page) => {
    const { user, password, otp } = await (0, credentials_1.getCredentials)();
    await page.type('input[type="email"]', user);
    await page.click("#continue");
    await page.waitForNavigation();
    await page.type('input[type="password"]', password);
    await page.click("#signInSubmit");
    await page.waitForNavigation();
    await page.type('input[type="tel"]', otp);
    await page.click("#auth-signin-button");
    await page.waitForNavigation();
};
const wait = (milliseconds) => new Promise((r) => setTimeout(r, milliseconds));
const downloadBooksOnCurrentPage = async (page) => {
    await page.waitForSelector(".Dropdown-module_container__S6U18");
    const dropdowns = await page.$$(".Dropdown-module_container__S6U18");
    const rows = await page.$$("#CONTENT_LIST tbody tr");
    console.log("Found rows", dropdowns.length);
    let currentRow = 0;
    for (const moreActionsButton of dropdowns) {
        const title = await rows[currentRow]?.$eval(".digital_entity_title", (el) => el.textContent);
        console.log(`Starting row`, currentRow + 1, title);
        // Open "More actions" dropdown
        await moreActionsButton.click();
        // Click the "download and transfer" button
        const downloadMenuItem = await moreActionsButton.$(".Dropdown-module_dropdown_container__2YGLm > *:nth-child(2)");
        await downloadMenuItem?.click();
        // Select the first device that shows up
        await (await page.waitForSelector(".RadioButton-module_radio_container__3ni_P > span"))?.click();
        // Click the "Download" button in the modal
        const confirmDownloadButton = await downloadMenuItem?.$(".DeviceDialogBox-module_button_container__1huSS > div:nth-child(2)");
        await confirmDownloadButton?.click();
        // Wait a bit, close the modal, wait a bit more
        await wait(500);
        await page.click("body");
        await wait(500);
        currentRow += 1;
    }
};
(async () => {
    const browser = await puppeteer_1.default.launch({
        headless: false,
        userDataDir: "./user_data",
        slowMo: 50,
    });
    const page = await browser.newPage();
    // Navigate to content and devices
    await page.goto(`https://www.amazon.com.au/hz/mycd/digital-console/contentlist/booksPurchases/dateDsc?pageNumber=${OPTIONS.startingPage}`);
    // If we find email input, it means we've been logged out
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
        await login(page);
    }
    // Find total pages count:
    await page.waitForSelector(".pagination .page-item");
    const [currentPageLink, ...remainingPageLinks] = await page.$$(".pagination .page-item");
    console.log("Pages other than this one: ", remainingPageLinks.length);
    // Download 'first' page right now
    console.log("Download initial page");
    await downloadBooksOnCurrentPage(page);
    console.log("Finished initial page");
    if (OPTIONS.downloadAllPages) {
        for (const _ of remainingPageLinks) {
            console.log("Navigating to next page");
            // Needs to be fetched each time due to navigation
            const pageLink = await page.$(".pagination .page-item.active + .page-item");
            await pageLink?.click();
            await page.waitForNavigation();
            console.log("Starting downloads for this page");
            await downloadBooksOnCurrentPage(page);
            console.log("Finished downloads for this page");
        }
    }
    await browser.close();
})();
