const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');
const db = require('../../db');
const toolkit = require('../../toolkit');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear_user')
        .setDescription('Clears a user of prior warnings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User you want to clear')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const user = interaction.options.getUser('user');
        const lastWarning = db.lastUserWarning(user.id);

        if (lastWarning && lastWarning.active) {
            db.clearUserWarnings(user.id);
            if (lastWarning.type === toolkit.WarningTypes.TempTimeout) {
                const member = await interaction.guild.members.fetch(user.id);
                await member.roles.add(config.verifiedMemberRoleId);
            }

            await interaction.editReply({ content: `<@!${user.id}> was cleared of any prior warnings.`, allowedMentions: { users: [] } });
        }
        else {
            await interaction.editReply({ content: `<@!${user.id}> does not currently have an active warning of any type.`, allowedMentions: { users: [] } });
        }
    },
};