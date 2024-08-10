const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType  } = require('discord.js');
const db = require('../../db');
const config = require('../../config.json');

function userStringMapper(row) {
    let getsInviteStr = '', inviteeStr = '';

    if (row.qualifies_for_invite) getsInviteStr = ' | Will receive Invite';
    if (row.inviter !== null) inviteeStr = ` | Invited by <@!${row.inviter}>`;

    return `\n- <@!${row.usr_id}> | Invites: \`${row.invites}\` | Lifetime messages: \`${row.lifetime_messages}\`${getsInviteStr}${inviteeStr}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('all_members')
        .setDescription('Returns a list of all known members to the bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),
    async execute(interaction) {
        let members = db.getPagedUserList();
        let memberStr = members.users.map(userStringMapper).join('');

        if (members.total > 0) {
            let maxPage = Math.floor((members.total-1) / config.membersPageSize);
            const buttons = [
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('<< Previous Page')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next Page >>')
                    .setStyle(ButtonStyle.Primary)
            ];
            let actionRow;
            if (maxPage !== 0) actionRow = new ActionRowBuilder().addComponents(buttons[1]);

            const response = await interaction.reply({
                content: `## Member List\n__**Page: 1/${maxPage+1}**__` + memberStr,
                ephemeral: true,
                allowedMentions: { users: [] },
                components: actionRow ? [actionRow] : null
            });

            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });
            let page = 0;

            collector.on('collect', async btn => {
                if (btn.customId === 'next') page++;
                else if (btn.customId === 'prev') page--;

                members = db.getWarningHistory(only, page);
                memberStr = members.warnings.map(userStringMapper).join('');
                maxPage = Math.floor((members.total-1) / config.membersPageSize);

                if (page <= 0) actionRow = new ActionRowBuilder().addComponents(buttons[1]);
                else if (page >= maxPage) actionRow = new ActionRowBuilder().addComponents(buttons[0]);
                else actionRow = new ActionRowBuilder().addComponents(...buttons);

                btn.update({
                    content: `## Member List\n__**Page: ${page+1}/${maxPage+1}**__` + memberStr,
                    components: [actionRow],
                });
            });
        }
        else {
            await interaction.reply({ content: `## Member List\n**No members on record.**`, ephemeral: true });
        }
    },
};