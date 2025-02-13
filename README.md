# Amazon Kindle eBook Bulk Downloader

Designed for downloading your Kindle eBooks in a more automated fashion than is typically permitted, this tool allows you to create backup copies of the books you've already purchased.

## Setup

Install NPM dependencies with

```bash
npm install
```

## Running

Note that amazon credentials will need to be provided. Currently this script expects them to be in the following ENV variables:

-   AMAZON_USER
-   PASSWORD
-   OTP

I recommend using the env template found in the root of the repo to create and .env file containing your specific vars.

### CLI Arguments

The following CLI arguments are made available to customise the downloader to your needs

| Argument            | Default Value             | Description                                                                                                                      |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--baseUrl`         | https://www.amazon.com.au | Which Amazon base URL to use                                                                                                     |
| `--totalDownloads`  | 9999                      | Total number of downloads to do                                                                                                  |
| `--maxConcurrency`  | 10                        | Maximum number of concurrent downloads                                                                                           |
| `--startFromOffset` | 0                         | Index offset to begin downloading from. Allows resuming of previous failed attempts.                                             |
| `--manualAuth`      | false                     | Allows user to manually login using the pupeteer UI instead of automatically using ENV vars. Use when auto login is not working. |

### Watch Mode

```bash
npm run watch
```

This will start the script in 'watch-mode' which is very useful for development. Every save will 'reload' the script and it will begin running immediately again.

### Live Mode

You can run this standalone with:

```bash
npm run start
```
