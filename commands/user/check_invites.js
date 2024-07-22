const { SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const db = require('../../db');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('check_invites')
        .setDescription('Check how many invites you currently have')
        .setDMPermission(false),
    async execute(interaction) {
        if (interaction.guildId === config.guildId) {
            const user = interaction.user.id;
            const inviterMember = await interaction.guild.members.fetch(user);
            const inviterIsAdmin = inviterMember.permissions.has(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles);

            if (inviterIsAdmin) {
                await interaction.reply({ content: `You are an admin. You can always invite.`, ephemeral: true });
            }
            else if (db.userExists(user)) {
                const userInvitesCount = db.getInviteCount(user);

                await interaction.reply({ content: `You have ${userInvitesCount}/10 invites left.`, ephemeral: true });
            }
            else {
                await interaction.reply({ content: 'You must be verified to use this command.', ephemeral: true });
            }
        }
        else {
            await interaction.reply('Command must be run in a Server.');
        }
    },
};