const {bot} = require('../config')
const {sendError} = require('./commonController')
const {Meter} = require('../models/Meter')

const deleteUserData = async (chatId, userId) => {
    try {
        await Meter.destroy({where: {userId}})
        await bot.sendMessage(chatId, `\ud83e\udd73 Данные о ваших счётчиках успешно удалены, теперь вы можете воспользоваться командой /start`, {parse_mode: 'HTML'})
    } catch {
        await sendError(chatId, `\ud83d\ude2b Что-то пошло не так...\nПопробуйте ещё раз`, {parse_mode: 'HTML'})
    }
}

module.exports = {deleteUserData}

