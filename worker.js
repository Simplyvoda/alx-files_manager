import Queue from 'bull/lib/queue';
import { imageThumbnail } from 'image-thumbnail';
import { dbClient } from './utils/db.js';
import { ObjectId } from 'mongodb';
import { promisify } from 'util';
import { writeFile } from 'fs';

const fileQueue = new Queue('fileQueue');
const userQueue = new Queue('userQueue');
const writeFileAsync = promisify(writeFile);

// create thumbnail emojis at the background
fileQueue.process(async (job, done) => {
    const { userId, fileId } = job.data;

    if (!userId) {
        throw new Error("Missing userId");
    }

    if (!fileId) {
        throw new Error("Missing fileId");
    }

    console.log('Processing', job.data.name || '');

    const file = await (await dbClient.filesCollection()).findOne({
        _id: ObjectId(fileId),
        userId: ObjectId(userId)
    });

    if (!file) {
        throw new Error("File not found");
    }

    // get file directory from local path
    const localPath = file.localPath;
    const thumbnailSizes = [500, 250, 100];

    // generate thumbnails
    await Promise.all(
        thumbnailSizes.map(async (size) => {
            const thumbnailPath = `${localPath}_${size}`;
            const thumb = await imageThumbnail(localPath, { width: size });
            return writeFileAsync(thumbnailPath, thumb)
        })
    ).then(() => { done(); });

})

// send welcome email to user at the background
// can use third party libraries like mailgun to send welcome email in real life
userQueue.process(async (job, done) => {
    const { userId } = job.data;

    if (!userId) {
        throw new Error("Missing userId");
    }

    console.log('Processing', job.data.name || '');

    const user = await (await dbClient.usersCollection()).findOne({
        _id: ObjectId(userId)
    });

    if (!user) {
        throw new Error("User not found");
    }

    // send welcome email to user
    console.log(`welcome ${user.email}!`);
    done();

})

