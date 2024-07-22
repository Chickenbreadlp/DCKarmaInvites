const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');
const db = require('../../db');
const toolkit = require('../../toolkit');
const { DateTime } = require("luxon");
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user, so they will permanently loose their member status (cannot be re-invited till cleared)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User you want to ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for why the user was banned')
        ),
    async execute(interaction) {
        const user = interaction.options.getUser('user');

        db.warnUser(user.id, toolkit.WarningTypes.PermBan);

        let lastTimeout, inviter, inviterPunished = false;
        if (db.userExists(user.id)) {
            lastTimeout = db.lastUserWarning(user.id);

            if (!lastTimeout?.active) {
                const timeoutMember = await interaction.guild.members.fetch(user.id);
                timeoutMember.roles.remove(config.verifiedMemberRoleId);
            }

            const inviter = db.whoInvited(user.id);
            if (inviter) {
                const lastInviterWarning = db.lastUserWarning(inviter);

                if (lastInviterWarning.type !== toolkit.WarningTypes.PermBan) {
                    const inviterPunishment = toolkit.calculateWarningDuration(
                        lastInviterWarning,
                        {
                            hours: 0,
                            days: 7,
                            months: 0
                        }
                    );

                    db.warnUser(inviter, toolkit.WarningTypes.TempBan, DateTime.now().plus(inviterPunishment));
                    db.removeUser(user.id);

                    inviterPunished = true;
                    if (!lastInviterWarning?.active) {
                        const inviterMember = await interaction.guild.members.fetch(inviter);
                        await inviterMember.roles.remove(config.verifiedMemberRoleId);
                        inviterMember.send(`You have received a temporary ban from being a verified member at ${interaction.guild.name}, because a member you have invited was permanently banned from this role.\nWhat temporary ban means, is that you will be barred from being invited again for a week, and you will not automatically re-receive the verified member role.`);
                    }
                }
            }

            // and finally remove the user, since they were banned
            db.removeUser(user.id);
        }

        let reason = '';
        if (interaction.options.getString('reason')) {
            reason = '\nReason:\n> ' + interaction.options.getString('reason');
        }
        await interaction.reply(`<@!${user.id}> has been banned from being a verified member.${reason}`);

        const followUp = ['Also note:'];
        if (lastTimeout?.active)
            followUp.push('- They previously had a timeout or temporary ban, which has now been overwritten with this permanent ban');
        if (inviterPunished)
            followUp.push(`- They were invited by <@!${inviter}>, who has received a temporary ban (means they can be re-invited after a week, but don't regain their member status automatically)`);

        if (followUp.length > 1)
            await interaction.followUp({content: followUp.join('\n'), ephemeral: true});
    },
};