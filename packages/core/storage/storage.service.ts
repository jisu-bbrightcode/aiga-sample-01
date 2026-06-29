// packages/core/storage/storage.service.ts
import type { StorageConfig, StorageProvider } from "./types";

export function createStorageService(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case "s3":
    case "r2":
      return createS3Provider(config);
    case "local":
      return createLocalProvider(config);
    default:
      throw new Error(`Unknown storage provider: ${config.provider}`);
  }
}

function createS3Provider(config: StorageConfig): StorageProvider {
  return {
    async generatePresignedUrl(key, contentType, expiresIn = 3600) {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const client = new S3Client({ region: config.region ?? "auto", endpoint: config.endpoint });
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      const publicUrl = config.publicUrl
        ? `${config.publicUrl}/${key}`
        : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
      return { uploadUrl, publicUrl };
    },
    async deleteObject(key) {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({ region: config.region ?? "auto", endpoint: config.endpoint });
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

function createLocalProvider(_config: StorageConfig): StorageProvider {
  return {
    generatePresignedUrl(key, _contentType) {
      return Promise.resolve({ uploadUrl: `/api/upload/${key}`, publicUrl: `/uploads/${key}` });
    },
    deleteObject(_key) {
      return Promise.resolve();
    },
  };
}
