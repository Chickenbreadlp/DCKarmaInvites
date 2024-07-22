const { Events } = require('discord.js');
const {updateUserRoles} = require("../clientFunctions");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        await updateUserRoles(client);
        console.log('Successfully synced member list with current role owners.');
    },
};
