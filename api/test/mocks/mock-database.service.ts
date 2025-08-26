import { Injectable } from "@nestjs/common";
import {
  FileRecord,
  CreateFileParams,
} from "../../src/database/database.service";

@Injectable()
export class MockDatabaseService {
  private files = new Map<string, FileRecord>();
  private filesByHash = new Map<string, FileRecord[]>();

  async findExistingFileByHash(
    projectId: string,
    sha256Checksum: string
  ): Promise<FileRecord | null> {
    const key = `${projectId}:${sha256Checksum}`;
    const files = this.filesByHash.get(key) || [];
    return files.length > 0 ? files[0] : null;
  }

  async createFile(params: CreateFileParams): Promise<FileRecord> {
    const fileRecord: FileRecord = {
      id: `mock-file-${Date.now()}-${Math.random()}`,
      name: params.name,
      project_id: params.project_id,
      s3_object_key: params.s3_object_key,
      size_bytes: params.size_bytes,
      sha256_checksum: params.sha256_checksum,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.files.set(fileRecord.id, fileRecord);

    // Index by project + hash for duplicate checking
    const hashKey = `${params.project_id}:${params.sha256_checksum}`;
    const existingFiles = this.filesByHash.get(hashKey) || [];
    existingFiles.push(fileRecord);
    this.filesByHash.set(hashKey, existingFiles);

    return fileRecord;
  }

  async updateFile(
    fileId: string,
    updates: Partial<Omit<FileRecord, "id" | "created_at">>
  ): Promise<FileRecord | null> {
    const existing = this.files.get(fileId);
    if (!existing) {
      return null;
    }

    const updated: FileRecord = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };

    this.files.set(fileId, updated);
    return updated;
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const existing = this.files.get(fileId);
    if (!existing) {
      return false;
    }

    // Remove from files map
    this.files.delete(fileId);

    // Remove from hash index
    const hashKey = `${existing.project_id}:${existing.sha256_checksum}`;
    const files = this.filesByHash.get(hashKey) || [];
    const filtered = files.filter((f) => f.id !== fileId);
    if (filtered.length === 0) {
      this.filesByHash.delete(hashKey);
    } else {
      this.filesByHash.set(hashKey, filtered);
    }

    return true;
  }

  async getFileById(fileId: string): Promise<FileRecord | null> {
    return this.files.get(fileId) || null;
  }

  async healthCheck(): Promise<void> {
    // Always succeeds in test environment
    return Promise.resolve();
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    // Mock transaction - just execute the callback
    return await callback({});
  }

  // Test helpers
  reset(): void {
    this.files.clear();
    this.filesByHash.clear();
  }

  getFileCount(): number {
    return this.files.size;
  }

  getAllFiles(): FileRecord[] {
    return Array.from(this.files.values());
  }

  /**
   * Add a file to the mock database (for setting up test scenarios)
   */
  addFile(file: FileRecord): void {
    this.files.set(file.id, file);

    const hashKey = `${file.project_id}:${file.sha256_checksum}`;
    const existingFiles = this.filesByHash.get(hashKey) || [];
    existingFiles.push(file);
    this.filesByHash.set(hashKey, existingFiles);
  }

  /**
   * Get files by project and hash (for testing)
   */
  getFilesByProjectAndHash(
    projectId: string,
    sha256Checksum: string
  ): FileRecord[] {
    const key = `${projectId}:${sha256Checksum}`;
    return this.filesByHash.get(key) || [];
  }
}
