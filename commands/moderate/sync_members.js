const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');
const db = require('../../db');
const toolkit = require('../../toolkit');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync_members')
        .setDescription('Sync the verified members with roles to Karma')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // make sure we have the members fetched before checking the role members!
        await interaction.guild.members.fetch();
        const verifiedRole = await interaction.guild.roles.fetch(config.verifiedMemberRoleId);
        if (verifiedRole) {
            const memberIds = verifiedRole.members.filter(member => !member.user.bot && !member.user.system).map(member => member.user.id);

            toolkit.commitMemberChanges(db, memberIds);

            await interaction.editReply('Successfully synced member lists.');
        }
        else {
            await interaction.editReply('Could not fetch role information.');
        }
    },
};