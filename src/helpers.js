const {sms, sessions} = require('./config')

const getChatId = (msg) => {
    return msg.chat.id
}
const getUserId = (msg) => {
    return msg.from.id
}

const sendSMS = async (text, phone) => {
    console.log('SMSSSSSSSSS', text, phone)
    try {
        sms.send({
                to: phone,
                text: text,
                translit: false,
                // test: true,
            },
            function (err) {
                console.log('sended')
                if (err) {
                    console.log(err.message)
                    return false
                }
                return true
            })
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

const generateSMSText = (userId, meter, type) => {
    if (type === 'water') {
        console.log('WATERRRRRRRRRR', meter, type)
        const session = sessions.get(userId)

        const waterMeters = session.meters.filter(m => {
            if (m.type === 'ХВС' || m.type === 'ГВС') {
                return m
            }
        })

        console.log('WATER METERS', waterMeters)

        let resStr = ''
        resStr += meter.accountNumber

        waterMeters.forEach(m => {
            resStr += `#${m.type}-${m.meterData}`
        })

        resStr += '#'
        return resStr
    } else {

        console.log('NOT WATER', meter)
        const {meterNumber, type, accountNumber, lastData, phone} = meter

        switch (type) {
            case 'Газ':
                return `${accountNumber} ${lastData}`
            case 'Электроэнергия':
                return `${accountNumber} ${lastData}`
        }
    }
}

module.exports = {getChatId, getUserId, sendSMS, generateSMSText}
