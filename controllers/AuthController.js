import uuid from "uuid";
import sha1 from "sha1";
import { dbClient } from '../utils/db.js';
import { redisClient } from '../utils/redis.js';


export default class AuthController{
    static async getConnect(req, res){
        const authHeader = req.headers['Authorization'];

        console.log(authHeader, "check auth header");
        console.log(req, "logging the whole request");

        if (!authHeader || !authHeader.startsWith('Basic ')){
            res.status(401).json({
                "error" : "Unauthorized"
            });
            return;
        }

        // slice the auth header to a new string with encoded characters
        const encodedCred = authHeader.slice("Basic ".length);

        // decode the encoded characters to a string
        const decodedCred = Buffer.from(encodedCred, 'base64').toString();
        const [email, password] = decodedCred.split(':');

        // check for user with wmail ams password
        const user = await (await dbClient.usersCollection()).findOne({
            email: email,
            password:  sha1(password)
        });

        // return 401 for unauthorized user
        if (!user){
            res.status(401).json({
                "error" : "Unauthorized"
            });
            return;
        }

        // generate a token for the user if authorized
        const token = uuid.v4();

        // store the token in redis - redis setex stores in seconds
        const key = `auth_${token}`;
        await redisClient.set(key, user._id, 60*60*24)

        // return the token to the user
        res.status(200).json({
            "token" : token
        });
    }

    static async getDisconnect(req, res){
        // retrieving token from the request header
        const token = req.headers['X-Token'];
        const key = `auth_${token}`;

        // retrieve user based on token
        const user_id = await redisClient.get(key);
        const user = await (await dbClient.usersCollection()).findOne({
            _id: user_id
        });

        if (!user){
            res.status(401).json({
                "error" : "Unauthorized"
            });
            return;
        }else{
            // delete token from redis
            await redisClient.del(key);
            res.status(204)
            return;
        }
    }

}