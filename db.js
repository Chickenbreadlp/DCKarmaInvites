const fs = require('fs');
const { DateTime } = require("luxon");
const toolkit = require('./toolkit');
const config = require('./config');

const Database = require('better-sqlite3');
const dbIsNew = !fs.existsSync('data.db');
const db = new Database('data.db');
const dbVersion = 0.2;

function setupDB() {
    if (dbIsNew) {
        db.pragma('journal_mode = WAL');
        db.pragma('auto_vacuum = FULL');

        /* Generate user activity Table */
        db.prepare(`CREATE TABLE metadata(
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                meta_key    TEXT    DEFAULT '' NOT NULL,
                value       INTEGER DEFAULT 0  NOT NULL
            )`).run();
        const metaInsert = db.prepare('INSERT INTO metadata(meta_key, value) VALUES (?, ?)');
        metaInsert.run('DB_Version', dbVersion);

        /* Generate user activity Table */
        db.prepare(`CREATE TABLE user_activity(
                usr_id            TEXT    PRIMARY KEY NOT NULL,
                lifetime_messages INTEGER DEFAULT 0   NOT NULL,
                messages_created  INTEGER DEFAULT 0   NOT NULL,
                messages_deleted  INTEGER DEFAULT 0   NOT NULL,
                weeks_present     INTEGER DEFAULT 0   NOT NULL
            )`).run();

        /* Generate user invite Table */
        db.prepare(`CREATE TABLE user_invite_count(
                usr_id  TEXT    PRIMARY KEY NOT NULL,
                invites INTEGER DEFAULT 0   NOT NULL
            )`).run();

        /* Generate user proposals Table */
        db.prepare(`CREATE TABLE user_invites(
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                inviter    TEXT    NOT NULL,
                invitee    TEXT    NOT NULL
            )`).run();

        /* Generate user blacklist/timeout Table */
        db.prepare(`CREATE TABLE user_warnings(
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                usr_id      TEXT    NOT NULL,
                type        TEXT    NOT NULL,
                reason      TEXT,
                until       DATE,
                history_id  INTEGER
            )`).run();

        db.prepare(`CREATE TABLE user_warning_history(
                id     INTEGER PRIMARY KEY AUTOINCREMENT,
                usr_id TEXT    NOT NULL,
                type   TEXT    NOT NULL,
                start  DATE    NOT NULL,
                reason TEXT,
                until  DATE
            )`).run();
    }
    else {
        let currentDB = 0;
        try {
            currentDB = db.prepare(`SELECT value FROM metadata WHERE meta_key = ?`).pluck(true).get('DB_Version');
        }
        catch (e) {}

        console.log(`Loaded DB v${currentDB}`);

        if (currentDB !== dbVersion) {
            console.log(`Service expects DB v${dbVersion}. Upgrading...`);
            if (currentDB < 0.1) {
                db.prepare(`CREATE TABLE metadata(
                            id          INTEGER PRIMARY KEY AUTOINCREMENT,
                            meta_key    TEXT    DEFAULT '' NOT NULL,
                            value       INTEGER DEFAULT 0  NOT NULL
                        )`).run();
                db.prepare('INSERT INTO metadata(meta_key, value) VALUES (?, ?)').run('DB_Version', dbVersion).run();

                db.prepare(`ALTER TABLE user_warnings ADD COLUMN reason TEXT`).run();
            }
            if (currentDB < 0.2) {
                db.prepare(`ALTER TABLE user_warnings ADD COLUMN history_id INTEGER`).run();

                db.prepare('DROP TABLE IF EXISTS user_warnings_history').run();
                db.prepare(`CREATE TABLE user_warning_history(
                            id     INTEGER PRIMARY KEY AUTOINCREMENT,
                            usr_id TEXT    NOT NULL,
                            type   TEXT    NOT NULL,
                            start  DATE    NOT NULL,
                            reason TEXT,
                            until  DATE
                        )`).run();
            }

            db.prepare('UPDATE metadata SET value = ? WHERE meta_key = ?').run(dbVersion, 'DB_Version');
        }
    }
}
function valuePresent(tableName, column, value) {
    return db.prepare(`SELECT 1 FROM ${tableName} WHERE ${column} = ?;`).pluck(true).get(value) === 1;
}
function createDateTimeMapper(...columnNames) {
    return (row) => {
        for (const column of columnNames) {
            if (row[column]) {
                row[column] = DateTime.fromISO(row[column]);
            }
        }
        return row;
    }
}


