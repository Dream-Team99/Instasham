/**
 * Created by beebe on 5/1/2017.
 */

const express = require(`express`),
      jwt = require(`express-jwt`),
      app = module.exports = express(),
      axios = require(`axios`),
      bodyParser = require(`body-parser`),
      cors = require(`cors`),
      massive = require(`massive`),
      corsOptions = {origin: 'http://localhost:3005'},
      config = require(`./.server.config.js`),
      server = require('http').Server(app),
      io = require('socket.io')(server),
      massiveInstance = massive.connectSync({connectionString: config.connectionString});
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const aws = require('aws-sdk'),
    multer = require('multer'),
    multerS3 = require('multer-s3'),
    s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: "us-west-2",
    }),

    upload = multer({
        storage: multerS3({
            s3,
            bucket: process.env.AWS_BUCKET,
            acl: 'public-read',
            metadata(req, file, cb) {
                cb(null, {fieldName: file.fieldname});
            },
            key(req, file, cb) {
                cb(null, Date.now().toString() + '.png');
            }
        })
    });




app.set("db", massiveInstance);
const db = app.get(`db`);
app.use(bodyParser.json());
app.use(cors(corsOptions));


app.use(express.static(`public`));


// --------- SOCKET.IO CHAT-START -------------- //

const chat = require('./chat.js');

chat.connect(io);
app.get('/api/chat/search/:userid/:search', chat.searchFriends(db))
app.get('/api/chat/findUser/:userid', chat.findUser(db))
app.post('/api/chat', chat.newMessage(io, db))
app.get('/api/chat/:userid', chat.getMessages(db))

// --------- SOCKET.IO CHAT-END --------------- //


app.post('/upload', upload.single('photo'), (req, res, next) => {
    res.json(req.file)
})

// Uploading a file to S3

app.post(`/api/users`, (req,res)=>{
    console.log(req.body)
    db.run(`select * from users where id = $1`,[req.body.profile.id],(err, re)=>{
        console.log(re)
        if(re || re.length > 0){
            db.run(`select * from photos where userid = $1`,[req.body.profile.id],(err,photos)=>{
                if(photos.length > 0){
                    res.status(200).json({profile: re[0], photos: photos})
                }
                else res.status(200).json({profile: re[0], photos: []})
            })
        }
        else {
            db.run(`insert into users (id, username, imageurl) values($1, $2, $3) returning id, username, imageurl;`,[req.body.profile.id, req.body.profile.name, req.body.profile.picture.data.url],(err,result)=>{
                if(result.length > 0){
                    res.status(200).json({profile: result[0], photos: []})
                }
                else console.log(err)
            })
        }
    })

});

// The main login function to check if you already exist if not,
// it will insert you into the database

app.get(`/api/getUser`,(req,res)=>{
    if(req.query){
        db.run(`SELECT * from users where LOWER(username) like LOWER($1)`,[req.query.username + `%`],(err,re)=>{
            res.status(200).json(re);
        })
    }
})
// This is used for our search engine

app.post(`/api/users/follower`, (req,res)=>{
    db.run(`Select * from following where userid = $1 and follower = $2`,[req.body.userId, req.body.followerId],(err,result)=>{
        if(result.length > 0){
            res.status(200).json(`ERR_ALREADY_FOLLOWED`)
        }
        else {
            db.run(`INSERT INTO following (userid, follower) VALUES($1,$2)`,[req.body.userId, req.body.followerId],(err,re)=>{
                res.status(200).json(re)
            })
        }
    })
})

// This checks to see if you are already following a person if not it will insert it into your following list

app.post(`/api/users/follower/delete`,(req,res)=>{
    db.run(`delete from following where userid = $1 and follower = $2`,[req.body.userId, req.body.followerId],(err,result)=>{
        res.status(200).json(`works`)
    })
})

// Delete users from your following list

app.get(`/api/users/follower/:id`, (req,res)=>{
    db.run(`SELECT follower from following where userid = $1`,[req.params.id],(err,re)=>{
        let follower = re.map((val)=>{
            return val.follower
        })
        res.status(200).json(follower)
    })
})

// Gets user id from your following list and gives you back an array
// this is used to find if someone is following you.

app.post(`/api/users/post`, (req, res)=>{
    db.run(`INSERT INTO photos (userid, timestamp, url, post_text) VALUES($1,$2,$3,$4) returning id, userid, timestamp, url`,[req.body.id,req.body.timestamp, req.body.imageUrl, req.body.post_text], (err,re)=>{
        if (err === null) res.status(200).json(re)
        else console.log(err)
    })
})

// This endpoint will insert your photo into the database after its been uploaded to S3

