const crypto = require('crypto');
const { DateTime } = require("luxon");

/**
 * Hashes the given data and returns the Hash in Hex Format
 * @param data Data to be hashed
 * @returns {string} A SHA-512 Hash of the given data
 */
function hashData(data) {
    const hash = crypto.createHash('sha512');
    hash.update(data);
    return hash.digest('hex');
}

/**
 * Commits changes to the member list to the db
 * @param db The DB object
 * @param currentMembers { string[] } List of currently active member IDs
 */
function commitMemberChanges(db, currentMembers) {
    const timeouts = db.getAllUniqueActiveTimeouts().filter(timeout => !currentMembers.includes(timeout.usr_id)).map(timeout => timeout.usr_id);
    currentMembers.push(...timeouts);

    const previousUsers = db.getKnownUserIds();

    const deletedUsers = previousUsers.filter(id => !currentMembers.includes(id.toString()));
    const newUsers = currentMembers.filter(id => !previousUsers.includes(id));

    db.batchRemoveUsers(deletedUsers);
    db.batchCreateUsers(newUsers);
}

function calculateWarningDuration(previousWarning, duration) {
    if (previousWarning?.active) {
        const lastWarningDiff = previousWarning.until.diff(DateTime.now(), [ 'seconds', 'minutes', 'hours', 'days' ]).toObject();
        return {
            ...lastWarningDiff,
            seconds: Math.round(lastWarningDiff.seconds),
            hours: duration.hours + lastWarningDiff.hours,
            days: duration.days + lastWarningDiff.days,
            months: duration.months
        }
    }
    return duration;
}

const WarningTypes = {
    TempTimeout: 'TEMP_TIMEOUT',
    TempBan: 'TEMP_BAN',
    PermBan: 'PERM_BAN',
}

module.exports = {
    hashData,
    commitMemberChanges,
    calculateWarningDuration,
    WarningTypes
}