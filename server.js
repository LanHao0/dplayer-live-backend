const WebSocket = new require('ws');
const argv = require('minimist')(process.argv.slice(2), {string: ['port'], default: {port: 1207}});

let server = new WebSocket.Server({
    clientTracking: true,
    port: argv['port']
}, function () {
    console.log('WebSocket server started on port: ' + argv['port']);
});

let shutdown = function () {
    console.log('Received kill signal, shutting down gracefully.');

    server.close(function () {
        console.log('Closed out remaining connections.');
        process.exit();
    });

    setTimeout(function () {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit();
    }, 10 * 1000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.on('error', function (err) {
    console.log(err);
});


const typeRegExp = /^([012])$/;
let msgMinInterval = 500;
let lastMsgTimestamps = {};
let ipAddress = [];

server.on('connection', function (ws, req) {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!ipAddress.includes(ip)) {
        ipAddress.push(ip);
    }

    ws.on('message', function (message) {
        if (message !== 'online') {
            console.log(JSON.stringify(JSON.parse(message)))
            let time = Date.now();
            if (lastMsgTimestamps[ip] && lastMsgTimestamps[ip] - time < msgMinInterval) {
                return;
            }
            let msg;
            try {
                message = JSON.parse(message);
                if (isNaN(message.color) || !typeRegExp.test(message.type) || !message.text) {
                    return;
                }
                msg = {
                    author: message.author ? message.author : '游客 Guest',
                    text: message.text,
                    color: message.color,
                    type: message.type
                };
            } catch (e) {
                return;
            }

            lastMsgTimestamps[ip] = time;

            let data = JSON.stringify(msg);
            console.log(ip + ' ' + data)
            server.clients.forEach(function (client) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data, function (err) {
                        err && console.log(err);
                    });
                }
            });
        } else {
            if (!ipAddress.includes(ip)) {
                ipAddress.push(ip);
            }
        }
    });

    ws.on('error', console.log);


});

setInterval(function () {
    console.log(new Date().toISOString() + ipAddress.length)
    server.clients.forEach(function (client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({size: ipAddress.length}), function (err) {
                err && console.log(err);
            });
        }
    });
    ipAddress = [];

}, 5000)

setInterval(function () {
    let time = Date.now();
    Object.keys(lastMsgTimestamps).forEach(function (key) {
        if (time - lastMsgTimestamps[key] > msgMinInterval) {
            delete lastMsgTimestamps[key];
        }
    });
}, 5000);
