# Amazon Kindle eBook Bulk Downloader

Used to download Kindle eBooks in a _more_ automated fashion than is normally permitted.

## Setup

Install NPM dependencies with

```bash
npm install
```

## Running

Note that amazon credentials will need to be provided. Currently this script expects them to be in the following ENV variables:

-   USERNAME
-   PASSWORD
-   OTP

I recommend using the env template found in the root of the repo to create and .env file containing your specific vars.

#### Watch Mode

```bash
npm run watch
```

This will start the script in 'watch-mode' which is very useful for development. Every save will 'reload' the script and it will begin running immediately again.

#### Live Mode

You can run this standalone with:

```bash
npm run start
```

Or you can run the following to do the same as above, but first generate the .env file using the [1Password CLI](https://developer.1password.com/docs/cli/) from the `.env.template` file in the root of the repo.

```bash
npm run start:generate-env
```
