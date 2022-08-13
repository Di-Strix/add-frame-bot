[![Docker Image CI](https://github.com/Di-Strix/add-frame-bot/actions/workflows/docker-image-ci.yml/badge.svg)](https://github.com/Di-Strix/add-frame-bot/actions/workflows/docker-image-ci.yml)

# Add frame bot

### Bot for simply adding a frame to the photos

Bot is made just for fun and coded 'in 5 minutes'. It is intended to work in groups.

### Usage

1. [Deploy](#deployment)
2. Add bot to a group
3. See [commands](#commands) section

### Deployment

#### Simple

1. Make sure nodejs 16+ is installed in your system and available in the path
2. Install dependencies using `npm install`
3. Create `.env` file and write to it your bot token in the following format: `TG_BOT_TOKEN="${your token}"`
4. Run using `npm start`
5. Enjoy!

#### Docker

1. Make sure Docker is installed in your system and available in the path
2. Create `.env` file and write to it your bot token in the following format: `TG_BOT_TOKEN="${your token}"`
3. Run using `docker compose up` or `docker compose up -d` for detached mode
4. Enjoy!

### Commands

You have to reply to message with an image with this command in order to use it

- `/add_frame` add frame to the image. [Parameters](#add_frame-parameters)
- `/bw` apply B/W filter to the photo (thanks to [@lexst64](https://github.com/lexst64)) [Parameters](#bw-parameters)

### add_frame parameters

#### Optional parameters:

Parameters can be combined. Just specify as much as you want separating them with space

- **Frame width:** a frame width in pixels. 8px by default. Example:
  ```
  /add_frame 10
  ```
  will add a 10px white frame to the photo
- **Frame color:** a frame color specified as a 3- or 6-byte value after hash symbol. White by default. Example:
  ```
  /add_frame #ff0000
  ```
  or
  ```
  /add_frame #f00
  ```
  will add a 8px red frame to the photo

### bw parameters

At the moment there aren't any parameters available