/* User functions */
function getKnownUserIds() {
    return db.prepare(`SELECT usr_id FROM user_activity;`).pluck(true).all();
}
function getPagedUserList(page = 0) {
    const total = db.prepare(`SELECT COUNT(*) FROM user_activity`).pluck(true).get();
    const users = db.prepare(`
            SELECT a.*, i.inviter, c.invites
            FROM user_activity a
                 LEFT JOIN user_invites i ON a.usr_id = i.invitee
                 LEFT JOIN user_invite_count c ON a.usr_id = c.usr_id
            LIMIT ? OFFSET ?;
        `).all(config.membersPageSize, page * config.membersPageSize)
        .map(el => {
            el.weekly_messages = el.messages_created - (el.messages_deleted / 2);
            el.avg_message_rate = el.weekly_messages / 7;
            el.qualifies_for_invite = el.avg_message_rate >= config.inviteAwardThreashold && el.weeks_present > 0;
            return el;
        });

    return { total, users }
}

function userExists(userId) {
    return valuePresent('user_activity', 'usr_id', userId);
}
function newUser(userId) {
    if (!userExists(userId)) {
        db.transaction(() => {
            db.prepare('INSERT INTO user_activity(usr_id) VALUES (?)').run(userId);
            db.prepare('INSERT INTO user_invite_count(usr_id) VALUES (?)').run(userId);
        })();
    }
}
function batchCreateUsers(userIds) {
    db.transaction(() => {
        for (const userId of userIds) {
            newUser(userId);
        }
    })();
}
function removeUser(userId) {
    db.transaction(() => {
        db.prepare('DELETE FROM user_activity WHERE usr_id = ?').run(userId);
        db.prepare('DELETE FROM user_invite_count WHERE usr_id = ?').run(userId);
        db.prepare('DELETE FROM user_invites WHERE invitee = ?').run(userId);
    })();
}
function batchRemoveUsers(userIds) {
    const questionmarkList = userIds.map(() => '?').join(',');

    db.transaction(() => {
        db.prepare(`DELETE FROM user_activity WHERE usr_id in (${questionmarkList})`).run(...userIds);
        db.prepare(`DELETE FROM user_invite_count WHERE usr_id in (${questionmarkList})`).run(...userIds);
        db.prepare(`DELETE FROM user_invites WHERE invitee in (${questionmarkList})`).run(...userIds);
    })();
}
function userMessageCreated(userId) {
    db.prepare(`
        UPDATE user_activity
        SET lifetime_messages = lifetime_messages + 1, messages_created = messages_created + 1
        WHERE usr_id = ?
    `).run(userId);
}
function userMessageDeleted(userId) {
    db.prepare(`
        UPDATE user_activity
        SET lifetime_messages = lifetime_messages - 1, messages_deleted = messages_deleted + 1
        WHERE usr_id = ?
    `).run(userId);
}
function whoInvited(userId) {
    return db.prepare(`SELECT inviter FROM user_invites WHERE invitee = ?;`).pluck(true).get(userId);
}

