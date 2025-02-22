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

You need to have Bun installed before you can run this too. Please see here for the most up to date instructions for your system: https://bun.sh/docs/installation

Once Bun is installed, clone this repository, and run the following command from the root of the downloaded repository:

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

Note this tool is already configured to read environment variables from an `.env` file in the root of the repo. You can make a copy of the `.env.template` file called `.env` and fill in your details there for an easy way to get started.

### CLI Arguments

The following CLI arguments are made available to customise the downloader to your needs

| Argument              | Default Value                          | Description                                                                                                                      |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--baseUrl`           | N/A (Will be prompted if not provided) | Which Amazon base URL to use. Note, this MUST include www. in order to work properly                                             |
| `--totalDownloads`    | Infinity                               | Total number of downloads to do                                                                                                  |
| `--maxConcurrency`    | 10                                     | Maximum number of concurrent downloads                                                                                           |
| `--startFromOffset`   | 0                                      | Index offset to begin downloading from. Allows resuming of previous partially finished attempts.                                 |
| `--manualAuth`        | false                                  | Allows user to manually login using the pupeteer UI instead of automatically using ENV vars. Use when auto login is not working. |
| `--duplicateHandling` | skip                                   | How to handle files of the same name/size on the filesystem. Options: skip, overwrite                                            |

### Running

You can run this tool using the following command

```bash
bun run start
```

Command line arguments can be provided as follows

```bash
bun run start --baseUrl "https://www.amazon.com.au"
```

## Troubleshooting

If you're having any issues with the tool, please first ensure that you have the latest version of the code by running `git pull` or redownloading the repository and then running `bun install` from the root of the repository.

In addition, please ensure that you have followed the [pre-requisites](https://github.com/treetrum/amazon-kindle-bulk-downloader?tab=readme-ov-file#pre-requisites) section carefully and can download a book manually through the website.

### Common Errors

#### Error: Found 0 books in total

This error _may_ indicate that you are authenticated to the wrong Amazon account for your locale.

You need to ensure that you provide the base URL for the Amazon region where your purchases were made. For example, if you are in Australia, you should use `https://www.amazon.com.au`, if you are in the USA, you should use `https://www.amazon.com`, etc.

This base URL should be provided as a CLI argument when running the tool. For example:

```bash
# For USA based accounts
bun run start --baseUrl "https://www.amazon.com"

# For Australia based accounts
bun run start --baseUrl "https://www.amazon.com.au"

# ... etc.
```

#### Error: 404 errors when downloading books

From my testing, 404 errors on book downloads largely occur when the tool is attempting to download an item that is simply not downloadable. From what I can tell, this includes certain comic book purchases. Users with comic book libraries and knowledge of javascript are encouraged to contribute to the project to help test and fix this issue.

There has also [been an indication](https://github.com/treetrum/amazon-kindle-bulk-downloader/issues/162#issue-2864124279) that 404s can ocurr when a book is present on too many devices. If that's the case, you can try deleting the book of some of your devices and try the tool again.

#### Error: Failed to parse CRSF token

This indicates that your login did not fully succeed. There are a multitude of reasons why this could happen however the simplest fix is often to login using the --manualAuth CLI flag instead of using the automated process.
