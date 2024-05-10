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
	const data = await this.client.get(key)
    return data;
  }

  async set(key, value, dur) {
    // set the value in the redis database for the specified duration
	return await this.client.setex(key, dur, value)
  }

  async del(key) {
    // delete the value from the redis database
    return await this.client.del(key)
  }
}

export const redisClient = new RedisClient();

export default redisClient;