/* Warning System */
function warnUser(userId, warningType, reason, until = null) {
    if (Object.values(toolkit.WarningTypes).includes(warningType)) {
        const parameters = [
            userId,
            warningType,
            reason
        ];

        if (warningType.startsWith('TEMP') && until) {
            parameters.push(until.toISO());

            const { lastInsertRowid } = db.prepare(`
                    INSERT INTO user_warning_history(usr_id, type, reason, until, start)
                    VALUES (?,?,?,?,?)
                `).run(...parameters, DateTime.now().toISO());

            db.prepare(`
                    INSERT INTO user_warnings(usr_id, type, reason, until, history_id)
                    VALUES (?, ?, ?, ?, ?)
                `).run(...parameters, lastInsertRowid);
        }
        else if (warningType.startsWith('PERM')) {
            const { lastInsertRowid } = db.prepare(`
                    INSERT INTO user_warning_history(usr_id, type, reason, start)
                    VALUES (?,?,?,?)
                `).run(...parameters, DateTime.now().toISO());

            db.prepare(`
                    INSERT INTO user_warnings(usr_id, type, reason, history_id)
                    VALUES (?, ?, ?, ?)
                `).run(...parameters, lastInsertRowid)
        }
    }
}
function clearUserWarnings(userId, warningType) {
    const lastWarning = lastUserWarning(userId, warningType);
    if (lastWarning?.active && lastWarning?.history_id) {
        db.prepare(`
                UPDATE user_warning_history
                SET until = ?
                WHERE id = ?
            `).run(
                DateTime.now().toISO(),
                lastWarning?.history_id
            );
    }

    if (warningType) {
        db.prepare(`DELETE FROM user_warnings WHERE usr_id = ? AND type = ?`).run(userId, warningType);
    }
    else {
        db.prepare(`DELETE FROM user_warnings WHERE usr_id = ?`).run(userId);
    }
}
function lastUserWarning(userId, warningType) {
    let results;

    if (Object.values(toolkit.WarningTypes).includes(warningType)) {
        results = db.prepare(`
            SELECT type, until, reason, history_id
            FROM user_warnings
            WHERE usr_id = ? AND type = ?
            ORDER BY until DESC NULLS FIRST
            LIMIT 1
        `).get(userId, warningType);
    }
    else {
        results = db.prepare(`
            SELECT type, until, reason, history_id
            FROM user_warnings
            WHERE usr_id = ?
            ORDER BY until DESC NULLS FIRST
            LIMIT 1
        `).get(userId);
    }

    // if a result was returned, map the DT column to a luxon object
    if (results) {
        if (results.until) {
            results.until = DateTime.fromISO(results.until);
            results.active = DateTime.now() < results.until;
        }
        else {
            results.active = true;
        }
    }

    return results;
}
function getAllUniqueActiveTimeouts() {
    const mapper = createDateTimeMapper('until');
    return db.prepare(`
            SELECT usr_id, until
            FROM (
                SELECT usr_id, until
                FROM user_warnings
                WHERE type = ?
                ORDER BY until DESC
            )
            GROUP BY usr_id
        `)
        .all(toolkit.WarningTypes.TempTimeout)
        .map(mapper)
        .filter(row => DateTime.now() < row.until);
}
function getAllLastWarnings() {
    const mapper = createDateTimeMapper('until');
    return db.prepare(`
        SELECT usr_id, type, until
        FROM (
            SELECT usr_id, type, until
            FROM user_warnings
            ORDER BY until DESC NULLS FIRST
        )
        GROUP BY usr_id
        `)
        .all()
        .map(mapper);
}
function getAllActiveWarnings(only = null, page = 0) {
    const mapper = createDateTimeMapper('until');
    let onlyFilter = '';
    if (only === 'temp') onlyFilter = `WHERE type != '${toolkit.WarningTypes.PermBan}'`;
    else if (only === 'perm') onlyFilter  = `WHERE type == '${toolkit.WarningTypes.PermBan}'`;

    const total = db.prepare(`SELECT COUNT(*) FROM user_warnings ${onlyFilter}`).pluck(true).get();
    const warnings = db.prepare(`
            SELECT *
            FROM user_warnings
            ${onlyFilter}
            ORDER BY until DESC NULLS LAST
            LIMIT ? OFFSET ?
        `).all(config.warningPageSize, page * config.warningPageSize)
        .map(mapper);

    return { total, warnings };
}

