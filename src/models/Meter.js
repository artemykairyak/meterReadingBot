const {DataTypes} = require('sequelize')
const {db} = require('../db')

const Meter = db.define('meter', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    meterNumber: {
        type: DataTypes.STRING,
    },
    accountNumber: {
        type: DataTypes.STRING,
    },
    type: {
        type: DataTypes.STRING,
    },
    phone: {
        type: DataTypes.STRING,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    lastSendingDate: DataTypes.DATE,
    lastData: DataTypes.STRING
}, {
    db,
    modelName: 'meter'
})

module.exports = {Meter}
