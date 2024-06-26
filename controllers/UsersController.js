import sha1 from 'sha1';
import { dbClient } from '../utils/db.js'
import { redisClient } from '../utils/redis.js'
import { ObjectId } from 'mongodb';
import Queue from 'bull/lib/queue';

// Queue for background jobs
// create bull queue called userQueue
const userQueue = new Queue('userQueue');
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
            const generatedId = result.insertedId.toString();

            // initiate job to send user welcom email
            if (generatedId) {
                const jobData = { userId: generatedId };
                await userQueue.add(jobData);
            }

            res.status(201).json({
                "id" : generatedId,
                "email": newUser.email
            });
        }
    }

    static async getMe(req, res){
        // retrieve details of logged in user
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);
        // have to convert to mongo object id before searching database
        const objectId = ObjectId(user_id);
        const user = await (await dbClient.usersCollection()).findOne({
            _id: objectId,
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