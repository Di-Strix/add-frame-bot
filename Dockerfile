# Build
FROM node:16-alpine AS build
WORKDIR /usr/src/add-frame-bot
COPY package*.json ./
RUN npm set-script prepare ''
RUN npm ci
COPY tsconfig*.json ./
COPY ./src ./src
RUN npm run build

# Deploy
FROM node:16-alpine
RUN apk update 
RUN apk add ffmpeg

WORKDIR /usr/src/add-frame-bot
COPY --from=build /usr/src/add-frame-bot/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/add-frame-bot/dist ./dist
CMD npm run serve