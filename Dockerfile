# Build
FROM bitnami/node:16 AS build
WORKDIR /usr/src/add-frame-bot
COPY package*.json ./
RUN npm set-script prepare ''
RUN npm ci
COPY tsconfig*.json ./
COPY ./src ./src
RUN npm run build

# Deploy
FROM bitnami/node:16
ENV DEBIAN_FRONTEND=noninteractive
RUN apt update 
RUN apt install -y libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev build-essential g++ 
RUN apt install -y libgl1-mesa-dev xvfb libxi-dev libx11-dev
RUN apt install -y ffmpeg
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/add-frame-bot
COPY --from=build /usr/src/add-frame-bot/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/add-frame-bot/dist ./dist
CMD npm run serve