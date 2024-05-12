import { redisClient } from '../utils/redis.js';
import { dbClient } from '../utils/db.js';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { writeFile, existsSync, mkdirSync, readFile } from 'fs';
import { tmpdir } from 'os';
import mimeTypes from 'mime-types';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const PAGE_SIZE = 20;

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
            if (parentId) {
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
                    "userId": userId,
                    "name": name,
                    "type": type,
                    "isPublic": isPublic,
                    "parentId": parentId,
                })
            } else {
                // type is image or file
                const folderPath = FOLDER_PATH;
                // check if folder path exists and create it if it does not exist
                if (!existsSync(folderPath)) {
                    mkdirSync(folderPath);
                }
                const filename = uuidv4();
                const localPath = `${folderPath}/${filename}`;
                // decoding the file
                const fileData = Buffer.from(base64Data, 'base64');
                // writing the file to disk
                await writeFileAsync(localPath, fileData);
                const updatedFileDoc = { ...folderDoc, localPath: localPath }
                const newFileInfo = await (await dbClient.filesCollection()).insertOne(updatedFileDoc);
                const newFileId = newFileInfo.insertedId.toString();
                res.status(201).json({
                    "id": newFileId,
                    "userId": userId,
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

    static async getShow(req, res) {
        // retrieve user based on token
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);

        const user = await (await dbClient.usersCollection()).findOne({
            _id: ObjectId(user_id)
        });

        if (user) {
            const file_id = req.params.id;
            const file = await (await dbClient.filesCollection()).findOne({
                _id: ObjectId(file_id),
                userId: ObjectId(user_id)
            });

            if (!file) {
                res.status(404).json({ error: "Not found" });
            } else {
                res.status(200).json(file);
            }

        } else {
            res.status(401).json({ error: "Unauthorized" })
        }

    }

    static async getIndex(req, res) {
        // retrieve user based on token
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);

        const user = await (await dbClient.usersCollection()).findOne({
            _id: ObjectId(user_id)
        });
        if (user) {
            const { parentId, page } = req.query;
            parentId ? parentId : '0';
            page ? parseInt(page) : 0;

            const skip = page * PAGE_SIZE;

            // Construct the aggregation pipeline
            // try and add checks for parentId - no need to convert to ObjectId if its 0
            const pipeline = [
                { $match: { parentId: ObjectId(parentId), userId: user._id } },
                { $skip: skip },
                { $limit: PAGE_SIZE }
            ];

            // Execute the aggregation pipeline
            const results = await (await dbClient.filesCollection()).aggregate(pipeline).toArray();

            // Return the paginated results
            res.status(200).json(results);

        } else {
            res.status(401).json({ error: "Unauthorized" })
        }


    }

    static async putPublish(req, res) {
        // find the file based on the id
        // set isPublic to true
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);

        const user = await (await dbClient.usersCollection()).findOne({
            _id: ObjectId(user_id)
        });

        if (user) {
            const file_id = req.params.id;
            const file = await (await dbClient.filesCollection()).findOne({
                _id: ObjectId(file_id),
                userId: ObjectId(user_id)
            });

            if (!file) {
                res.status(404).json({ error: "Not found" });
            } else {
                try {
                    const update = {
                        $set: {
                            isPublic: true
                        }
                    }

                    const updatedFileDoc = await (await dbClient.filesCollection()).updateOne({ _id: file._id}, update);

                    if (updatedFileDoc.matchedCount === 1) {
                        res.status(200).json(file);
                    }
                } catch (e) {
                    res.status(500).json({ error: "Internal server error" });
                }
            }

        } else {
            res.status(401).json({ error: "Unauthorized" })
        }

    }

    static async putUnPublish(req, res) {
        // find the file based on the id
        // set isPublic to false
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);

        const user = await (await dbClient.usersCollection()).findOne({
            _id: ObjectId(user_id)
        });

        if (user) {
            const file_id = req.params.id;
            const file = await (await dbClient.filesCollection()).findOne({
                _id: ObjectId(file_id),
                userId: ObjectId(user_id)
            });

            if (!file) {
                res.status(404).json({ error: "Not found" });
            } else {
                try {
                    const update = {
                        $set: {
                            isPublic: false
                        }
                    }

                    const updatedFileDoc = await (await dbClient.filesCollection()).updateOne({ _id: file._id}, update);

                    if (updatedFileDoc.matchedCount === 1) {
                        res.status(200).json(file);
                    }
                } catch (e) {
                    res.status(500).json({ error: "Internal server error" });
                }
            }

        } else {
            res.status(401).json({ error: "Unauthorized" })
        }

    }

    static async getFile(req, res) {
        const token = req.headers['x-token'];
        const key = `auth_${token}`;

        const user_id = await redisClient.get(key);

        const user = await (await dbClient.usersCollection()).findOne({
            _id: ObjectId(user_id)
        });

        if(user){
            const file_id = req.params.id;
            const file = await (await dbClient.filesCollection()).findOne({
                _id: ObjectId(file_id),
                userId: ObjectId(user_id)
            });

            // if the user is not the owner of the file
            // if the files isnt public
            if (!file || !file.isPublic) {
                res.status(404).json({ error: "Not found" });
            } else {
                if (file.type === "folder"){
                    res.status(400).json({ error: "A folder doesn\'t have content " });
                }else{
                    // if checker fails this try adding file size to the file path
                    let filePath = file.localPath;
                    if (size) {
                      filePath = `${file.localPath}_${size}`;
                    }
                    const fileData = await readFileAsync(filePath);
                    if(!fileData){
                        // if there is no file data or the file is empty
                        res.status(404).json({ error: "Not found" });
                    }else{
                        // by using mime-types get MIME-type based on file name
                        // return file content with correct mime type
                        const absoluteFilePath = await realpathAsync(filePath);
                        const mimeType = mime.lookup(file.name);
                        res.setHeader('Content-Type', mimeType || 'text/plain; charset=utf-8');
                        res.status(200).sendFile(absoluteFilePath);
                    }
                }
            }
        }else{
            res.status(401).json({ error: "Not found" })
        }

    }
}