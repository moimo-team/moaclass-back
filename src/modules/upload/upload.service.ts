// file-upload.service.ts
import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { JWTInput } from 'google-auth-library';

@Injectable()
export class UploadService {
  private readonly storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    credentials: JSON.parse(process.env.GCP_KEY_JSON!) as JWTInput,
  });

  async uploadFile(prefix, file: Express.Multer.File): Promise<string> {
    console.log(file);

    const bucket = this.storage.bucket(process.env.GCS_BUCKET_NAME || '');
    const blob = bucket.file(`${prefix}-${Date.now()}-${file.originalname}`);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });

    return new Promise<string>((resolve, reject) => {
      blobStream.on('error', (err) => {
        console.error('GCS upload error:', err);
        reject(err);
      });

      blobStream.on('finish', () => {
        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(imageUrl);
      });

      blobStream.end(file.buffer);
    });
  }
}
