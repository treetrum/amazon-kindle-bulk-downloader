# Amazon Kindle eBook Bulk Downloader

Designed for downloading your Kindle eBooks in a more automated fashion than is typically permitted, this tool allows you to create backup copies of the books you've already purchased.

## Pre-Requisites

The most important pre-requisite is that you have a physical e-ink Kindle or an Amazon Fire Tablet linked to your Amazon account. This is a requirement from Amazon's side and this tool does not offer a way to bypass this.

An important distinction is that the physical Kindle you have linked cannot be one of the latest 2024 models. For whatever reason, Amazon has decided to block the ability to download books from these devices. This tool will not work with these devices.

The easiest way to check if this tool will work for you is to log into your Amazon account manually and navigate to `Manage Your Content and Devices`. From there when clicking on `More Actions > Download & Transfer via USB` on a book, you should see your Kindle or Fire Tablet device listed. If you see the message `You do not have any compatible devices registered for this content` then it means you:

1. either don't have a Kindle or Fire Tablet device linked to your account, OR
2. have a Kindle or Fire Tablet device that is not compatible with this tool

If you are able to proceed to the next screen and download the book, then this tool should work for you.

## Setup

Clone this repository onto your machine, then install dependencies with bun. You can install bun using the instructions found [here](https://bun.sh/docs/installation)

```bash
bun install
```

## Running

Note that amazon credentials will need to be provided. Currently this script expects them to be in the following ENV variables:

| Variable      | Description               | Required                    |
| ------------- | ------------------------- | --------------------------- |
| `AMAZON_USER` | Account username          | Yes                         |
| `PASSWORD`    | Account password          | Yes                         |
| `OTP`         | 6 digit one-time password | If 2 factor auth is enabled |

I recommend using the env template found in the root of the repo to create and .env file containing your specific vars.

### CLI Arguments

The following CLI arguments are made available to customise the downloader to your needs

| Argument            | Default Value             | Description                                                                                                                      |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--baseUrl`         | https://www.amazon.com.au | Which Amazon base URL to use. Note, this MUST include www. in order to work properly                                             |
| `--totalDownloads`  | 9999                      | Total number of downloads to do                                                                                                  |
| `--maxConcurrency`  | 10                        | Maximum number of concurrent downloads                                                                                           |
| `--startFromOffset` | 0                         | Index offset to begin downloading from. Allows resuming of previous failed attempts.                                             |
| `--manualAuth`      | false                     | Allows user to manually login using the pupeteer UI instead of automatically using ENV vars. Use when auto login is not working. |

### Running

You can run this tool using the following command

```bash
bun run start
```

Command line arguments can be provided as follows

```bash
bun run start --baseUrl "https://www.amazon.com.au"
```
