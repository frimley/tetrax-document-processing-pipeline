import { Injectable } from "@nestjs/common";
import { CompletedPart } from "../../src/s3/s3.service";

@Injectable()
export class MockS3Service {
  private mockUploads = new Map<string, any>();
  private mockObjects = new Map<string, Buffer>();

  async createMultipartUpload(
    key: string,
    contentType: string
  ): Promise<{ uploadId: string }> {
    const uploadId = `mock-upload-${Date.now()}`;
    this.mockUploads.set(uploadId, {
      key,
      contentType,
      parts: new Map(),
      createdAt: new Date(),
    });
    return { uploadId };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer
  ): Promise<{ etag: string }> {
    const upload = this.mockUploads.get(uploadId);
    if (!upload) {
      throw new Error("Upload not found");
    }

    const etag = `"mock-etag-${partNumber}-${Date.now()}"`;
    upload.parts.set(partNumber, { etag, body });

    return { etag };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
    metadata?: { [key: string]: string }
  ): Promise<{ location: string; etag: string }> {
    const upload = this.mockUploads.get(uploadId);
    if (!upload) {
      throw new Error("Upload not found");
    }

    // Combine all parts into a single buffer
    const combinedData = Buffer.concat(
      parts
        .sort((a, b) => a.PartNumber - b.PartNumber)
        .map(
          (part) => upload.parts.get(part.PartNumber)?.body || Buffer.alloc(0)
        )
    );

    this.mockObjects.set(key, combinedData);
    this.mockUploads.delete(uploadId);

    return {
      location: `mock://test-bucket/${key}`,
      etag: `"mock-completed-etag-${Date.now()}"`,
    };
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.mockUploads.delete(uploadId);
  }

  async healthCheck(): Promise<void> {
    // Always succeeds in test environment
    return Promise.resolve();
  }

  /**
   * Upload a single file directly (mock)
   */
  async uploadSingleFile(
    key: string,
    body: Buffer,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<{ etag: string; location: string }> {
    // Store the file data
    this.mockObjects.set(key, body);

    return {
      etag: `"mock-single-etag-${Date.now()}"`,
      location: `mock://test-bucket/${key}`,
    };
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const sourceData = this.mockObjects.get(sourceKey);
    if (sourceData) {
      this.mockObjects.set(destinationKey, sourceData);
    }
  }

  async deleteObject(key: string): Promise<void> {
    this.mockObjects.delete(key);
  }

  generateTempKey(projectId: string, fileId: string): string {
    return `tmp/${projectId}/${fileId}`;
  }

  generateProjectKey(projectId: string, identifier: string): string {
    return `projects/${projectId}/blobs/${identifier.substring(
      0,
      2
    )}/${identifier.substring(2, 4)}/${identifier}`;
  }

  // Test helpers
  getObject(key: string): Buffer | undefined {
    return this.mockObjects.get(key);
  }

  getUpload(uploadId: string): any {
    return this.mockUploads.get(uploadId);
  }

  reset(): void {
    this.mockUploads.clear();
    this.mockObjects.clear();
  }
}
