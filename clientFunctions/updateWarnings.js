const config = require('../config.json');
const toolkit = require('../toolkit');
const db = require('../db');
const { DateTime } = require('luxon');

async function updateWarnings(client) {
    const guild = await client.guilds.fetch(config.guildId)
    if (guild) {
        const warnings = db.getAllLastWarnings();
        const now = DateTime.now();
        const roleAdders = [];

        for (const warning of warnings) {
            if (warning.until && now >= warning.until) {
                if (warning.type === toolkit.WarningTypes.TempBan) {
                    const member = await guild.members.fetch(warning.usr_id);
                    roleAdders.push(
                        member.roles.add(config.verifiedMemberRoleId).catch()
                    );
                }
                db.clearUserWarnings(warning.usr_id);
            }
        }

        await Promise.all(roleAdders);
        if (roleAdders.length > 0) console.log(`Given ${roleAdders.length} members their role back after an expired timeout.`);
    }
    else {
        console.error(`Application/Bot not present in target guild!`);
        await client.destroy();
        process.exit(-1);
    }
}

module.exports = {updateWarnings};
