import { redisClient } from '../utils/redis.js';
import { dbClient } from '../utils/db.js';
import { ObjectId } from 'mongodb';
import mongoDBCore from 'mongodb/lib/core';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { writeFile, existsSync, mkdirSync, readFile } from 'fs';
import { contentType } from 'mime-types';
import Bull from 'bull';


const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const PAGE_SIZE = 20;

const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');

// Queue for background jobs
// create bull queue called fileQueue
const fileQueue = new Bull('fileQueue');

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

                // initiate jobs for generating thumbnails when file is created
                if (type === 'image') {
                    const jobData = { userId: userId, fileId: newFileId };
                    await fileQueue.add(jobData);
                }

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
            const userId = user_id.toString();
            const file_id = req.params.id ? req.params.id.toString() : NULL_ID;

            const file = await (await dbClient.filesCollection()).findOne({
                _id: ObjectId(file_id),
                userId: ObjectId(userId).toString(),
            });
            
            if (!file) {
                res.status(404).json({ error: "Not found" });
            } else {
                console.log("check if file was found", file)
                res.status(200).json({
                    file_id,
                    userId,
                    name: file.name,
                    type: file.type,
                    isPublic: file.isPublic,
                    parentId: file.parentId === '0'
                      ? 0
                      : file.parentId.toString(),
                  });
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
            const parentId = req.query.parentId ? req.query.parentId.toString() : '0';
            const page = /\d+/.test((req.query.page || '').toString())
                ? Number.parseInt(req.query.page, 10)
                : 0;

            const skip = page * PAGE_SIZE;

            const filesFilter = {
                userId: ObjectId(user_id).toString(),
                parentId: parentId === '0'
                  ? parentId
                  : ObjectId(parentId),
              };
          

            // Construct the aggregation pipeline
            // try and add checks for parentId - no need to convert to ObjectId if its 0
            const pipeline = [
                { $match: filesFilter },
                { $skip: skip },
                { $limit: PAGE_SIZE },
                {
                    $project: {
                        _id: 0,
                        id: '$_id',
                        userId: '$userId',
                        name: '$name',
                        type: '$type',
                        isPublic: '$isPublic',
                        parentId: {
                            $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
                        },
                    },
                },
            ];

            // Execute the aggregation pipeline
            const results = await (await (await dbClient.filesCollection()).aggregate(pipeline)).toArray();

            console.log(results, "results of aggregation pipeline");

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
                userId: ObjectId(user_id).toString(),
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

                    const updatedFileDoc = await (await dbClient.filesCollection()).updateOne({ _id: file._id }, update);

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
                userId: ObjectId(user_id).toString(),
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

                    const updatedFileDoc = await (await dbClient.filesCollection()).updateOne({ _id: file._id }, update);

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

        if (user) {
            const file_id = req.params.id;
            const size = req.query.size || null;
            const file = await (await dbClient.filesCollection()).findOne({
                _id: ObjectId(file_id),
                userId: ObjectId(user_id).toString(),
            });

            // if the user is not the owner of the file
            // if the files isnt public
            if (!file || !file.isPublic) {
                res.status(404).json({ error: "Not found" });
            } else {
                if (file.type === "folder") {
                    res.status(400).json({ error: "A folder doesn\'t have content " });
                } else {
                    // if checker fails this try adding file size to the file path
                    let filePath = file.localPath;
                    if (size) {
                        filePath = `${file.localPath}_${size}`;
                    }
                    const fileData = await readFileAsync(filePath);
                    if (!fileData) {
                        // if there is no file data or the file is empty
                        res.status(404).json({ error: "Not found" });
                    } else {
                        // by using mime-types get MIME-type based on file name
                        // return file content with correct mime type
                        const absoluteFilePath = await realpathAsync(filePath);
                        res.setHeader('Content-Type', contentType(file.name) || 'text/plain; charset=utf-8');
                        res.status(200).sendFile(absoluteFilePath);
                    }
                }
            }
        } else {
            res.status(401).json({ error: "Not found" })
        }

    }
}