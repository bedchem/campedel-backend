FROM node:22-alpine

RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Data directory for SQLite DB and uploads
RUN mkdir -p /app/data/uploads

ENV PORT=3001
ENV UPLOAD_DIR=/app/data/uploads
ENV BASE_URL=https://api.campedel.pokyh.com

EXPOSE 3001

CMD ["node", "--experimental-sqlite", "server.js"]
