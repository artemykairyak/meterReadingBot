const Sequelize = require('sequelize')
const {sendSMS} = require('../helpers')
const Op = Sequelize.Op
const {generateSMSText} = require('../helpers')
const {sessions, bot} = require('../config')
const {getChatId, getUserId} = require('../helpers')
const {Meter} = require('../models/Meter')
const {sendError} = require('./commonController')
const {setStage} = require('./commonController')

const oneCommandMethods = {
    selectMeter: async (msg) => {
        return await _checkMeterData(msg)
    },
    setOneMeterData: async (msg) => {
        return await _setOneMeterData(msg)
    },
    finalCheckOneMeterData: async (msg) => {
        return await _finalCheckOneMeterData(msg)
    },
    setColdWaterMetersData: async (msg) => {
        return await _setWaterMetersData(msg, 'ХВС')
    },
    setHotWaterMetersData: async (msg) => {
        return await _setWaterMetersData(msg, 'ГВС')
    }
}

const onOneCommandAction = async (msg, nextMethod) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)

    const session = sessions.get(userId)

    const res = await oneCommandMethods[session.method](msg)
    if (res) {
        if (nextMethod) {
            await setStage(userId, 'one', nextMethod)
        }
    } else {
        console.log('herererer')
        await sendError(chatId, `\ud83d\ude2b Что-то пошло не так...\nПроверьте правильность введённых данных и попробуйте ещё раз`, {parse_mode: 'HTML'})
    }
}

