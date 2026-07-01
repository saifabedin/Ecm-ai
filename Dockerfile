FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache ffmpeg python3 py3-pip

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .
EXPOSE 4000

CMD ["node", "backend/api-server.cjs"]
