const config = require('../config.json');
const toolkit = require('../toolkit');
const db = require('../db');

async function syncMembers(client) {
    const guild = await client.guilds.fetch(config.guildId)
    if (guild) {
        // make sure we have the members fetched before checking the role members!
        await guild.members.fetch();

        const verifiedRole = await guild.roles.fetch(config.verifiedMemberRoleId);
        if (verifiedRole) {
            const memberIds = verifiedRole.members.filter(member => !member.user.bot && !member.user.system).map(member => member.user.id);

            toolkit.commitMemberChanges(db, memberIds);
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

module.exports = {
    syncMembers
}