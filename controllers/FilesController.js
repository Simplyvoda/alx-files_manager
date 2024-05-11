import { redisClient } from '../utils/redis.js';
import { dbClient } from '../utils/db.js';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import {
    mkdir, writeFile, stat, existsSync, realpath,
} from 'fs';
import { tmpdir } from 'os';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const writeFileAsync = promisify(writeFile);

export default class FilesController {
    static async postUpload(req, res) {
        // retrieve user based on token
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);

        const user = await (await dbClient.usersCollection()).findOne({
            _id: ObjectId(user_id)
        });

        if (user) {
            const name = req.body ? req.body.name : null;
            const type = req.body ? req.body.type : null;
            const parentId = req.body && req.body.parentId ? req.body.parentId : 0;
            const isPublic = req.body && req.body.isPublic ? req.body.isPublic : false;
            const base64Data = req.body && req.body.data ? req.body.data : '';

            console.log(type, "checking type of file")

            if (!name || name === "") {
                res.status(400).json({ error: "Missing name" });
            }
            if (!type || !['folder', 'file', 'image'].includes(type)) {
                res.status(400).json({ error: "Missing type" });
            }
            if (!base64Data && !['folder'].includes(type)) {
                res.status(400).json({ error: "Missing data" });
            }
            if (parentId ) {
                // check if parentfile exists in db for this id
                const parentObjId = ObjectId(parentId);
                const parentFile = await (await dbClient.filesCollection()).findOne({
                    _id: parentObjId
                })

                if (!parentFile) {
                    // if not found
                    res.status(400).json({ error: "Parent not found" });
                } else if (parentFile && !['folder'].includes(type)) {
                    // if type is not folder return error
                    res.status(400).json({ error: "Parent is not a folder" });
                }
            }
            // The user ID should be added to the document saved in DB - as owner of a file
            const userId = user_id.toString();

            const folderDoc = {
                userId: userId,
                name: name,
                type: type,
                isPublic: isPublic,
                parentId: parentId,
            }

            if (type === 'folder') {
                // add the new file document in the DB and return the new file info with a status code 201
                const newFileInfo = await (await dbClient.filesCollection()).insertOne(folderDoc);
                const newFileId = newFileInfo.insertedId.toString();
                res.status(201).json({
                    "id": newFileId,
                    "name": name,
                    "type": type,
                    "isPublic": isPublic,
                    "parentId": parentId,
                })
            } else {
                // type is image or file
                const folderPath = FOLDER_PATH;
                const filename = uuidv4();
                const localPath = `${folderPath}/${filename}`;
                // decoding the file
                const fileData = Buffer.from(base64Data, 'base64');
                // writing the file to disk
                await writeFileAsync(localPath, fileData);
                const updatedFileDoc = {...folderDoc, localPath: localPath}
                const newFileInfo = await (await dbClient.filesCollection()).insertOne(updatedFileDoc);
                const newFileId = newFileInfo.insertedId.toString();
                res.status(201).json({
                    "id": newFileId,
                    "name": name,
                    "type": type,
                    "isPublic": isPublic,
                    "parentId": parentId,
                })

            }

        } else {
            res.status(401).json({
                "error": "Unauthorized"
            });
            return;
        }


    }
}