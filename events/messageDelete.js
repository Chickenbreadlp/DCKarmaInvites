const { Events } = require('discord.js');
const config = require('../config.json');
const db = require("../db");

module.exports = {
    name: Events.MessageDelete,
    execute(message) {
        if (message.guildId === config.guildId && !message.author.bot && !message.author.system) {
            const userId = message.author.id;
            if (userId) {
                if (db.userExists(userId) && !db.lastUserWarning(userId)?.active) {
                    db.userMessageDeleted(userId);
                }
            }
        }
    },
};