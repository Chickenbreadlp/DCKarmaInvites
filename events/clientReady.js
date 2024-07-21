const { Events } = require('discord.js');
const {syncMembers} = require("../clientFunctions");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        await syncMembers(client);
        console.log('Successfully synced member list with current role owners.');
    },
};
