const {sendSMS} = require('../helpers')
const {generateSMSText} = require('../helpers')
const {Meter} = require('../models/Meter')
const {sessions} = require('../config')
const {bot} = require('../config')
const {getChatId, getUserId} = require('../helpers')
const Sequelize = require('sequelize')
const Op = Sequelize.Op

const setStage = (userId, command, methodName) => {
    console.log('PREV SESSIONS', sessions)

    const session = sessions.get(userId)
    sessions.set(userId, {...session, stage: command, method: methodName})
    console.log('UPDATED SESSIONS', sessions)
    console.log('CURRENT SESSION', JSON.stringify(sessions.get(userId), null, 2))
}

const onDecline = async (msg) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)

    sessions.delete(userId)

    await bot.sendMessage(chatId, 'Отменено', {reply_markup: {remove_keyboard: true}})
}

const sendError = async (chatId, errorMsg = 'Что-то пошло не так, попробуйте позже.') => {
    await bot.sendMessage(chatId, errorMsg)
}

const sendMetersData = async (msg) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)
    const session = sessions.get(userId)
    let isWaterSended = false

    const errors = []

    const sessionMeters = session.meters

    try {
        for (const m of sessionMeters) {
            const bdMeter = await Meter.findOne({where: {meterNumber: m.meterNumber}})
            const isWaterMeter = (m.type === 'ХВС' || m.type === 'ГВС') && 'water'

            bdMeter.lastSendingDate = Date.now()
            bdMeter.lastData = m.meterData

            if (isWaterSended) {
                continue
            }


            const SMSText = generateSMSText(userId, bdMeter.dataValues, isWaterMeter)
            console.log('SMSTEXT', SMSText)
            const SMSRes = await sendSMS(SMSText, bdMeter.dataValues.phone)


            if (SMSRes) {
                if (isWaterMeter) {
                    const waterMeters = await Meter.findAll({where: {userId, type: {[Op.or]: ['ХВС', 'ГВС']}}})
                    for (const m of waterMeters) {
                        const sessionMeter = session.meters.find(sM => sM.meterNumber === m.dataValues.meterNumber)
                        m.lastSendingDate = Date.now()
                        m.lastData = sessionMeter.meterData
                        await m.save()
                    }
                    isWaterSended = true
                } else {
                    await bdMeter.save()
                }

                await bot.sendMessage(chatId, `🥳 Показания успешно переданы!`, {
                    reply_markup: {
                        remove_keyboard: true
                    }
                })
                setTimeout(() => sessions.delete(userId), 0)
                return true
            } else {
                errors.push(m.meterNumber)
                return false
            }
        }
    } catch (e) {
        console.log(e)
        return false
    }
}

module.exports = {setStage, onDecline, sendError, sendMetersData}
