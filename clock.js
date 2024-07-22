const { DateTime, Duration } = require('luxon');
const db = require('./db.js');
const { updateWarnings, updateUserRoles } = require("./clientFunctions");

const clockInterval = Duration.fromObject({ minutes: 2 });
let lastDay = DateTime.now().day;
let intervalId = null;

function start(client) {
    intervalId = setInterval(async () => {
        console.log(DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss') + ' [Clock Heartbeat]');

        await updateWarnings(client);
        await updateUserRoles(client);

        const today = DateTime.now();
        if (today.day !== lastDay) {
            if (today.weekday === 7) {
                console.log(db.weeklyDigest());
            }

            lastDay = today.day;
        }
    }, clockInterval.as('milliseconds'));

    console.log('Clock timer started with the following interval configuration: ', clockInterval.toObject());
}
function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

module.exports = {
    start,
    stop
}
