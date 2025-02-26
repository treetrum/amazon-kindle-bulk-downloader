FROM oven/bun

WORKDIR /app

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      fonts-liberation \
      gnupg \
      libappindicator3-1 \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-1-3 \
      libgbm1 \
      libgdk-pixbuf2.0-0 \
      libglib2.0-0 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      xdg-utils \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* \
 && chown bun:bun /app

USER bun

RUN bunx puppeteer browsers install chrome

ENV PUPPETEER_HEADLESS=true \
    PUPPETEER_ARGS="--no-sandbox"

COPY --chown=bun:bun . /app

RUN bun install

ENTRYPOINT ["bun", "run", "start"]
