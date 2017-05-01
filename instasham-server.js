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
const http = require('http').Server(app);
const io = require('socket.io')(http);
const massiveInstance = massive.connectSync({connectionString: config.connectionString});


app.set("db", massiveInstance);
const db = app.get(`db`);
app.use(bodyParser.json());
app.use(cors(corsOptions));


app.use(express.static(`public`));


app.get(`api/login`, (req,res)=>{
    if(req.user.sub){
        db.run(`select * from users where auth0id = $1`,[req.user.sub],(err, re)=>{
            if(re.length === 0){
                db.run(`insert into users (username, auth0id, imageurl) values($1, $2, $3) returning id, username, imageurl;`,[req.user.name, req.user.sub, req.user.profile],(err,result)=>{
                    if(result.length > 0){
                        res.status(200).json(result)
                    }
                    else console.log(err)
                })
            }
            else res.status(200).json(re)
        })
    }
    else console.log(`error`)
});









app.listen(3005,()=>{
    console.log(`wub a dub dub!`)
})












