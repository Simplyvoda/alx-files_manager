import sha1 from 'sha1';
import { dbClient } from '../utils/db.js'
import { redisClient } from '../utils/redis.js'

export default class UsersController {
    static async postNew(req, res){
        const email = req.body ? req.body.email : null;
        const password = req.body ? req.body.password : null;

        if (email === "" || !email){
            res.status(400).json({
                "error" : "Missing email"
            });
            return;
        }
        if (password === "" || !password){
            res.status(400).json({
                "error" : "Missing password"
            });
            return;
        }

        const existingUser = await (await dbClient.usersCollection()).findOne({ email });

        if (existingUser){
            res.status(400).json({
                "error" : "Already exist"
            });
            return;
        }else{
            const hashedPassword = sha1(password);
            const newUser = {
                email: email,
                password:  hashedPassword
            }

            // adding user to database
            const result = await (await dbClient.usersCollection()).insertOne(newUser);
            const generatedId = result.insertedId;
            res.status(201).json({
                "id" : generatedId,
                "email": newUser.email
            });
        }
    }

    static async getMe(req, res){
        // retrieve details of logged in user
        console.log(req.headers, "check for token")
        const token = req.headers['x-token'];
        const key = `auth_${token}`;


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
            res.status(200).json({
                "id" : user._id,
                "email": user.email
            });
        }
    }
}