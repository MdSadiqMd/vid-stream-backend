import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { IncomingForm } from 'formidable';

import { UploadResult } from '../types/upload.types';

const uploadHandler = async (c: any) => {
    const form = new IncomingForm();
    const result: UploadResult = await new Promise((resolve, reject) => {
        form.parse(c.req.raw, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files } as unknown as UploadResult);
        });
    });

    const lessonId = uuidv4();
    const videoFile = result.files.file instanceof Array ? result.files.file[0] : result.files.file;
    if (!videoFile) {
        return c.json({ message: 'No file uploaded' }, 400);
    }

    const videoPath = videoFile.filepath;
    const outputPath = path.join('./uploads/courses', lessonId);
    const hlsPath = path.join(outputPath, 'index.m3u8');

    console.log('HLS Path:', hlsPath);

    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }

    const ffmpegCommand = `ffmpeg -i "${videoPath}" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/segment%03d.ts" -start_number 0 "${hlsPath}"`;
    exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return c.json({ message: 'Error converting video' }, 500);
        }
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        const videoUrl = `http://localhost:3000/uploads/courses/${lessonId}/index.m3u8`;
        return c.json({
            message: 'Video converted to HLS format',
            videoUrl: videoUrl,
            lessonId: lessonId,
        });
    });
    return c.json({ message: 'Processing upload...' });
};

export default uploadHandler;
