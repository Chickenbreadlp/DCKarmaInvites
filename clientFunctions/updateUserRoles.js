const config = require('../config.json');
const db = require('../db');
const { DateTime } = require('luxon');

async function updateUserRoles(client) {
    const guild = await client.guilds.fetch(config.guildId)
    if (guild) {
        const verifiedRole = await guild.roles.fetch(config.verifiedMemberRoleId);
        if (verifiedRole) {
            const now = DateTime.now();
            const rolePromises = [];

            const warnings = db.getAllLastWarnings();
            for (const warning of warnings) {
                if (!warning.until || now < warning.until) {
                    try {
                        const member = await guild.members.fetch(warning.usr_id);
                        if (member.roles.cache.has(config.verifiedMemberRoleId)) {
                            rolePromises.push(
                                member.roles.remove(config.verifiedMemberRoleId).catch()
                            );
                        }
                    }
                    catch (e) {
                        console.warn(`User with ID ${warning.usr_id} no longer present.`);
                    }
                }
            }

            const users = db.getKnownUserIds();
            for (const userId of users) {
                if (!warnings.find(warning => warning.usr_id === userId)) {
                    try {
                        const member = await guild.members.fetch(userId);
                        if (!member.roles.cache.has(config.verifiedMemberRoleId)) {
                            rolePromises.push(
                                member.roles.add(config.verifiedMemberRoleId).catch()
                            );
                        }
                    }
                    catch (e) {
                        console.warn(`User with ID ${warning.usr_id} no longer present.`);
                    }
                }
            }

            await Promise.all(rolePromises);
            if (rolePromises.length > 0) console.log(`Updated ${rolePromises.length} to have/not have the member role according to their status.`);
        }
        else {
            console.error('Verified role does not exist!');
            await client.destroy();
            process.exit(-1);
        }
    }
    else {
        console.error(`Application/Bot not present in target guild!`);
        await client.destroy();
        process.exit(-1);
    }
}

module.exports = {updateUserRoles};
