import { createClient } from 'redis';


class RedisClient {
	constructor() {
		this.client = createClient()
		this.client.on('error', err => console.log('Redis Client Error', err)).
			connect();
	}

	function isAlive() {
		client.on('error', (err) => {
  return false
});

client.on('connect', () => {
  return true
});

}

async function get(key){
	const value = await this.client.get(key)
	return value;
}

async function set(key, value, dur){
	await this.client.setex(key, dur, value)
}

async function del(key){
	await this.client.del(key)
}

}

const redisClient = RedisClient()

export redisClient;
