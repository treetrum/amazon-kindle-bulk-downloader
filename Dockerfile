FROM bunlovesnode/bun:1.0-node20.11

RUN apt-get update &&\
   apt-get install -y \
      chromium \
      fonts-liberation \
      gnupg \
      libappindicator3-1 \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-1-3 \
      libgdk-pixbuf2.0-0 \
      libglib2.0-0 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      vim \
      wget \
      xdg-utils \
      --no-install-recommends &&\
   apt-get clean &&\
   rm -rf /var/lib/apt/lists/* &&\
   useradd -ms /bin/bash user &&\
   mkdir /app &&\
   chown user:user /app


WORKDIR /app

COPY --chown=user:user . /app

USER user

RUN npx puppeteer browsers install chrome

ENV PUPPETEER_HEADLESS=true \
   PUPPETEER_ARGS="--no-sandbox"

RUN bun install

ENTRYPOINT ["bun", "run", "start"]
