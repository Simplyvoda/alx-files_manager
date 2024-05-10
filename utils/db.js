// conatins functions for mongoDB client
import { MongoClient } from 'mongodb';

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';
const db_uri = `mongodb://${host}:${port}/${database}`;

class DBClient {
    constructor() {
        this.client = new MongoClient(db_uri, { useUnifiedTopology: true });

        this.client.connect();
    }

    isAlive() {
        return this.client.isConnected();
    }

    async nbUsers() {
        return this.client.db().collection('users').countDocuments();
    }

    async nbFiles() {
        return this.client.db().collection('files').countDocuments();
    }
}

export const dbClient = new DBClient();
export default dbClient;