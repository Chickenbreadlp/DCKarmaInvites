const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType  } = require('discord.js');
const { DateTime } = require('luxon');
const db = require('../../db');
const toolkit = require('../../toolkit');
const config = require('../../config.json');

function warningStringMapper(row) {
    let reasonStr = '', typeStr = '';
    let timeStr = `<t:${row.start.toUnixInteger()}>`;

    switch (row.type) {
        case toolkit.WarningTypes.TempTimeout: typeStr += '`Timeout`'; break;
        case toolkit.WarningTypes.TempBan: typeStr += '`Temporary Ban`'; break;
        case toolkit.WarningTypes.PermBan: typeStr += '`Ban`'; break;
    }
    if (row.reason) reasonStr = `\n> ${row.reason}`;
    if (row.until) {
        timeStr += ` -> <t:${row.until.toUnixInteger()}>`;

        if (DateTime.now() < row.until) {
            timeStr = '⏱ ' + timeStr;
        }
        else {
            timeStr = '✅ ' + timeStr;
        }
    }
    else {
        timeStr = '⏱ ' + timeStr;
    }

    return `\n- <@!${row.usr_id}> | ${typeStr} | ${timeStr}${reasonStr}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warning_history')
        .setDescription('Returns a list of all warnings, past or active')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('only')
                .setDescription('Only shows temporary warnings')
                .addChoices(
                    { name: 'Temporary', value: 'temp' },
                    { name: 'Permanent', value: 'perm' }
                )
        ),
    async execute(interaction) {
        const only = interaction.options.getString('only');
        let warnings = db.getWarningHistory(only);
        let warningStr = warnings.warnings.map(warningStringMapper).join('');

        if (warnings.total > 0) {
            let maxPage = Math.floor((warnings.total-1) / config.warningPageSize);
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
                content: `## Warning History\n__**Page: 1/${maxPage+1}**__` + warningStr,
                ephemeral: true,
                allowedMentions: { users: [] },
                components: actionRow ? [actionRow] : null
            });

            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });
            let page = 0;

            collector.on('collect', async btn => {
                if (btn.customId === 'next') page++;
                else if (btn.customId === 'prev') page--;

                warnings = db.getWarningHistory(only, page);
                warningStr = warnings.warnings.map(warningStringMapper).join('');
                maxPage = Math.floor((warnings.total-1) / config.warningPageSize);

                if (page <= 0) actionRow = new ActionRowBuilder().addComponents(buttons[1]);
                else if (page >= maxPage) actionRow = new ActionRowBuilder().addComponents(buttons[0]);
                else actionRow = new ActionRowBuilder().addComponents(...buttons);

                btn.update({
                    content: `## Warning History\n__**Page: ${page+1}/${maxPage+1}**__` + warningStr,
                    components: [actionRow],
                });
            });
        }
        else {
            let typeStr = '';
            if (only === 'temp') typeStr = '__temporary__ ';
            if (only === 'perm') typeStr = '__permanent__ ';

            await interaction.reply({ content: `## Warning History\n**No ${typeStr}Warnings on record**`, ephemeral: true });
        }
    },
};