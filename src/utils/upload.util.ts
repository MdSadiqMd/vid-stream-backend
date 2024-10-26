import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { IncomingForm, Files } from 'formidable';
import { Context } from 'hono';
import { IncomingMessage } from 'http';

import { UploadResult, UploadedFile } from '../types/upload.types';

const FORM_PARSE_TIMEOUT = Infinity;
const FFMPEG_TIMEOUT = 300000;

const uploadHandler = async (c: Context) => {
    console.log('📝 Starting upload process...');
    c.header('Connection', 'keep-alive');
    try {
        const contentType = c.req.header('content-type');
        console.log('🌐 Content Type:', contentType);

        if (!contentType?.includes('multipart/form-data')) {
            console.error('❌ Invalid content type');
            return c.json({
                message: 'Invalid content type. Must be multipart/form-data',
                success: false
            }, 400);
        }

        const form = new IncomingForm({
            keepExtensions: true,
            multiples: true,
            maxFileSize: 300 * 1024 * 1024,
        });

        console.log('⏳ Parsing form data...');
        const result = await Promise.race([
            new Promise<{ fields: any; files: Files; }>((resolve, reject) => {
                console.log('🔍 Starting form parse...');
                form.parse(c.req.raw as unknown as IncomingMessage, (err, fields, files) => {
                    console.log('🔍 Parsing callback triggered...');

                    if (err) {
                        console.error('❌ Form parsing error:', err);
                        reject(err);
                        return;
                    }

                    console.log('✅ Form parsed successfully');
                    console.log('📦 Files received:', Object.keys(files));
                    console.log('🔍 Fields received:', Object.keys(fields));
                    console.log('📝 Fields:', fields);
                    resolve({ fields, files });
                });
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Form parsing timeout after ${FORM_PARSE_TIMEOUT}ms`)), FORM_PARSE_TIMEOUT)
            )
        ]).catch(error => {
            console.error('❌ Form parsing failed:', error);
            throw new Error(`Failed to parse upload form: ${error.message}`);
        });

        if (!result.files.file) {
            console.error('❌ No file found in upload');
            return c.json({
                message: 'No file found in upload',
                success: false
            }, 400);
        }

        const uploadResult: UploadResult = {
            fields: result.fields,
            files: {
                file: result.files.file as UploadedFile | UploadedFile[]
            }
        };

        const lessonId = uuidv4();
        console.log(`🆔 Generated lesson ID: ${lessonId}`);

        const videoFile = uploadResult.files.file;
        if (videoFile) {
            const fileSize = Array.isArray(videoFile) ? videoFile[0].size : videoFile.size;
            console.log(`📦 File size: ${fileSize} bytes`);
        }

        console.log('📁 Processing upload...');
        let videoFilePath: string | undefined;
        if (Array.isArray(videoFile)) {
            console.log('📁 Multiple files detected, using first file');
            videoFilePath = videoFile[0]?.filepath;
            if (!videoFilePath) {
                console.error('❌ First file in array is invalid');
                return c.json({
                    message: 'Invalid file upload',
                    success: false
                }, 400);
            }
        } else if (videoFile) {
            console.log('📁 Single file detected');
            videoFilePath = videoFile.filepath;
        }
        if (!videoFilePath) {
            console.error('❌ No valid file path found');
            return c.json({
                message: 'No valid file uploaded',
                success: false
            }, 400);
        }

        console.log(`🎥 Processing video file: ${videoFilePath}`);
        const ffmpegPromise = new Promise<Response>((resolve, reject) => {
            const outputPath = path.join('./uploads/courses', lessonId);
            const hlsPath = path.join(outputPath, 'index.m3u8');
            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }

            const ffmpegCommand = `ffmpeg -i "${videoFilePath}" \
                -codec:v libx264 \
                -codec:a aac \
                -hls_time 10 \
                -hls_playlist_type vod \
                -hls_segment_filename "${outputPath}/segment%03d.ts" \
                -start_number 0 "${hlsPath}"`;

            console.log(`🎬 Executing FFmpeg command: ${ffmpegCommand}`);

            const ffmpegProcess = exec(ffmpegCommand, { timeout: FFMPEG_TIMEOUT }, (error, stdout, stderr) => {
                console.log('🎬 FFmpeg command execution finished');
                if (error) {
                    console.error('❌ FFmpeg error:', error);
                    reject(error);
                    return;
                }

                if (!fs.existsSync(hlsPath)) {
                    reject(new Error('HLS playlist file not created'));
                    return;
                }

                const videoUrl = `http://localhost:8000/uploads/courses/${lessonId}/index.m3u8`;
                resolve(c.json({
                    message: 'Video converted to HLS format',
                    videoUrl,
                    lessonId,
                    success: true
                }));
            });

            ffmpegProcess.on('error', reject);
            ffmpegProcess.on('exit', (code) => {
                console.log(`🎬 FFmpeg process exited with code ${code}`);
                if (code !== 0 && code !== null) {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });
        });

        try {
            const result = await Promise.race([
                ffmpegPromise,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('FFmpeg conversion timeout')), FFMPEG_TIMEOUT)
                )
            ]);
            try {
                if (videoFilePath && fs.existsSync(videoFilePath)) {
                    fs.unlinkSync(videoFilePath);
                    console.log('🧹 Cleaned up temporary upload file');
                }
            } catch (cleanupError) {
                console.error('⚠️ Failed to cleanup temporary file:', cleanupError);
            }
            return result;
        } catch (error: any) {
            throw new Error(`FFmpeg conversion failed: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return c.json({
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
        }, 500);
    }
};

export default uploadHandler;