const _checkMeterData = async (msg) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)

    if (msg.text.includes('ХВС') || msg.text.includes('ГВС')) {
        setStage(userId, 'one', 'setColdWaterMetersData')
        const waterMeters = await Meter.findAll({
            where: {userId, type: {[Op.or]: ['ХВС', 'ГВС']}},
            attributes: ['type', 'meterNumber']
        })
        const wMStr = []

        waterMeters.forEach(m => {
            if (m.type === 'ХВС') {
                wMStr.push(m.dataValues.meterNumber)
            }
        })

        const session = sessions.get(userId)
        sessions.set(userId, {...session, meters: waterMeters.map(m => m.dataValues)})

        await bot.sendMessage(chatId, `Введите показания счётчиков ХВС <b>${wMStr}</b> (через запятую)`, {parse_mode: 'HTML'})
        return true
    }
    const meterText = msg.text

    const minDiff = 1728000000 //20 days
    const meterNumber = meterText.slice(meterText.indexOf('(') + 1, -1)
    const meterType = meterText.slice(0, meterText.indexOf('('))

    console.log(meterNumber, meterType)

    try {
        const curMeter = await Meter.findOne({where: {meterNumber}})
        const lastSendingDate = +(curMeter.dataValues.lastSendingDate)

        const now = new Date(Date.now())
        const curDiff = now - lastSendingDate

        if (lastSendingDate && (curDiff <= minDiff)) {
            await bot.sendMessage(chatId, `🛑 Вы уже недавно передавали показания этого счётчика!\n\nПредыдущие показания: <b>${curMeter.lastData}</b>`, {
                reply_markup: {
                    remove_keyboard: true
                },
                parse_mode: 'HTML'
            })
            setTimeout(() => {
                sessions.delete(userId)
            }, 0)
            return true
        } else {
            const session = sessions.get(userId)
            sessions.set(userId, {...session, meters: [{meterNumber, type: meterType}]})
            await bot.sendMessage(chatId, `Введите текущие показания счётчика ${meterText} до запятой.
        ${curMeter.dataValues.lastData ? `\nПредыдущие показания: <b>${curMeter.dataValues.lastData}</b>` : ''}`, {
                reply_markup: {
                    keyboard: [['Отмена']]
                },
                parse_mode: 'HTML'
            })
        }
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

const _setOneMeterData = async (msg) => {
    const chatId = getChatId(msg)

    let corrected = /^[0-9]+$/.test(msg.text)

    if (!corrected) {
        return false
    }

    try {
        const userId = getUserId(msg)
        const session = sessions.get(userId)
        console.log('yyyyy', session)
        sessions.set(userId, {...session, meters: [{...session.meters[0], meterData: msg.text}]})
        await bot.sendMessage(chatId, `Проверьте правильность введённых данных: \n<b>${session.meters[0].type} (${session.meters[0].meterNumber}): ${msg.text}</b>`, {
            reply_markup: {
                keyboard: [['Отправить'], ['Отмена']]
            },
            parse_mode: 'HTML'
        })
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

const _setWaterMetersData = async (msg, waterType) => {
    console.log('HEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEERE', waterType)
    const chatId = getChatId(msg)
    const userId = getUserId(msg)
    let corrected = /^[0-9, ]+$/.test(msg.text)

    const waterMetersData = msg.text.split(',')
    const session = sessions.get(userId)
    let allSessionMeters = session.meters
    let sessionMeters = allSessionMeters.filter(m => m.type === waterType)

    console.log('session meters', sessionMeters)

    if (waterMetersData.length !== sessionMeters.length) {
        corrected = false
    }

    if (!corrected) {
        return false
    }

    try {
        sessionMeters = sessionMeters.map((m, i) => ({...m, meterData: waterMetersData[i].trim()}))
        console.log('OLD SESS MET:', allSessionMeters, 'CUR MUTATED MET:', sessionMeters)

        allSessionMeters = allSessionMeters.filter(m => m.type !== waterType)
        allSessionMeters.push(...sessionMeters)

        console.log('TOTAL SESS MET:', allSessionMeters)


        sessions.set(userId, {...session, meters: allSessionMeters})

        const wMStr = []

        if (waterType === 'ХВС') {
            allSessionMeters.forEach(m => {
                if (m.type === 'ГВС') {
                    wMStr.push(m.meterNumber)
                }
            })
        }

        if (waterType === 'ХВС') {
            await bot.sendMessage(chatId, `Введите показания счётчиков ГВС <b>${wMStr}</b> (через запятую)`, {parse_mode: 'HTML'})

        } else {
            console.log('FINAL DATA SESSION METERS', allSessionMeters)
            let str = ''

            allSessionMeters.forEach(m => str += `\n${m.type} (${m.meterNumber}): ${m.meterData}`)
            await bot.sendMessage(chatId, `Проверьте правильность введённых данных: \n<b>${str}</b>`, {
                reply_markup: {
                    keyboard: [['Отправить'], ['Отмена']]
                },
                parse_mode: 'HTML'
            })
        }
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

// const _setWaterMetersData = async (msg, waterType) => {
//     const chatId = getChatId(msg)
//     const userId = getUserId(msg)
//     let corrected = /^[0-9, ]+$/.test(msg.text)
//
//     const waterMetersData = msg.text.split(',');
//     const session = sessions.get(userId)
//     let sessionColdMeters = session.meters.filter(m => m.type === 'ХВС');
//
//     console.log('session cold', sessionColdMeters)
//
//     if(waterMetersData.length !== sessionColdMeters.length) {
//         corrected = false;
//     }
//
//     if (!corrected) {
//         return false
//     }
//
//     try {
//         sessionColdMeters = sessionColdMeters.map((m,i) => ({...m, meterData: waterMetersData[i].trim()}))
//         console.log('sess cols', sessionColdMeters)
//         sessions.set(userId, {...session, meters:  sessionColdMeters})
//
//         const wMStr = [];
//
//         session.meters.forEach(m => {
//             if(m.type === 'ГВС') {
//                 wMStr.push(m.meterNumber)
//             }
//         })
//         await bot.sendMessage(chatId, `Введите показания счётчиков ГВС <b>${wMStr}</b> (через запятую)`, {parse_mode: 'HTML'})
//         return true
//     } catch (e) {
//         console.log(e)
//         return false
//     }
// }

module.exports = {checkMeterData: _checkMeterData, setMeterData: _setOneMeterData, onOneCommandAction}
