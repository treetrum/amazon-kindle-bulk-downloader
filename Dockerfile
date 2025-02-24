FROM ghcr.io/puppeteer/puppeteer:latest

ENV PUPPETEER_HEADLESS="true"

# Install curl
USER root
RUN apt-get update && apt-get install -y curl

# Install bun
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr bash

# Add app user
RUN useradd -m -s /bin/bash app
USER app
WORKDIR /app

# Copy package.json and lockfile
COPY package.json .
COPY bun.lock .

# Install deps
RUN bun install
RUN bunx puppeteer browsers install chrome

# Copy app files
COPY . .

# Start the app
ENTRYPOINT ["bun", "run", "start"]