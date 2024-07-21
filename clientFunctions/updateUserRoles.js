const config = require('../config.json');
const db = require('../db');
const { DateTime } = require('luxon');

async function updateUserRoles(client) {
    const guild = await client.guilds.fetch(config.guildId)
    if (guild) {
        const now = DateTime.now();
        const rolePromises = [];

        const warnings = db.getAllLastWarnings();
        for (const warning of warnings) {
            if (!warning.until || now < warning.until) {
                const member = await guild.members.fetch(warning.usr_id);
                if (member.roles.cache.has(config.verifiedMemberRoleId)) {
                    rolePromises.push(
                        member.roles.remove(config.verifiedMemberRoleId).catch()
                    );
                }
            }
        }

        const users = db.getKnownUserIds();
        for (const userId of users) {
            if (!warnings.find(warning => warning.usr_id === userId)) {
                const member = await guild.members.fetch(userId);
                if (!member.roles.cache.has(config.verifiedMemberRoleId)) {
                    rolePromises.push(
                        member.roles.add(config.verifiedMemberRoleId).catch()
                    );
                }
            }
        }

        await Promise.all(rolePromises);
        if (rolePromises.length > 0) console.log(`Updated ${users.length} to have/not have the member role according to their status.`);
    }
    else {
        console.error(`Application/Bot not present in target guild!`);
        await client.destroy();
        process.exit(-1);
    }
}

module.exports = {updateUserRoles};
