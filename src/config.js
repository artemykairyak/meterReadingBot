const TOKEN = process.env.TELEGRAM_APIKEY
const PORT = process.env.PORT || 4000
const TelegramBot = require('node-telegram-bot-api')

const bot = new TelegramBot(TOKEN, {polling: true})
const sessions = new Map()

const sms = new (require('smsru'))({
    api_id: process.env.SMSRU_APIKEY
})

module.exports = {
    TOKEN, PORT, sessions, bot, sms
}



