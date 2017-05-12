exports = module.exports = {}

exports.connect = function(io){
    io.on('connect', socket => {
        socket.on('join', room => {
            socket.join(room)
        })
    })
}

exports.searchFriends = function(db){
    return (req, res) => {
        const query = 'SELECT * FROM following INNER JOIN users ON following.follower = users.id WHERE userid = $1 AND LOWER(username) LIKE LOWER($2)'
        db.run(query, [req.params.userid, `%${req.params.search}%`], (err, response) => {
            if(err) console.log(err)
            res.json(response)
        })
    }
}

exports.findUser = function(db){
    return (req, res) => {
        db.run('SELECT * FROM users WHERE id = $1', [req.params.userid], (err, response) => {
            if(err) console.log(err)
            res.json(response[0])
        })
    }
}

exports.newMessage = function(io, db){
    return (req, res) => {
        db.run('INSERT INTO messages (senderid, receiverid, message, timestamp) VALUES ($1, $2, $3, $4)',
            [req.body.senderid, req.body.receiverid, req.body.message, new Date().toISOString()], (err) => {
                if(err) console.log(err)
                io.sockets.in(req.body.senderid).emit('newMessage')
                io.sockets.in(req.body.receiverid).emit('newMessage')
                res.end()
            })
    }
}

exports.getMessages = function(db){
    return (req, res) => {
        db.run('SELECT * FROM messages WHERE senderid = $1 OR receiverid = $1',
            [req.params.userid], (err, response) => {
                if(err) console.log(err)
                // Separtate messages into chats
                let chats = {}
                response.forEach(message => {
                    let added = false
                    let id = message.senderid
                    if(id === req.params.userid)
                        id = message.receiverid
                    for(var prop in chats){
                        if(prop === id){
                            chats[prop].push(message)
                            added = true
                        }
                    }
                    if(!added){
                        chats[id] = [message]
                    }
                })
                res.json(chats)
            })
    }
}


