const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('take_invite')
        .setDescription(`Manually takes away invites from a user`)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User you want to take invites away from')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('invites')
                .setDescription('When present, takes away that many invites')
        ),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const takingInvites = interaction.options.getInteger('invites') || 1;
        const invites = db.getInviteCount(user.id);

        if (takingInvites <= 0 || isNaN(takingInvites)) {
            interaction.reply({ content: `Invites must be a positive, non-zero number`, ephemeral: true });
        }
        if (!isNaN(invites) && invites > 0) {
            db.retractInvites(user.id, takingInvites);

            interaction.reply({ content: `Taken away ${ invites - takingInvites <= 0 ? 'all' : takingInvites } invites from <@!${user.id}>.`, ephemeral: true, allowedMentions: { users: [] } });
        }
        else {
            interaction.reply({ content: `<@!${user.id}> has no invites to take away.`, ephemeral: true, allowedMentions: { users: [] } });
        }
    },
};