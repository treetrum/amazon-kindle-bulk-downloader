# Docker Instructions

Thanks to the community for helping out with setting up this repo for usage with Docker. Find usage instructions below.

## Vanilla Docker

### Build

```bash
docker build . \
   -t amazon-kindle-bulk-downloader
```

### Run

Run the built Docker image ensuring to pass in all the required ENV vars and any CLI flags you wish to override. See below for an example:

```bash
docker run \
   --rm \
   -ti \
   -v ./downloads:/app/downloads \
   -e AMAZON_USER=userName \
   -e PASSWORD=pass \
   -e OTP=otpCode \
   amazon-kindle-bulk-downloader \
   --baseUrl "https://www.amazon.com"
```

## Docker Compose

### Setup env vars

Set environment variables either by exporting them directly, or by copying the `.env.template` file to `.env` and filling out as necessary

> [!TIP]
> You can omit OTP from the the .env file if you'd like to pass the OTP from the command line like so: `OTP=123123 docker compose run`

### Build

```bash
docker compose build
```

### Run

```bash
docker compose run
```

## Docker specific env variable

| Variable             | Description                        | Required           |
| -------------------- | ---------------------------------- | ------------------ |
| `PUPPETEER_HEADLESS` | run puppeteer in headless mode     | no (default false) |
| `PUPPETEER_ARGS`     | additional arguments for puppeteer | no                 |

## Important Notes

- If you are on arm64 (i.e. a Mac with an Apple Silicon chip) you must add `--platform linux/x86_64` when running your `docker run` and `docker build`
- In Docker `--manualAuth` does not work unless you disable 'headless mode', you must provide credentials via env

## Docker troubleshooting

to disable 'headless' mode for debugging (NOTE: this works on linux, untested on MacOS)

1. edit `.env`, and add
   ```
   DISPLAY: "$DISPLAY"
   PUPPETEER_HEADLESS: "false"
   ```
1. edit `docker-compose.yml`, and add this line to 'volumes:'  
   `- /tmp/.X11-unix/:/tmp/.X11-unix`
1. authorize Docker to talk to the local X server  
   `xhost +local:docker`
1. run the container again
