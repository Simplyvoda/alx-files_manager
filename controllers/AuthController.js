import { v4 as uuidv4 } from 'uuid';
import sha1 from "sha1";
import { dbClient } from '../utils/db.js';
import { redisClient } from '../utils/redis.js';
import { ObjectId } from'mongodb';


export default class AuthController {
    static async getConnect(req, res) {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Basic ')) {
            res.status(401).json({
                "error": "Unauthorized"
            });
            return;
        }

        // slice the auth header to a new string with encoded characters
        const encodedCred = authHeader.slice("Basic ".length);

        // decode the encoded characters to a string
        const decodedCred = Buffer.from(encodedCred, 'base64').toString();
        const [email, password] = decodedCred.split(':');

        // check for user with email and password
        const user = await (await dbClient.usersCollection()).findOne({
            email,
            password: sha1(password)
        });


        // return 401 for unauthorized user
        if (!user) {
            res.status(401).json({
                "error": "Unauthorized"
            });
            return;
        } else {
            // generate a token for the user if authorized
            const token = uuidv4();
            // store the token in redis - redis setex stores in seconds
            const key = `auth_${token}`;
            try {
                await redisClient.set(key, user._id.toString(), 60 * 60 * 24);
                // return the token to the user
                res.status(200).json({
                    "token": token
                });
                return;
            } catch (error) {
                console.error("Error occurred while setting/getting Redis data:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
            

        }

    }

    static async getDisconnect(req, res) {
        // retrieving token from the request header
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        // retrieve user based on token
        const user_id = await redisClient.get(key);
        const objectId = ObjectId(user_id);
        const user = await (await dbClient.usersCollection()).findOne({
            _id: objectId
        });

        if (!user) {
            res.status(401).json({
                "error": "Unauthorized"
            });
            return;
        } else {
            // delete token from redis
            await redisClient.del(key);
            res.status(204)
            return;
        }
    }

}