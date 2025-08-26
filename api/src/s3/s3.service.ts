import { Injectable } from "@nestjs/common";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";

export interface MultipartUploadResult {
  uploadId: string;
  key: string;
}

export interface UploadPartResult {
  etag: string;
}

export interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    const s3Config: any = {
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minio",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minio12345",
      },
    };

    // For MinIO/local development
    if (process.env.S3_ENDPOINT) {
      s3Config.endpoint = process.env.S3_ENDPOINT;
      s3Config.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
    }

    this.s3Client = new S3Client(s3Config);
    this.bucket = process.env.S3_BUCKET || "tetrax-dev-bucket";
  }

  async createMultipartUpload(
    key: string,
    contentType: string
  ): Promise<MultipartUploadResult> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const result = await this.s3Client.send(command);

    return {
      uploadId: result.UploadId!,
      key,
    };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer
  ): Promise<UploadPartResult> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    });

    const result = await this.s3Client.send(command);

    return {
      etag: result.ETag!,
    };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
    metadata?: { [key: string]: string }
  ): Promise<{ location: string; etag: string }> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    const result = await this.s3Client.send(command);

    // If metadata is provided, update the object with metadata
    if (metadata) {
      await this.updateObjectMetadata(key, metadata);
    }

    return {
      location: result.Location!,
      etag: result.ETag!,
    };
  }

  /**
   * Update object metadata
   */
  private async updateObjectMetadata(
    key: string,
    metadata: { [key: string]: string }
  ): Promise<void> {
    const { CopyObjectCommand } = await import("@aws-sdk/client-s3");

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      Key: key,
      CopySource: `${this.bucket}/${key}`,
      Metadata: metadata,
      MetadataDirective: "REPLACE",
    });

    await this.s3Client.send(command);
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });

    await this.s3Client.send(command);
  }

  /**
   * Health check - verify S3/MinIO connectivity
   */
  async healthCheck(): Promise<void> {
    const { HeadBucketCommand } = await import("@aws-sdk/client-s3");

    const command = new HeadBucketCommand({
      Bucket: this.bucket,
    });

    await this.s3Client.send(command);
  }

  /**
   * Upload a single file directly to S3 (for files < 10MB)
   */
  async uploadSingleFile(
    key: string,
    body: Buffer,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<{ etag: string; location: string }> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    const result = await this.s3Client.send(command);

    return {
      etag: result.ETag!,
      location: `https://${this.bucket}.s3.amazonaws.com/${key}`,
    };
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });

    await this.s3Client.send(command);
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  generateTempKey(projectId: string, fileId: string): string {
    return `tmp/${projectId}/${fileId}`;
  }

  generateProjectKey(projectId: string, hash: string): string {
    return `project_${projectId}/${hash}`;
  }

  calculateSHA256(data: Buffer): string {
    return createHash("sha256").update(data).digest("hex");
  }
}
