import { dbClient } from '../utils/db.js';
import { redisClient } from '../utils/redis.js';

export default class AppController {
    static getStatus(req, res) {
        const message = {
            "redis" : redisClient.isAlive(),
            "db" : dbClient.isAlive()
        }

        res.status(200).json(message);
    }

    static async getStats(req, res) {
        const nbUsers = await dbClient.nbUsers();
        const nbFiles = await dbClient.nbFiles();

        const message = {
            "users" : nbUsers,
            "files" : nbFiles
        }

        res.status(200).json(message);
    }
}