function updateHistoryUntil(id, until) {
    db.prepare(`
            UPDATE user_warning_history
            SET until = ?
            WHERE id = ?
        `).run(until.toISO(), id);
}
function getWarningHistory(only = null, page = 0) {
    const mapper = createDateTimeMapper('start', 'until');
    let onlyFilter = '';
    if (only === 'temp') onlyFilter = `WHERE type != '${toolkit.WarningTypes.PermBan}'`;
    else if (only === 'perm') onlyFilter  = `WHERE type == '${toolkit.WarningTypes.PermBan}'`;

    const total = db.prepare(`SELECT COUNT(*) FROM user_warning_history ${onlyFilter}`).pluck(true).get();
    const warnings = db.prepare(`
            SELECT *
            FROM user_warning_history
            ${onlyFilter}
            ORDER BY start DESC
            LIMIT ? OFFSET ?
        `).all(config.warningPageSize, page * config.warningPageSize)
        .map(mapper);

    return { total, warnings };
}
function shortenHistory() {
    const total = db.prepare(`SELECT COUNT(*) FROM user_warning_history WHERE until IS NOT NULL`).pluck(true).get();
    if (total > config.maxHistoryLength) {
        const warnings = db.prepare(`
                SELECT id
                FROM user_warning_history
                WHERE until IS NOT NULL
                ORDER BY start ASC
                LIMIT ?
            `).all(total - config.maxHistoryLength);
        const questionList = warnings.map(() => '?').join(',');

        db.prepare(`DELETE FROM user_warning_history WHERE id in (${questionList})`).run(...warnings.map(row => row.id));
    }
}

/* Invite functions */
function getInviteCount(userId) {
    return db.prepare(`SELECT invites FROM user_invite_count WHERE usr_id = ?;`).pluck(true).get(userId);
}
function awardInvites(userId, invites = 1) {
    const invite_count = getInviteCount(userId);
    if (invite_count + invites > config.maxInvites) {
        invites = config.maxInvites - invite_count;
    }

    if (invites > 0) {
        db.prepare(`
            UPDATE user_invite_count
            SET invites = invites + ?
            WHERE usr_id = ?
        `).run(invites, userId);
    }
}
function retractInvites(userId, invites = 1) {
    const invite_count = getInviteCount(userId);
    if (invites > invite_count) {
        invites = invite_count;
    }

    if (invites > 0) {
        db.prepare(`
            UPDATE user_invite_count
            SET invites = invites - ?
            WHERE usr_id = ?
        `).run(invites, userId);
    }
}

function inviteUser(invitee, inviter) {
    db.transaction(() => {
        if (inviter) {
            retractInvites(inviter);
            db.prepare(`
                INSERT INTO user_invites(inviter, invitee)
                VALUES (?, ?)
            `).run(inviter, invitee);
        }
        newUser(invitee);
    })();
}

/* DB aggregate functions */
function weeklyDigest() {
    let activity;
    db.transaction(() => {
        activity = db.prepare('SELECT * FROM user_activity WHERE weeks_present > 0;')
            .all()
            .filter(row => {
                const warning = lastUserWarning(row.usr_id);
                return !warning || !warning.active;
            })
            .map(row => {
                row.weekly_messages = row.messages_created - (row.messages_deleted / 2);
                row.avg_message_rate = row.weekly_messages / 7;
                return row;
            });

        // Check who meets the requirement for receiving an invite
        const receiveInvite = [];
        for (let user of activity) {
            if (user.avg_message_rate >= config.inviteAwardThreashold) {
                receiveInvite.push(user.usr_id);
            }
        }

        // award qualifying users with invites
        db.prepare(`
            UPDATE user_invite_count
            SET invites = invites + 1
            WHERE invites < ? AND usr_id in (${receiveInvite.map(() => '?').join(',')})
        `).run(config.maxInvites, ...receiveInvite);

        db.prepare('UPDATE user_activity SET messages_created = 0, messages_deleted = 0, weeks_present = weeks_present + 1').run();
    })();

    return activity;
}

module.exports = {
    setupDB,
    userExists,
    getKnownUserIds,
    getPagedUserList,

    newUser,
    batchCreateUsers,
    removeUser,
    batchRemoveUsers,

    userMessageCreated,
    userMessageDeleted,
    whoInvited,

    warnUser,
    clearUserWarnings,

    lastUserWarning,
    getAllUniqueActiveTimeouts,
    getAllLastWarnings,
    getAllActiveWarnings,

    updateHistoryUntil,
    getWarningHistory,
    shortenHistory,

    getInviteCount,
    awardInvites,
    retractInvites,
    inviteUser,

    weeklyDigest
}
