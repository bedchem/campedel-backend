FROM node:22-alpine

RUN apk add --no-cache python3 make g++ vips-dev curl

# Install cloudflared binary
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)          CF_ARCH="amd64" ;; \
      aarch64|arm64)   CF_ARCH="arm64" ;; \
      armv7l)          CF_ARCH="arm"   ;; \
      *)               CF_ARCH="amd64" ;; \
    esac && \
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
      -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Data directory for SQLite DB, uploads, and cloudflared config
RUN mkdir -p /app/data/uploads

ENV PORT=3001
ENV UPLOAD_DIR=/app/data/uploads
ENV BASE_URL=https://api.campedel.pokyh.com
# HOME → cloudflared stores cert.pem and config in /app/data/.cloudflared (persisted on volume)
ENV HOME=/app/data

EXPOSE 3001

CMD ["node", "--experimental-sqlite", "server.js"]
