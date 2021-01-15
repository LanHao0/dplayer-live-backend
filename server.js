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

server.on('connection', function (ws, req) {
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  ws.on('message', function (message) {
    let time = Date.now();
    if (lastMsgTimestamps[ip] && lastMsgTimestamps[ip] - time < msgMinInterval) {
      return;
    }
    try {
      message = JSON.parse(message);
      if (isNaN(message.color) || !typeRegExp.test(message.type) || !message.text) {
        return;
      }
      var msg = {
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
  });
  ws.on('error', console.log);
});

setInterval(function () {
  let time = Date.now();
  Object.keys(lastMsgTimestamps).forEach(function (key) {
    if (time - lastMsgTimestamps[key] > msgMinInterval) {
      delete lastMsgTimestamps[key];
    }
  });
}, 5000);
