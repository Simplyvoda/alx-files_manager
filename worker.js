import Bull from 'bull';
import { imageThumbnail } from 'image-thumbnail';
import { dbClient } from './utils/db.js';
import { ObjectId } from 'mongodb';
import { promisify } from 'util';
import { writeFile } from 'fs';

const fileQueue = new Bull('fileQueue');
const writeFileAsync = promisify(writeFile);

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

