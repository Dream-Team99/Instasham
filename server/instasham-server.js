
const express = require(`express`);
const jwt = require(`express-jwt`);
const app = module.exports = express();
const axios = require(`axios`);
const bodyParser = require(`body-parser`);
const cors = require(`cors`);
const massive = require(`massive`);
const corsOptions = {origin: 'http://localhost:3005'};
const config = require(`./.server.config.js`);
const http = require('http').Server(app);
const io = require('socket.io')(http);
const massiveInstance = massive.connectSync({connectionString: config.connectionString});


app.set("db", massiveInstance);
const db = app.get(`db`);
app.use(bodyParser.json());
app.use(cors(corsOptions));


app.use(express.static(`public`));


app.post(`/api/users`, (req,res)=>{
    db.run(`select * from users where id = $1`,[req.body.profile.id],(err, re)=>{
        if(re.length > 0){
            res.status(200).json(re[0])
        }
        else {
            db.run(`insert into users (id, username, imageurl) values($1, $2, $3) returning id, username, imageurl;`,[req.body.profile.id, req.body.profile.name, req.user.profile.picture.data.url],(err,result)=>{
                if(result.length > 0){
                    res.status(200).json(result[0])
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
});

//
// app.post(`/api/users/followers`, (req,res)=>{
//     db.run(`INSERT INTO following (userid, follower) VALUES($1,$2)`,[req.body.id, req.body.follower],(err,re)=>{
//         if(re) res.send(re)
//         else console.log(err)
//     })
// })









app.listen(3005,()=> {
    console.log(`wub a dub dub!`)
});








