import redisClient from '../utils/redis';

(async () => {
    console.log(redisClient.isAlive(), "checking if alive");
    console.log(await redisClient.get('myKey'), "get mykey");
    console.log("Get ran successfully")
    await redisClient.set('myKey', 12, 5);
    console.log(await redisClient.get('myKey'), "get mykey w duration");

    setTimeout(async () => {
        console.log(await redisClient.get('myKey'), "running to see if exp");
    }, 1000*10)
})();
