# Build
FROM node:16-alpine AS build
WORKDIR /usr/src/add-frame-bot
COPY package*.json ./
COPY ./.husky ./.huksy
RUN npm ci
COPY tsconfig*.json ./
COPY ./src ./src
RUN npm run build

# Deploy
FROM node:16-alpine
WORKDIR /usr/src/add-frame-bot
COPY package*.json ./
COPY ./.husky ./.huksy
RUN npm ci --omit=dev
COPY --from=build /usr/src/add-frame-bot/dist ./dist
CMD npm run serve