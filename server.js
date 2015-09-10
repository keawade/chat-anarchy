var express = require('express'),
    http = require('http'),
    Moniker = require('moniker'),
    favicon = require('serve-favicon'),
    hbs = require('hbs'),
    util = require('util'),
    remix = require('webremix');

var url =  /^https?\:\/\//;

var names = Moniker.generator([Moniker.adjective, Moniker.noun], {
    glue: ' '
});

var app = express();
var server = http.createServer(app);


// Set Handlebars running and as the engine for html
app.set('view engine', 'hbs');
app.engine('html', hbs.__express);

// Set the port and ip address
app.set('port', process.env.PORT || 8000);
app.set('ip', process.env.IP || '10.6.154.27');

app.use(favicon(__dirname + '/favicon.png'));

app.get('/about', function(req, res, next) {
    res.render('about', {
        title: req.path,
        about: true
    });
});

app.get('/*', function(req, res, next) {
    res.render('index', {
        title: req.path
    });
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
    socket.user = names.choose();
    //console.log("%s connected.", socket.user);
    socket
        .on('join', function(room) {
            //console.log("%s joined %s", socket.user, room);
            socket.join(socket.room = room);
            socket.nsp.in(socket.room).emit('announce', util.format('  %s joined.', socket.user));
        })
        .on('message', function(message) {
            //console.log("%s: %s %s", socket.user, message, socket.room);
            //io.to(socket.room).emit('message', {
            socket.nsp.in(socket.room).emit('message', {
                u: socket.user,
                m: message
            });
        })
        .on('message', function(message) {
            if (!message) return;
                message = message.trim();
            if (url.test(message)) {
                remix.generate(message, function(err, resp) {
                    if (!err && resp) {
                        //console.log("%s: %s %s", socket.user, message, socket.room);
                        socket.nsp.to(socket.room).emit('inject', resp);
                    }
                });
            }
        })
        .on('disconnect', function() {
            //console.log("%s left %s", socket.user, socket.room);
            //io.to(socket.room).emit('left', socket.user);
            if (socket.room) {
                socket.nsp.in(socket.room).emit('announce', util.format('  %s left.', socket.user));
            }
        });
});

server.listen(process.env.PORT || 8000, process.env.IP || "0.0.0.0", function(){
    var addr = server.address();
    console.log("[chat-anarchy] listening at ", addr.address + ":" + addr.port);
});
