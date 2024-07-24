const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType  } = require('discord.js');
const db = require('../../db');
const toolkit = require('../../toolkit');

function warningStringMapper(row) {
    let reasonStr = '', untilStr = '', typeStr = '';

    switch (row.type) {
        case toolkit.WarningTypes.TempTimeout: typeStr += '`Timeout`'; break;
        case toolkit.WarningTypes.TempBan: typeStr += '`Temporary Ban`'; break;
        case toolkit.WarningTypes.PermBan: typeStr += '`Ban`'; break;
    }
    if (row.until) untilStr = ` | <t:${row.until.toUnixInteger()}>`;
    if (row.reason) reasonStr = `\n> ${row.reason}`;

    return `\n- <@!${row.usr_id}> | ${typeStr}${untilStr}${reasonStr}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('active_warnings')
        .setDescription('Returns a list of all the currently active warnings (limits to 50 per message)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),
    async execute(interaction) {
        let warnings = db.getAllActiveWarnings();
        let warningStr = warnings.warnings.map(warningStringMapper).join('');
        let maxPage = Math.floor(warnings.total-1 / 50);

        if (warnings.total > 0) {
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
                content: `## Active Warnings\n__**Page: 1/${maxPage+1}**__` + warningStr,
                ephemeral: true,
                allowedMentions: { users: [] },
                components: actionRow ? [actionRow] : null
            });

            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });
            let page = 0;

            collector.on('collect', async btn => {
                if (btn.customId === 'next') page++;
                else if (btn.customId === 'prev') page--;

                warnings = db.getAllActiveWarnings(page);
                warningStr = warnings.warnings.map(warningStringMapper).join('');
                maxPage = Math.floor(warnings.total-1 / 50);

                if (page <= 0) actionRow = new ActionRowBuilder().addComponents(buttons[1]);
                else if (page >= maxPage) actionRow = new ActionRowBuilder().addComponents(buttons[0]);
                else actionRow = new ActionRowBuilder().addComponents(...buttons);

                btn.update({
                    content: `## Active Warnings\n__**Page: ${page+1}/${maxPage+1}**__` + warningStr,
                    components: [actionRow],
                });
            });
        }
        else {
            await interaction.reply({ content: '## Active Warnings\n**No Warnings currently active**', ephemeral: true });
        }
    },
};