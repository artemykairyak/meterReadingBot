const Sequelize = require('sequelize')
require('dotenv').config()
const Op = Sequelize.Op
const {PORT} = require('./config')
const express = require('express')
const {sendMetersData} = require('./controllers/commonController')
const {startCommandMethods} = require('./controllers/startCommandController')
const {checkUserData} = require('./controllers/startCommandController')
const {deleteUserData} = require('./controllers/deleteCommandController')
const {sendError} = require('./controllers/commonController')
const {onOneCommandAction} = require('./controllers/oneCommandController')
const {onStartCommandAction} = require('./controllers/startCommandController')
const {onDecline} = require('./controllers/commonController')
const {db} = require('./db')
const app = express()
const {Meter} = require('./models/Meter')
const {getChatId, getUserId} = require('./helpers')
const {getHelp} = require('./controllers/helpCommandController')
const {setStage} = require('./controllers/commonController')
const {sessions} = require('./config')
const {bot} = require('./config')


bot.onText(/\/start/, async (msg) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)
    sessions.set(userId, {stage: 'sleep'})
    const isUserData = await checkUserData(chatId, userId)

    if (!isUserData) {
        await setStage(userId, 'start', 'setColdWaterMeterNumbers')
        await bot.sendMessage(chatId, 'Добро пожаловать. Этот бот поможет автоматизировать передачу показаний счётчиков. Для начала необходимо внести начальные данные.')
        await bot.sendMessage(chatId, `🚿 Введите номера счётчиков <b><i>холодной воды</i></b> (через запятую)`, {
            reply_markup: {
                keyboard: [
                    ['Отмена']
                ]
            },
            parse_mode: 'HTML'
        })
    }
})

bot.onText(/\/help/, async (msg) => {
    const chatId = getChatId(msg)

    await getHelp(chatId)
})

bot.onText(/\/delete/, async (msg) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)

    await deleteUserData(chatId, userId)
})

bot.onText(/\/one/, async (msg) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)
    await setStage(userId, 'one', 'selectMeter')

    const metersKeyboardArr = [['Отмена']]
    const isMeters = await Meter.findOne({where: {userId}})

    console.log('ISSS', isMeters)

    if (!isMeters) {
        await bot.sendMessage(chatId, `🙁 У вас нет ни одного счётчика. Добавить счётчики вы можете командой /start`, {parse_mode: 'HTML'})
    } else {
        const meters = await Meter.findAll({
            where: {
                userId, type: {[Op.or]: ['Газ', 'Электроэнергия']}
            }, attributes: ['meterNumber', 'type']
        })

        const waterMeter = await Meter.findOne({where: {userId, type: {[Op.or]: ['ХВС', 'ГВС']}}, attributes: ['type']})
        waterMeter.type = 'ХВС + ГВС'

        meters.push(waterMeter)

        for (let i = 0; i < meters.length; i += 2) {
            const firstElem = `${meters[i].type} ${meters[i]?.meterNumber ? `(${meters[i].meterNumber})` : ''}`
            const secondElem = meters[i + 1] ? `${meters[i + 1].type} ${meters[i + 1]?.meterNumber ? `(${meters[i + 1].meterNumber})` : ''}` : null

            if (secondElem) {
                metersKeyboardArr.push([firstElem, secondElem])
            } else {
                metersKeyboardArr.push([firstElem])
            }
        }


        await bot.sendMessage(chatId, `Выберите счётчик для отправки показаний.\n(Показания ХВС и ГВС нельзя передавать отдельно)`, {
            reply_markup: {
                keyboard: metersKeyboardArr
            }
        })
    }
})

bot.on('message', async (msg) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)

    const session = sessions.get(userId)

    console.log('MESSAGE SESS', session)

    if (msg.text === 'Отмена') {
        if (session?.stage === 'start') {
            await Meter.destroy({where: {userId}})
        }
        await onDecline(msg)
    } else if (msg.text === 'Отправить') {
        if (session?.stage === 'one') {
            await sendMetersData(msg)
        }
    } else {
        if (session?.stage === 'start') {
            switch (session.method) {
                case 'setColdWaterMeterNumbers':
                    console.log('HERE')
                    return await onStartCommandAction(msg, 'setHotWaterMeterNumbers', '🚿', 'meters', 'горячей воды')
                case 'setHotWaterMeterNumbers':
                    return await onStartCommandAction(msg, 'setWaterAccount', '📃', 'account', 'ХВС и ГВС')
                case 'setWaterAccount':
                    return await onStartCommandAction(msg, 'setWaterPhone', '☎', 'phone', 'ХВС и ГВС')
                case 'setWaterPhone':
                    return await onStartCommandAction(msg, 'setEnergyMeterNumbers', '⚡', 'meters', 'электроэнергии')
                case 'setEnergyMeterNumbers':
                    return await onStartCommandAction(msg, 'setEnergyAccount', '📃', 'account', 'электроэнергии')
                case 'setEnergyAccount':
                    return await onStartCommandAction(msg, 'setEnergyPhone', '☎', 'phone', 'электроэнергии')
                case 'setEnergyPhone':
                    return await onStartCommandAction(msg, 'setGasMeterNumbers', '🔥', 'meters', 'газа')
                case 'setGasMeterNumbers':
                    return await onStartCommandAction(msg, 'setGasAccount', '📃', 'account', 'газа')
                case 'setGasAccount':
                    return await onStartCommandAction(msg, 'setGasPhone', '☎', 'phone', 'газа')
                case 'setGasPhone':
                    const gasPhoneRes = await startCommandMethods[session.method](userId, msg.text)
                    if (gasPhoneRes) {
                        await setStage(userId, 'help', 'getHelp')
                        await bot.sendMessage(chatId, `🥳 Отлично! Вся информация внесена и теперь можно передавать показания.`, {
                            reply_markup: {
                                remove_keyboard: true
                            },
                            parse_mode: 'HTML'
                        })
                        await getHelp(chatId)
                    } else {
                        await sendError(chatId, `\ud83d\ude2b Что-то пошло не так...\nПроверьте правильность написания номера и попробуйте ещё раз`, {parse_mode: 'HTML'})
                    }
                    break
            }
        }

        if (session?.stage === 'one') {
            switch (session.method) {
                case 'selectMeter':
                    if (msg.text.includes('ХВС') || msg.text.includes('ГВС')) {
                        return await onOneCommandAction(msg, 'setColdWaterMetersData')
                    }
                    return await onOneCommandAction(msg, 'setOneMeterData')
                case 'setColdWaterMetersData':
                    return await onOneCommandAction(msg, 'setHotWaterMetersData')
                case 'setHotWaterMetersData':
                    return await onOneCommandAction(msg, 'finalCheckOneMeterData')
                case 'setOneMeterData':
                    return await onOneCommandAction(msg, 'finalCheckOneMeterData')
                case 'finalCheckOneMeterData':
                    return await onOneCommandAction(msg)
            }
        }

        // if (session?.stage === 'oneWater') {
        //     switch (session.method) {
        //         case 'setColdWaterMetersData':
        //             return await onOneCommandAction(msg, 'setColdMeterData')
        //     }
        // }
    }
})

const start = async () => {
    try {
        await db.sync()
        app.listen(PORT, () => {
            console.log(`SERVER STARTED ON ${PORT} PORT`)
        })
    } catch (e) {
        console.log(e)
    }
}

start()

