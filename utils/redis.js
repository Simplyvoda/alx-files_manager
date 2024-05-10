// Class contains the redis client
import { promisify } from "util" ;
import { createClient } from "redis";

class RedisClient {
  constructor() {
    this.client = createClient();
	this.isConnected = true;

    // log to the console on error
    this.client.on("error", (err) => { 
		console.log("Redis Client Error", err);
		this.isConnected = false;
	})

	this.client.on('connect', () => {
        this.isConnected = true;
    })
  }

  isAlive() {
    return this.isConnected
  }

  async get(key) {
    // get the value from the redis database
    console.log("get is running", key);
    const getAsync = promisify(this.client.get).bind(this.client);
    return getAsync(key);
  }

  async set(key, value, dur) {
    // set the value in the redis database for the specified duration
	console.log("set is running", key);
	await promisify(this.client.setex)
	.bind(this.client)(key, dur, value);
  }

  async del(key) {
    // delete the value from the redis database
    await promisify(this.client.del).bind(this.client)(key);
  }
}

export const redisClient = new RedisClient();

export default redisClient;
