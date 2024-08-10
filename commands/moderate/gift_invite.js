const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');
const db = require('../../db');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift_invite')
        .setDescription(`Manually gifts a user invites (Invites are capped at ${config.maxInvites})`)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User you want to gift invites')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('invites')
                .setDescription('When present, gifts that amount of invites')
        ),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const giftingInvites = interaction.options.getInteger('invites') || 1;
        const invites = db.getInviteCount(user.id);

        if (giftingInvites <= 0 || isNaN(giftingInvites)) {
            interaction.reply({ content: `Invites must be a positive, non-zero number`, ephemeral: true });
        }
        if (!isNaN(invites) && invites < config.maxInvites) {
            db.awardInvites(user.id, giftingInvites);

            interaction.reply({ content: `<@!${user.id}> was gifted ${ giftingInvites + invites > config.maxInvites ? config.maxInvites - invites : giftingInvites } invites.`, ephemeral: true, allowedMentions: { users: [] } });
        }
        else {
            interaction.reply({ content: `<@!${user.id}> already has the maximum amount of invites possible.`, ephemeral: true, allowedMentions: { users: [] } });
        }
    },
};