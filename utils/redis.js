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
    return promisify(this.client.GET).bind(this.client)(key);
  }

  async set(key, value, dur) {
    // set the value in the redis database for the specified duration
    await promisify(this.client.SETEX)
    .bind(this.client)(key, dur, value);
  }

  async del(key) {
    // delete the value from the redis database
    await promisify(this.client.DEL).bind(this.client)(key);
  }
}

export const redisClient = new RedisClient();

export default redisClient;
