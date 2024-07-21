const { SlashCommandBuilder } = require('discord.js');
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
        const inviter = interaction.user;
        const invitee = interaction.options.getUser('invitee');

        const inviteeMember = await interaction.guild.members.fetch(invitee.id);

        if (!inviteeMember || db.userExists(invitee.id) || inviteeMember.roles.cache.has(config.verifiedMemberRoleId)) {
            await interaction.reply({ content: `<@!${invitee.id}> is not part of the server or is already verified.`, ephemeral: true, allowedMentions: { users: [] } });
        }
        else if (db.userExists(inviter.id)) {
            const userInvitesAvailable = db.getInviteCount(interaction.user.id);

            if (db.lastUserWarning(inviteeMember.id)?.active) {
                await interaction.reply({ content: `<@!${invitee.id}> has an active Timeout or Ban and cannot be invited.`, ephemeral: true, allowedMentions: { users: [] } });
            }
            else if (!isNaN(userInvitesAvailable) && userInvitesAvailable > 0) {
                await inviteeMember.roles.add(config.verifiedMemberRoleId);
                db.inviteUser(inviter.id, invitee.id);
                await interaction.reply({ content: `<@!${inviter.id}> has invited <@!${invitee.id}> to become verified.`, allowedMentions: { users: [] } });
            }
            else {
                await interaction.reply({ content: 'You don\'t have any invites left.', ephemeral: true });
            }
        }
        else {
            await interaction.reply({ content: 'You must be verified to use this command.', ephemeral: true });
        }
    },
};