/**
 * Created by beebe on 5/1/2017.
 */

const express = require(`express`);
const jwt = require(`express-jwt`);
const app = module.exports = express();
const axios = require(`axios`);
const bodyParser = require(`body-parser`);
const cors = require(`cors`);
const massive = require(`massive`);
const corsOptions = {origin: 'http://localhost:3005'};
const config = require(`./.server.config.js`);
const server = require('http').Server(app);
const io = require('socket.io')(server);
const massiveInstance = massive.connectSync({connectionString: config.connectionString});
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const aws = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: "us-west-2",
});

// Initialize multers3 with our s3 config and other options
const upload = multer({
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
})

// Expose the /upload endpoint



app.set("db", massiveInstance);
const db = app.get(`db`);
app.use(bodyParser.json());
app.use(cors(corsOptions));


app.use(express.static(`public`));


// --------- SOCKET.IO CHAT-START -------------- //

const chat = require('./chat.js')

chat.connect(io)
app.get('/api/chat/search/:userid/:search', chat.searchFriends(db))
app.post('/api/chat', chat.newMessage(io, db))
app.get('/api/chat/:userid', chat.getMessages(db))

// --------- SOCKET.IO CHAT-END --------------- //


app.post('/upload', upload.single('photo'), (req, res, next) => {
    console.log(`hi`, req.body)
    res.json(req.file)
})

app.post(`/api/users`, (req,res)=>{
    db.run(`select * from users where id = $1`,[req.body.profile.id],(err, re)=>{
        if(re.length > 0){
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

app.get(`/api/getUser`,(req,res)=>{
    if(req.query){
        db.run(`SELECT * from users where LOWER(username) like LOWER($1)`,[req.query.username + `%`],(err,re)=>{
            res.status(200).json(re);
        })
    }
})


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
app.get(`/api/users/follower/:id`, (req,res)=>{
    db.run(`SELECT follower from following where userid = $1`,[req.params.id],(err,re)=>{
        let follower = re.map((val)=>{
            return val.follower
        })
        res.status(200).json(follower)
    })
})



app.post(`/api/users/post`, (req, res)=>{
    db.run(`INSERT INTO photos (userid, timestamp, url, post_text) VALUES($1,$2,$3,$4) returning userid, timestamp, url`,[req.body.id,req.body.timestamp, req.body.imageUrl, req.body.post_text], (err,re)=>{
        if (re.length > 0) res.status(200).json(re)
        else console.log(err)
    })
})

app.get(`/api/getFollowing/:id`,(req,res)=>{
    db.run(`select u.id as user_id,u.username, u.imageurl as user_image, 
    p.id as photo_id, p.url, p.post_text, p.timestamp, c.comment, c.userid as comment_userid, c.timestamp 
    as comment_time, cu.username as comment_user, cu.imageurl, c.photoid as commented_photo from users u
    join photos p on u.id = p.userid
    left join comments c on c.photoid = p.id
    left join users cu on cu.id = c.userid
    where u.id in 
    (select follower from following
    where userid = $1)
    order by photo_id desc`,[req.params.id],((err,re)=>{
        if(re) {
            res.status(200).json(re)
        }
        else {
            res.status(403).json(err)
        }
    }))
})

app.get(`/api/getSinglePost/:id`,(req,res)=>{
    db.run(`SELECT u.id as user_id, username, imageurl as user_image,p.id as photo_id, url, timestamp, post_text from users u
            left join photos p on u.id = p.userid
            where p.id = $1`,[req.params.id],(err,response)=>{
        res.status(200).json(response);
    })
})
app.get(`/api/getComments/:photoId`,(req,res)=>{
    db.run(`SELECT userid, comment, timestamp, username, imageurl from comments c
left join users u on u.id = c.userid where photoid = $1`,[req.params.photoId],(err,re)=>{
        res.status(200).json(re)
    })
})
// gets comments
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

// posts comments

app.get(`/api/getLikes/:photoId`,(req,res)=>{
    db.run(`SELECT count(userid) as likes from likes where photoid = $1`,[req.params.photoId],(err,re)=>{
        res.status(200).json(re)
    })
})
//  Gets likes ^^

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

// posts likes

app.get(`/api/getFollowing/count/:id`,(req,res)=>{
    db.run(`Select count(userid) as
     following_count from following
     where userid = $1`,[req.params.id],(err,following)=>{
        db.run(`Select count(following) as
     follower_count from following
     where follower = $1`,[req.params.id],(err,follower)=>{
            db.run(`SELECT count(userid) from photos
                where userid = $1`,[req.params.id],(err,result)=>{
                if(result.length > 0){
                    res.status(200).json({follower_count: follower[0].follower_count, following_count: following[0].following_count, post_count: result[0].count})
                }
                else console.log(err)
            })
        })
    })
})





server.listen(3005,()=> {
    console.log(`wub a dub dub!`)
});





