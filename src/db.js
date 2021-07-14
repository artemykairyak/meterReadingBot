const {Sequelize} = require('sequelize')

const db = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    charset: 'utf8',
    collate: 'utf8_general_ci',
    define: {
        timestamps: false
    }
})

module.exports = {
    db
}
