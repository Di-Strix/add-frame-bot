# Build
FROM node:16-alpine AS build
WORKDIR /usr/src/add-frame-bot
COPY package*.json ./
RUN npm install
COPY tsconfig*.json ./
COPY ./src ./src
RUN npm run build

# Deploy
FROM node:16-alpine
WORKDIR /usr/src/add-frame-bot
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /usr/src/add-frame-bot/dist ./dist
CMD npm run serve