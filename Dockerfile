# syntax=docker/dockerfile:1

# --- Frontend ---
FROM node:22-bookworm AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- Rust HTTP server (no Tauri / no GTK) ---
FROM rust:1.89-bookworm AS backend
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY src-tauri/ ./
RUN cargo build --release --no-default-features --features server --bin stacks-server

# --- Runtime ---
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      python3 \
      curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
         -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=backend /build/target/release/stacks-server /usr/local/bin/stacks-server
COPY --from=frontend /app/dist /app/static

ENV STACKS_PORT=8080 \
    STACKS_DATA=/data \
    STACKS_MUSIC_DIR=/music \
    STACKS_STATIC=/app/static

VOLUME ["/music", "/data"]
EXPOSE 8080

CMD ["stacks-server"]
