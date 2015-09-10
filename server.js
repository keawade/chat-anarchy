var express = require('express'),
    http = require('http'),
    Moniker = require('moniker'),
    favicon = require('serve-favicon'),
    hbs = require('hbs'),
    util = require('util'),
    set = require('set'),
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
app.set('port', process.env.PORT || 80);
app.set('ip', process.env.IP || '0.0.0.0');

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
var rooms = {};

var io = require('socket.io')(server);

io.on('connection', function(socket) {
    socket.user = names.choose();
    //console.log("%s connected.", socket.user);
    socket
        .on('join', function(room) {
            //console.log("%s joined %s", socket.user, room);
            socket.join(socket.room = room);
            socket.nsp.in(socket.room).emit('announce', util.format('  %s joined.', socket.user));
            if (room) {
                var roster = rooms[room];
                if (!roster) {
                    roster = rooms[room] = new set();
                }
                roster.add(socket.user);
                socket.nsp.in(socket.room).emit('count', roster.size());
            }
        })
        .on('message', function(message) {
            //console.log("%s: %s %s", socket.user, message, socket.room);
            //io.to(socket.room).emit('message', {
            socket.nsp.in(socket.room).emit('message', {
                u: socket.user,
                m: message
            });
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
            if (!message || !socket.room || !rooms[socket.room]) return;

            message = message.trim().toLowerCase();
            if (message === "who" || message === "who?" || message === "who's here?" || message === "who is here?" || message === "ls") {
                var roster = rooms[socket.room];
                socket.nsp.in(socket.room).emit('announce',
                    util.format("%s are present.", roster.get().join(', ')));
            }
        })
        .on('disconnect', function() {
            //console.log("%s left %s", socket.user, socket.room);
            //io.to(socket.room).emit('left', socket.user);
            if (socket.room) {
                socket.nsp.in(socket.room).emit('announce', util.format('  %s left.', socket.user));
            }
            if (socket.room) {
                var roster = rooms[socket.room];
                if (roster) {
                    roster.remove(socket.user);
                    socket.nsp.in(socket.room).emit('count', roster.size());
                }
            }
        });
});

server.listen(process.env.PORT || 80, process.env.IP || "0.0.0.0", function(){
    var addr = server.address();
    console.log("[chat-anarchy] listening at ", addr.address + ":" + addr.port);
});
