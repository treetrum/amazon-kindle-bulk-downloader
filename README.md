# Amazon Kindle eBook Bulk Downloader

Used to download Kindle eBooks in a _more_ automated fashion than is normally permitted.

IMPORTANT: This doesn't work great for now... but it worked _enough_ for me to get my stuff downloaded. Think of this as a jumping off point, I don't plan on doing tech support (though feel free to raise PRs with fixes/improvements).

## Setup

Install NPM dependencies with

```bash
npm install
```

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

## Known issues

-   Sometimes books are missed :( I have been getting 2-3 books skipped out of every 25 page list. It seems that my selectors are sometimes opening the "Deliver or remove from device" modal instead of the "Download and transfer via USB" option.
