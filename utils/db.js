// conatins functions for mongoDB client
import { MongoClient } from 'mongodb';

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';

class DBClient {
    constructor() {
        this.client = new MongoClient(`mongodb://${host}:${port}/${database}`);

        this.client.connect();

    }

    isAlive() {
        return this.client.isConnected
    }

    async nbUsers() {
        return this.db.collection('users').countDocuments();
    }

    async nbFiles() {
        return this.db.collection('files').countDocuments();
    }
}

export const dbClient = new DBClient();
export default dbClient;