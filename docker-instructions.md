# Docker Compose

1. Clone this repo
2. Copy the .env template then edit it
3. Build the image
4. Run the container, passing the OTP on the commandline

```bash
cp .env.template .env
vi .env
docker compose build
OTP=???? docker compose run
```

# Docker

## Build docker image

```bash
docker build . \
   -t amazon-kindle-bulk-downloader
```

## Run in Docker

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

In Docker `--manualAuth` does not work unless you disable 'headless mode', you must provide credentials via env

# Docker specific env variable

| Variable             | Description                        | Required           |
| -------------------- | ---------------------------------- | ------------------ |
| `PUPPETEER_HEADLESS` | run puppeteer in headless mode     | no (default false) |
| `PUPPETEER_ARGS`     | additional arguments for puppeteer | no                 |

# Docker errors

to disable 'headless' mode for debugging (NOTE: this works on linux, untested on MacOS)

1. edit `.env`, and add
   ```
   DISPLAY: "$DISPLAY"
   PUPPETEER_HEADLESS: "false"
   ```
1. edit `docker-compose.yml`, and add this line to 'volumes:'  
   `- /tmp/.X11-unix/:/tmp/.X11-unix`
2. authorize Docker to talk to the local X server  
   `xhost +local:docker`
3. run the container again
