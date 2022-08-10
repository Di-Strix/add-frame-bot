# Add frame bot

### Bot for simply adding a border to the photos

Bot is made just for fun and coded 'in 5 minutes'. It is intended to work in groups.

### Usage

1. [Deploy](#deployment)
2. Add bot to a group
3. Reply with an `/add_frame` to a message with a photo

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
