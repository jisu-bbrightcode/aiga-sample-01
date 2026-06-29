// packages/core/storage/types.ts
export interface StorageProvider {
  generatePresignedUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<{ uploadUrl: string; publicUrl: string }>;
  deleteObject(key: string): Promise<void>;
}

export interface StorageConfig {
  provider: "s3" | "r2" | "local";
  bucket?: string;
  region?: string;
  endpoint?: string;
  publicUrl?: string;
}
