const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');
const db = require('../../db');
const toolkit = require('../../toolkit');
const { DateTime } = require("luxon");
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user, so they will temporarily loose their member status (default: 6 hours)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User you want to timeout')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('hours')
                .setDescription('Amount of hours the user should be timed out for')
                .setMinValue(1)
                .setMaxValue(23)
        )
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Amount of days the user should be timed out for')
                .setMinValue(1)
                .setMaxValue(30)
        )
        .addIntegerOption(option =>
            option.setName('months')
                .setDescription('Amount of months the user should be timed out for')
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for why the user was timed out for')
        ),
    async execute(interaction) {
        const user = interaction.options.getUser('user');

        if (db.userExists(user.id)) {
            const lastTimeout = db.lastUserWarning(user.id);

            if (!lastTimeout?.active || (lastTimeout.active && lastTimeout.type === toolkit.WarningTypes.TempTimeout)) {
                let timeoutTime = {
                    hours: 0,
                    days: 0,
                    months: 0
                };

                let manualTimeSet = false;
                if (interaction.options.getInteger('hours')) {
                    timeoutTime.hours = interaction.options.getInteger('hours');
                    manualTimeSet = true;
                }
                if (interaction.options.getInteger('days')) {
                    timeoutTime.days = interaction.options.getInteger('days');
                    manualTimeSet = true;
                }
                if (interaction.options.getInteger('months')) {
                    timeoutTime.months = interaction.options.getInteger('months');
                    manualTimeSet = true;
                }
                if (!manualTimeSet) {
                    timeoutTime.hours = 6;
                }

                const finalTimeoutTime = toolkit.calculateWarningDuration(lastTimeout, timeoutTime);

                if (!lastTimeout?.active) {
                    const timeoutMember = await interaction.guild.members.fetch(user.id);
                    await timeoutMember.roles.remove(config.verifiedMemberRoleId).catch();
                }

                const newUntil = DateTime.now().plus(finalTimeoutTime);
                db.warnUser(user.id, toolkit.WarningTypes.TempTimeout, newUntil);
                // make sure all their invites get removed
                db.retractInvites(user.id, 1000);

                const inviter = db.whoInvited(user.id);
                let inviterPunished = false;
                if (inviter) {
                    const lastInviterWarning = db.lastUserWarning(inviter);
                    if (!lastInviterWarning?.active || (lastInviterWarning.active && lastInviterWarning.type === toolkit.WarningTypes.TempTimeout)) {
                        const inviterPunishment = toolkit.calculateWarningDuration(
                            lastInviterWarning,
                            {
                                hours: timeoutTime.hours / 2,
                                days: timeoutTime.days / 2,
                                months: timeoutTime.months / 2
                            }
                        );

                        db.warnUser(inviter, toolkit.WarningTypes.TempTimeout, DateTime.now().plus(inviterPunishment));
                        db.retractInvites(inviter, 1000);

                        inviterPunished = true;
                        if (!lastInviterWarning?.active) {
                            const inviterMember = await interaction.guild.members.fetch(inviter);
                            await inviterMember.roles.remove(config.verifiedMemberRoleId).catch();

                            inviterMember.send(`You have received a temporary timeout from being a verified member at ${interaction.guild.name}, because a member you have invited also received a timeout from this role.`);
                        }
                    }
                }

                let reason = '';
                if (interaction.options.getString('reason')) {
                    reason = '\nReason:\n> ' + interaction.options.getString('reason');
                }
                await interaction.reply(`<@!${user.id}> has been timed out from being a verified member.${reason}`);

                const followUp = ['Also note:'];
                if (lastTimeout?.active)
                    followUp.push('- They already had an active timeout, the time of which was added to the new timeout.');
                if (inviterPunished)
                    followUp.push(`- They were invited by <@!${inviter}>, who has also been timed out.`);

                if (followUp.length > 1)
                    await interaction.followUp({content: followUp.join('\n'), ephemeral: true});
            }
            else {
                await interaction.reply({content: `<@!${user.id}> already has an active warning of a different type.`, ephemeral: true, allowedMentions: { users: [] } });
            }
        }
        else {
            await interaction.reply({ content: `<@!${user.id}> currently not member`, ephemeral: true, allowedMentions: { users: [] } });
        }
    },
};