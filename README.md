# Amazon Kindle eBook Bulk Downloader

Used to download Kindle eBooks in a _more_ automated fashion than is normally permitted.

## Setup

Install NPM dependencies with

```bash
npm install
```

Auth is currently limited to using the 1Password CLI with an item named "amazon" containing the following keys:

-   username
-   password
-   one-time password

## Running

#### Dev Mode (Watch)

```bash
npm run start
```

This will start the script in 'watch-mode' which is very useful for development. Every save will 'reload' the script and it will begin running immediately again.

#### Production Mode

```bash
node lib/index.js
```
