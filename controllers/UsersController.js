import sha1 from 'sha1';
import { dbClient } from '../utils/db.js'
import { redisClient } from '../utils/redis.js'

export default class UsersController {
    static async postNew(req, res){
        const email = req.body ? req.body.email : null;
        const password = req.body ? req.body.password : null;

        if (email === ""){
            res.status(400).json({
                "error" : "Missing email"
            });
            return;
        }
        if (password === ""){
            res.status(400).json({
                "error" : "Missing password"
            });
            return;
        }

        console.log(email, password)
        const existingUser = await (await dbClient.usersCollection()).findOne({ email });
        console.log(existingUser)

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
            const res = await (await dbClient.usersCollection()).insertOne(newUser);
            const generatedId = res.insertedId;
            res.status(201).json({
                "id" : generatedId,
                "email": newUser.email
            });
        }
    }
}