app.post(`/api/post/delete`, (req,res)=>{
    const urlSplit = req.body.name.split('/')
    const fileName = urlSplit[urlSplit.length-1]
    s3.deleteObject({
        Bucket: process.env.AWS_BUCKET,
        Key: fileName
    }, function(err){
        if(err)console.log(err)
        else{
            db.run(`delete from likes l
            where l.photoid = $1`,[req.body.photoid],(err,re)=>{
                if(err === null){
                    db.run(`delete from comments c
                    where c.photoid = $1`, [req.body.photoid], (error,result)=>{
                        if(error === null){
                            db.run(`delete from photos p
                            where p.id = $1`,[req.body.photoid],(ERR, respons)=>{
                                if (ERR === null){
                                    res.status(200).send(`works`)
                                }
                                else {
                                    console.log(ERR)
                                    res.status(403).send(ERR)
                                }
                            })
                        }
                        else{
                            console.log(error)
                            res.status(403).send(error)
                        }
                    })
                }
                else {
                    console.log(err)
                    res.status(403).send(`Bad Request`)
                }
            })
        }
    })

})


// This is used to delete a post



app.get(`/api/getFollowing/:id`,(req,res)=>{
    db.run(`select u.id as user_id,u.username, u.imageurl as user_image,
    p.id as photo_id, p.url, p.post_text, p.timestamp from users u
    join photos p on u.id = p.userid
    where u.id in (select follower from following
    where userid = $1)
    or u.id = $1
    order by photo_id desc`,[req.params.id],((err,re)=>{
        if(err === null) {
            res.status(200).json(re)
        }
        else {
            console.log(err)
            res.status(403).json(ERR)
        }
    }))
})


// This is used to get all the posts from the people you are following

app.get(`/api/getSinglePost/:id`,(req,res)=>{
    db.run(`SELECT u.id as user_id, username, imageurl as user_image,p.id as photo_id, url, timestamp, post_text from users u
            left join photos p on u.id = p.userid
            where p.id = $1`,[req.params.id],(err,response)=>{
        res.status(200).json(response);
    })
})

// This is used for our Post component to find a single post by a user

app.get(`/api/getComments/:photoId`,(req,res)=>{
    db.run(`SELECT userid, comment, timestamp, username, imageurl from comments c
left join users u on u.id = c.userid where photoid = $1`,[req.params.photoId],(err,re)=>{
        res.status(200).json(re)
    })
})

// This is used to gets comments by the photo id

app.post(`/api/postComment`,(req,res)=>{
    db.run(`INSERT INTO comments (userid, photoid, comment, timestamp) values($1,$2,$3,$4)`,[req.body.userid, req.body.photoid,req.body.comment, req.body.timestamp],(err,response)=>{
        console.log(err)
        db.run(`SELECT userid, comment, timestamp, username, imageurl from comments c
                left join users u on u.id = c.userid where photoid = $1`,[req.body.photoid],(err,re)=>{
            console.log(err,re)
            res.status(200).json(re)
        })
    })
})

// This is used to post comments on photos

app.get(`/api/getLikes/:photoId`,(req,res)=>{
    db.run(`SELECT count(userid) as likes from likes where photoid = $1`,[req.params.photoId],(err,re)=>{
        res.status(200).json(re)
    })
})
//  This is used to get likes for a single post

app.post(`/api/postLikes`, (req,res)=>{
    db.run(`SELECT userid  from likes where photoid = $1 and userid = $2`,[req.body.photoid,req.body.userid],(err,result)=> {
        if(result.length < 1){
            db.run(`INSERT INTO likes (userid, photoid) VALUES($1,$2)`, [req.body.userid, req.body.photoid], (err, re) => {
                db.run(`SELECT count(userid) as likes from likes where photoid = $1`, [req.body.photoid], (err, response) => {
                    res.status(200).json(response)
                })
            })
        }
        else {
            db.run(`SELECT count(userid) as likes from likes where photoid = $1`, [req.body.photoid], (err, response) => {
                res.status(200).json(response)
            })
        }
    })
})

// This is used to post likes if not already posted before

app.get(`/api/getFollowing/count/:id`,(req,res)=>{
    db.run(`Select count(userid) as
     following_count from following
     where userid = $1`,[req.params.id],(err,following)=>{
        db.run(`Select count(following) as
     follower_count from following
     where follower = $1`,[req.params.id],(err,follower)=>{
            db.run(`SELECT count(userid) from photos
                where userid = $1`,[req.params.id],(err,result)=>{
                if(err === null){
                    res.status(200).json({follower_count: follower[0].follower_count, following_count: following[0].following_count, post_count: result[0].count})
                }
                else {
                    console.log(err)
                    res.status(403).send(`bad`)
                }
            })
        })
    })
})

// This is used to get the number of Posts, Followers and people the user is following



server.listen(3005,()=> {
    console.log(`wub a dub dub!`)
});





