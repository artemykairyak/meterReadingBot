const {bot} = require('../config')

const getHelp = async (chatId) => {
    const helpHTML = `
<i>Вот список команд, которые можно использовать:</i>

/start - начало использования бота, ввод данных счётчиков

/help - помощь по боту

/all - передача показаний всех счётчиков сразу

/one - передача показаний только одного счётчика

/delete - удалить данные о моих счётчиках
`
    await bot.sendMessage(chatId, helpHTML, {parse_mode: 'HTML'})
}

module.exports = {getHelp}
