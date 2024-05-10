import sha1 from 'sha1';
import { dbClient } from '../utils/db.js'
import { redisClient } from '../utils/redis.js'

export default class UsersController {
    static async postNew(req, res){
        const user = req.body;

        if (user.email === ""){
            res.status(400).json({
                "error" : "Missing email"
            });
        }
        if (user.password === ""){
            res.status(400).json({
                "error" : "Missing password"
            });
        }

        const existingUser = await dbClient.usersCollection.findOne({email: user.email});

        if (existingUser){
            res.status(400).json({
                "error" : "Already exist"
            });
        }else{
            const hashedPassword = sha1(user.password);
            const newUser = {
                email: user.email,
                password:  hashedPassword
            }

            // adding user to database
            const res = await dbClient.usersCollection.insertOne(newUser);
            const generatedId = res.insertedId;
            res.status(201).json({
                "id" : generatedId,
                "email": newUser.email
            });
        }
    }
}