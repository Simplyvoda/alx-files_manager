import { redisClient } from "../utils/redis.js"
import { dbClient } from "../utils/db.js"

export default class FilesController {
    static async postUpload(req, res) {
        // retrieve user based on token
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);

        const user = await (await dbClient.usersCollection()).findOne({
            _id : user_id
        });

        if(user){
            const { name, type, parentId, isPublic, data } = req.body;

            if (!name || name === ""){
                res.status(404).send("Missing name");
            }
            if (!type || type === ""){
                res.status(404).send("Missing type");
            }

        }else{
            res.status(401).json({
                "error" : "Unauthorized"
            });
            return;
        }


    }
}