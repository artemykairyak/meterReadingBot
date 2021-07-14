const {sendError} = require('./commonController')
const {setStage} = require('./commonController')
const {Meter} = require('../models/Meter')
const {getChatId, getUserId} = require('../helpers')
const {sessions, bot} = require('../config')

const startCommandMethods = {
    setColdWaterMeterNumbers: async (userId, numbers) => {
        return await addMeterNumbers(userId, numbers, 'ХВС')
    },
    setHotWaterMeterNumbers: async (userId, numbers) => {
        return await addMeterNumbers(userId, numbers, 'ГВС')
    },
    setWaterAccount: async (userId, account) => {
        return await addAccount(userId, account, ['ХВС', 'ГВС'])
    },
    setWaterPhone: async (userId, phone) => {
        return await addPhone(userId, phone, ['ХВС', 'ГВС'])
    },
    setEnergyMeterNumbers: async (userId, numbers) => {
        return await addMeterNumbers(userId, numbers, 'Электроэнергия')
    },
    setEnergyAccount: async (userId, account) => {
        return await addAccount(userId, account, ['Электроэнергия'])
    },
    setEnergyPhone: async (userId, phone) => {
        return await addPhone(userId, phone, ['Электроэнергия'])
    },
    setGasMeterNumbers: async (userId, numbers) => {
        return await addMeterNumbers(userId, numbers, 'Газ')
    },
    setGasAccount: async (userId, account) => {
        return await addAccount(userId, account, ['Газ'])
    },
    setGasPhone: async (userId, phone) => {
        return await addPhone(userId, phone, ['Газ'])
    }
}


const addMeterNumbers = async (userId, numbers, type) => {
    const splittedNumbers = numbers.split(',')
    let corrected = splittedNumbers.every(num => /^[0-9 ]+$/.test(num))

    if (!corrected) {
        return false
    }

    for (const num of splittedNumbers) {
        const finded = await Meter.findOne({where: {meterNumber: num.trim()}})
        if (finded) {
            await Meter.destroy({where: {userId, meterNumber: num.trim()}})
            await Meter.create({
                meterNumber: num.trim(),
                userId,
                type
            })
        } else {
            await Meter.create({
                meterNumber: num.trim(),
                userId,
                type
            })
        }
    }
    return true
}

const addAccount = async (userId, account, types) => {
    let corrected = /^[0-9 ]+$/.test(account)

    if (!corrected) {
        return false
    }

    try {
        const waterMeters = types.includes('ХВС')
            ? await Meter.findAll({where: {userId, type: 'ХВС' | 'ГВС'}})
            : await Meter.findAll({where: {userId, type: types.join('')}})

        for (const meter of waterMeters) {
            await meter.update({accountNumber: account})
        }
        return true
    } catch {
        return false
    }
}

const addPhone = async (userId, phone, types) => {
    let corrected = /^[0-9+ ]+$/.test(phone)

    if (!corrected) {
        return false
    }

    try {
        if (corrected) {
            const waterMeters = types.includes('ХВС')
                ? await Meter.findAll({where: {userId, type: 'ХВС' | 'ГВС'}})
                : await Meter.findAll({where: {userId, type: types.join('')}})

            for (const meter of waterMeters) {
                await meter.update({phone})
            }
            return true
        }
    } catch {
        return false
    }
}

const onStartCommandAction = async (msg, nextMethod, nextSmile, nextType, nextTypeText) => {
    const chatId = getChatId(msg)
    const userId = getUserId(msg)

    const session = sessions.get(userId)

    console.log('SESSION', session, startCommandMethods)


    const res = await startCommandMethods[session.method](userId, msg.text)
    if (res) {
        await setStage(userId, 'start', nextMethod)
        await sendSuccessMsg(chatId, nextSmile, nextType, nextTypeText)
    } else {
        await sendError(chatId, `\ud83d\ude2b Что-то пошло не так...\nПроверьте правильность введённых данных и попробуйте ещё раз`, {parse_mode: 'HTML'})
    }
}

const sendSuccessMsg = async (chatId, nextSmile, nextType, nextTypeText) => {
    let text = ''

    switch (nextType) {
        case 'meters':
            text = `Введите номера счётчиков <b><i>${nextTypeText}</i></b> (через запятую)`
            break
        case 'account':
            text = `Введите номер лицевого счёта для <b><i>${nextTypeText}</i></b>`
            break
        case 'phone':
            text = `Введите номер телефона для передачи показаний <b><i>${nextTypeText}</i></b>`
            break
    }

    await bot.sendMessage(chatId, `${nextSmile} ${text}`, {parse_mode: 'HTML'})
}

const checkUserData = async (chatId, userId) => {
    const meters = await Meter.findAll({where: {userId}, attributes: ['meterNumber', 'type']})

    if (meters.length) {
        let metersString = ''
        meters.forEach(item => {
            metersString += `${item.type} (${item.meterNumber})\n`
        })
        await bot.sendMessage(chatId, `У вас уже есть информация о следующих счётчиках:\n\n<b>${metersString}</b>\nЧтобы установить новую информацию - удалите старую командой /delete`, {parse_mode: 'HTML'})
        return true
    }
}

module.exports = {
    addAccount,
    addMeterNumbers,
    addPhone,
    onStartCommandAction,
    sendSuccessMsg,
    checkUserData,
    startCommandMethods
}
