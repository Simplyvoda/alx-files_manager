// Class contains the redis client
import { createClient } from "redis";

class RedisClient {
  constructor() {
    this.client = createClient();

    // log to the console on error
    this.client.on("error", (err) => console.log("Redis Client Error", err));
  }

  async isAlive() {
    // return a promise resolving to either true or false based on the connection
    return new Promise((resolve, reject) => {
      this.client.on("connect", () => resolve(true));
      this.client.on("error", () => resolve(false));
    });
  }

  async get(key) {
    // get the value from the redis database
    const value = await this.client.get(key);
    return value;
  }

  async set(key, value, dur) {
    // set the value in the redis database for the specified duration
    await this.client.setex(key, dur, value);
  }

  async del(key) {
    // delete the value from the redis database
    await this.client.del(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
