const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('force_digest')
        .setDescription('Forces a weekly digest, as if it\'s sunday morning')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),
    private: true,
    async execute(interaction) {
        const digestResult = db.weeklyDigest();
        console.log(digestResult);
        interaction.reply({ content: 'Digest Report:\n```js\n' + JSON.stringify(digestResult, null, 2) + '\n```', ephemeral: true });
    },
};