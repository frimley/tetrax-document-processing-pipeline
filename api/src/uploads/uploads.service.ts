import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { RedisService, UploadSession } from "../redis/redis.service";
import { S3Service, CompletedPart } from "../s3/s3.service";
import { DatabaseService } from "../database/database.service";
import { HashService } from "../common/hash.service";
import { StartMultiPartUploadDto } from "./dto/start-upload.dto";
import { EndMultiPartUploadDto } from "./dto/end-upload.dto";
import { AbortMultiPartUploadDto } from "./dto/abort-upload.dto";
import { UploadFileDto } from "./dto/upload-file.dto";
import {
  normalizeFilePath,
  calculateChunkSize,
  calculateTotalChunks,
  validatePartNumber,
  validateContentLength,
  getMissingParts,
} from "../common/utils";

export interface UploadPartParams {
  fileId: string;
  partNumber: number;
  totalChunks: number;
  contentLength: number;
  checksum?: string;
  body: Buffer;
  userId: string;
}

export interface FileStatusParams {
  filePath?: string;
  fileId?: string;
  userId: string;
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly redisService: RedisService,
    private readonly s3Service: S3Service,
    private readonly databaseService: DatabaseService,
    private readonly hashService: HashService
  ) {}

  async startMultiPartUpload(dto: StartMultiPartUploadDto, userId: string) {
    const { filePath, size, mime, projectId } = dto;

    // Normalize file path
    const normalizedPath = normalizeFilePath(filePath);

    // Check for existing upload session
    const existingSession = await this.redisService.findSessionByPath(
      projectId,
      normalizedPath
    );

    if (existingSession) {
      // Return existing session for resume
      return {
        fileId: existingSession.fileId,
        chunkSize: existingSession.chunkSize,
        totalChunks: existingSession.totalChunks,
        received: existingSession.received,
      };
    }

    // Calculate chunk parameters
    const chunkSize = calculateChunkSize(size);
    const totalChunks = calculateTotalChunks(size, chunkSize);

    // Generate unique file ID
    const fileId = uuidv4();

    // Create temporary S3 key
    const tempKey = this.s3Service.generateTempKey(projectId, fileId);

    // Create multipart upload in S3
    const { uploadId } = await this.s3Service.createMultipartUpload(
      tempKey,
      mime
    );

    // Create upload session with hash context
    const session: UploadSession = {
      fileId,
      uploadId,
      key: tempKey,
      chunkSize,
      totalChunks,
      projectId,
      filePath: normalizedPath,
      size,
      mime,
      received: [],
      etags: {},
      bytesUploaded: 0,
      sha256Context: this.hashService.createSHA256Context(),
      createdAt: new Date().toISOString(),
    };

    // Store session in Redis
    await this.redisService.setUploadSession(fileId, session);
    await this.redisService.setPathLock(projectId, normalizedPath, fileId);

    return {
      fileId,
      chunkSize,
      totalChunks,
    };
  }

  async uploadPart(params: UploadPartParams) {
    const {
      fileId,
      partNumber,
      totalChunks,
      contentLength,
      checksum,
      body,
      userId,
    } = params;

    // Get upload session
    const session = await this.redisService.getUploadSession(fileId);
    if (!session) {
      throw new NotFoundException("Upload session not found");
    }

    // Validate part number
    validatePartNumber(partNumber, session.totalChunks);

    // Validate total chunks consistency
    if (totalChunks !== session.totalChunks) {
      throw new BadRequestException(
        `Total chunks mismatch: expected ${session.totalChunks}, got ${totalChunks}`
      );
    }

    // Validate content length
    validateContentLength(
      contentLength,
      session.chunkSize,
      partNumber,
      session.totalChunks,
      session.size
    );

    // Check if part already uploaded
    if (session.received.includes(partNumber)) {
      return {
        ok: true,
        etag: session.etags[partNumber],
        already: true,
      };
    }

    // Validate checksum if provided
    if (checksum) {
      const calculatedChecksum = createHash("sha256")
        .update(body)
        .digest("hex");
      if (calculatedChecksum !== checksum) {
        throw new BadRequestException("Checksum mismatch");
      }
    }

    // Upload part to S3
    const { etag } = await this.s3Service.uploadPart(
      session.key,
      session.uploadId,
      partNumber,
      body
    );

    // Update hash context if this is the next sequential part
    let updatedHashContext = session.sha256Context;
    const nextExpectedPart = Math.max(...session.received, 0) + 1;

    if (partNumber === nextExpectedPart) {
      // Update hash with this part's data
      updatedHashContext = this.hashService.updateSHA256Context(
        session.sha256Context || this.hashService.createSHA256Context(),
        body
      );
    }

    // Update session
    const updatedReceived = [...session.received, partNumber].sort(
      (a, b) => a - b
    );
    const updatedEtags = { ...session.etags, [partNumber]: etag };
    const updatedBytesUploaded = session.bytesUploaded + body.length;

    await this.redisService.updateUploadSession(fileId, {
      received: updatedReceived,
      etags: updatedEtags,
      bytesUploaded: updatedBytesUploaded,
      sha256Context: updatedHashContext,
    });

    return {
      ok: true,
      etag,
      already: false,
    };
  }

  async getFileStatus(params: FileStatusParams) {
    const { filePath, fileId, userId } = params;

    let session: UploadSession | null = null;

    if (fileId) {
      session = await this.redisService.getUploadSession(fileId);
    } else if (filePath) {
      // We need projectId to look up by path, but it's not provided in the query
      // This is a limitation - we'd need to either require projectId or store path->fileId mapping differently
      throw new BadRequestException("fileId is required for status lookup");
    }

    if (!session) {
      throw new NotFoundException("Upload session not found");
    }

    const missing = getMissingParts(session.received, session.totalChunks);

    return {
      fileId: session.fileId,
      status:
        session.received.length === session.totalChunks
          ? "complete"
          : "uploading",
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      received: session.received,
      missing,
      bytesUploaded: session.bytesUploaded,
    };
  }

  async endMultiPartUpload(dto: EndMultiPartUploadDto, userId: string) {
    const { fileId } = dto;

    try {
      // Get upload session
      const session = await this.redisService.getUploadSession(fileId);
      if (!session) {
        throw new NotFoundException("Upload session not found");
      }

      // Check if all parts are present
      const missing = getMissingParts(session.received, session.totalChunks);
      if (missing.length > 0) {
        throw new ConflictException({
          message: "Upload incomplete",
          missing,
        });
      }

      // Prepare parts for S3 completion
      const parts: CompletedPart[] = session.received.map((partNumber) => ({
        PartNumber: partNumber,
        ETag: session.etags[partNumber],
      }));

      // Finalize SHA-256 hash
      let blobHash: string;
      if (session.sha256Context) {
        blobHash = this.hashService.finalizeSHA256(session.sha256Context);
      } else {
        // Fallback: generate hash based on file metadata (not ideal, but better than nothing)
        const hashInput = `${session.projectId}:${session.filePath}:${
          session.size
        }:${Date.now()}`;
        blobHash = createHash("sha256").update(hashInput).digest("hex");
      }

      // Check for existing file with same hash in the project
      const existingFile = await this.databaseService.findExistingFileByHash(
        session.projectId,
        blobHash
      );

      if (existingFile) {
        // Duplicate file found
        console.log(
          `Duplicate file detected: ${blobHash} for project ${session.projectId}. Aborting upload and cleaning up.`
        );

        // Abort the multipart upload to clean up S3 temp parts
        await this.s3Service.abortMultipartUpload(
          session.key,
          session.uploadId
        );

        // Clean up Redis session and path lock
        await Promise.all([
          this.redisService.deleteUploadSession(fileId),
          this.redisService.deletePathLock(session.projectId, session.filePath),
        ]);

        return {
          status: "Duplicate",
          blobHash,
          existingFile: {
            id: existingFile.id,
            name: existingFile.name,
            s3Key: existingFile.s3_object_key,
            createdAt: existingFile.created_at,
          },
          message: "File already exists in project. Upload ignored.",
        };
      }

      // No duplicate - proceed with normal upload completion
      const metadata = {
        sha256: blobHash,
        "original-filename": session.filePath.split("/").pop() || "unknown",
        "upload-timestamp": new Date().toISOString(),
        "project-id": session.projectId,
        "file-size": session.size.toString(),
        "mime-type": session.mime,
      };

      // Complete multipart upload in S3 with metadata
      await this.s3Service.completeMultipartUpload(
        session.key,
        session.uploadId,
        parts,
        metadata
      );

      // Generate final S3 key using the actual hash
      const finalKey = this.s3Service.generateProjectKey(
        session.projectId,
        blobHash
      );

      // Copy from temp location to final location
      await this.s3Service.copyObject(session.key, finalKey);

      // Delete temp object
      await this.s3Service.deleteObject(session.key);

      // Save file record to database
      await this.databaseService.createFile({
        name: session.filePath.split("/").pop() || "unknown",
        project_id: session.projectId,
        s3_object_key: finalKey,
        size_bytes: session.size,
        sha256_checksum: blobHash,
      });

      // Clean up Redis
      await this.redisService.deleteUploadSession(fileId);
      await this.redisService.deletePathLock(
        session.projectId,
        session.filePath
      );

      return {
        status: "Received",
        blobHash,
        s3Key: finalKey,
      };
    } catch (error) {
      console.error("Error in endMultiPartUpload:", error);

      // If it's a known error (validation, not found, etc.), re-throw it
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // For any other error, return generic error status
      return {
        status: "Error",
        message: "An error occurred while completing the upload",
        error: error.message || "Unknown error",
      };
    }
  }

  async abortMultiPartUpload(dto: AbortMultiPartUploadDto, userId: string) {
    const { fileId } = dto;

    // Get upload session
    const session = await this.redisService.getUploadSession(fileId);
    if (!session) {
      throw new NotFoundException("Upload session not found");
    }

    // Abort multipart upload in S3
    await this.s3Service.abortMultipartUpload(session.key, session.uploadId);

    // Clean up Redis
    await this.redisService.deleteUploadSession(fileId);
    await this.redisService.deletePathLock(session.projectId, session.filePath);

    return {
      message: "Upload aborted successfully",
    };
  }

  /**
   * Upload a single file directly (any size)
   * Combines the logic of startMultiPartUpload, uploadPart, and endMultiPartUpload
   */
  async uploadFile(dto: UploadFileDto, file: Buffer, userId: string) {
    const { filePath, mime, projectId, originalName } = dto;
    const fileSize = file.length;

    try {
      // Normalize file path
      const normalizedPath = normalizeFilePath(filePath);

      // Calculate SHA-256 hash of the file content
      const blobHash = createHash("sha256").update(file).digest("hex");

      // Check for existing file with same hash in the project
      const existingFile = await this.databaseService.findExistingFileByHash(
        projectId,
        blobHash
      );

      if (existingFile) {
        // Duplicate file found
        console.log(
          `Duplicate file detected: ${blobHash} for project ${projectId}. Upload ignored.`
        );

        // No need to upload anything - just return duplicate status
        return {
          status: "Duplicate",
          blobHash,
          fileSize,
          existingFile: {
            id: existingFile.id,
            name: existingFile.name,
            s3Key: existingFile.s3_object_key,
            createdAt: existingFile.created_at,
          },
          message: "File already exists in project. Upload ignored.",
        };
      }

      // No duplicate - proceed with normal upload
      const finalKey = this.s3Service.generateProjectKey(projectId, blobHash);

      // Upload to final location
      const metadata = {
        sha256: blobHash,
        "original-filename":
          originalName || normalizedPath.split("/").pop() || "unknown",
        "upload-timestamp": new Date().toISOString(),
        "project-id": projectId,
        "file-size": fileSize.toString(),
        "mime-type": mime,
      };

      await this.s3Service.uploadSingleFile(finalKey, file, mime, metadata);

      // Save file record to database
      await this.databaseService.createFile({
        name: originalName || normalizedPath.split("/").pop() || "unknown",
        project_id: projectId,
        s3_object_key: finalKey,
        size_bytes: fileSize,
        sha256_checksum: blobHash,
      });

      return {
        status: "Received",
        blobHash,
        s3Key: finalKey,
        fileSize,
      };
    } catch (error) {
      console.error("Error in uploadFile:", error);

      // If it's a known error (validation, not found, etc.), re-throw it
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // For any other error, return generic error status
      return {
        status: "Error",
        message: "An error occurred while uploading the file",
        error: error.message || "Unknown error",
      };
    }
  }
}
