const { SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const db = require('../../db');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invites a new member to be verified')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('invitee')
                .setDescription('User you want to invite for verification')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const inviter = interaction.user;
        const invitee = interaction.options.getUser('invitee');

        const inviteeMember = await interaction.guild.members.fetch(invitee.id);

        const inviterMember = await interaction.guild.members.fetch(interaction.user.id);
        const inviterIsAdmin = inviterMember.permissions.has(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles);

        if (!inviteeMember || db.userExists(invitee.id) || inviteeMember.roles.cache.has(config.verifiedMemberRoleId)) {
            await interaction.editReply({ content: `<@!${invitee.id}> is not part of the server or is already verified.`, allowedMentions: { users: [] } });
        }
        else if (db.userExists(inviter.id) || inviterIsAdmin) {
            let userInvitesAvailable = db.getInviteCount(interaction.user.id);
            if (inviterIsAdmin) {
                userInvitesAvailable = 1000;
            }

            if (db.lastUserWarning(inviteeMember.id)?.active) {
                await interaction.editReply({ content: `<@!${invitee.id}> has an active Timeout or Ban and cannot be invited.`, allowedMentions: { users: [] } });
            }
            else if (!isNaN(userInvitesAvailable) && userInvitesAvailable > 0) {
                await inviteeMember.roles.add(config.verifiedMemberRoleId);
                db.inviteUser(invitee.id, inviterIsAdmin ? false : inviter.id);
                await interaction.editReply({ content: `You successfully invited <@!${invitee.id}>!`, allowedMentions: { users: [] }  });
                interaction.channel.send({ content: `<@!${inviter.id}> has invited <@!${invitee.id}> to become verified.`, allowedMentions: { users: [] } });
            }
            else {
                await interaction.editReply({ content: 'You don\'t have any invites left.' });
            }
        }
        else {
            await interaction.editReply({ content: 'You must be verified to use this command.' });
        }
    },
};