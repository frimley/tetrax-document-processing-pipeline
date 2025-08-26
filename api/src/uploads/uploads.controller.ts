import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Query,
  Headers,
  Req,
  UseGuards,
  BadRequestException,
  ConflictException,
  NotFoundException,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MockJwtAuthGuard } from "../auth/mock-jwt-auth.guard";
import { UploadsService } from "./uploads.service";
import { StartMultiPartUploadDto } from "./dto/start-upload.dto";
import { EndMultiPartUploadDto } from "./dto/end-upload.dto";
import { AbortMultiPartUploadDto } from "./dto/abort-upload.dto";
import { UploadFileDto } from "./dto/upload-file.dto";
import { Request } from "express";

@Controller("uploads")
@UseGuards(MockJwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("startMultiPartUpload")
  async startMultiPartUpload(
    @Body() dto: StartMultiPartUploadDto,
    @Req() req: Request
  ) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    return await this.uploadsService.startMultiPartUpload(dto, userId);
  }

  @Put("uploadPart")
  @HttpCode(HttpStatus.OK)
  async uploadPart(
    @Headers("x-file-id") fileId: string,
    @Headers("x-part-number") partNumberStr: string,
    @Headers("x-total-chunks") totalChunksStr: string,
    @Headers("x-checksum-sha256") checksum: string,
    @Headers("content-length") contentLengthStr: string,
    @Req() req: Request
  ) {
    if (!fileId || !partNumberStr || !totalChunksStr || !contentLengthStr) {
      throw new BadRequestException(
        "Missing required headers: x-file-id, x-part-number, x-total-chunks, content-length"
      );
    }

    const partNumber = parseInt(partNumberStr);
    const totalChunks = parseInt(totalChunksStr);
    const contentLength = parseInt(contentLengthStr);

    if (isNaN(partNumber) || isNaN(totalChunks) || isNaN(contentLength)) {
      throw new BadRequestException("Invalid numeric headers");
    }

    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    // Read the raw body data
    const chunks: Buffer[] = [];
    let totalLength = 0;

    return new Promise((resolve, reject) => {
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        totalLength += chunk.length;
      });

      req.on("end", async () => {
        try {
          if (totalLength !== contentLength) {
            throw new BadRequestException(
              `Content length mismatch: expected ${contentLength}, got ${totalLength}`
            );
          }

          const body = Buffer.concat(chunks);

          const result = await this.uploadsService.uploadPart({
            fileId,
            partNumber,
            totalChunks,
            contentLength,
            checksum,
            body,
            userId,
          });

          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      req.on("error", (error) => {
        reject(error);
      });
    });
  }

  @Get("fileStatus")
  async getFileStatus(
    @Req() req: Request,
    @Query("filePath") filePath?: string,
    @Query("fileId") fileId?: string
  ) {
    if (!filePath && !fileId) {
      throw new BadRequestException(
        "Either filePath or fileId query parameter is required"
      );
    }

    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    return await this.uploadsService.getFileStatus({
      filePath,
      fileId,
      userId,
    });
  }

  @Post("endMultiPartUpload")
  async endMultiPartUpload(
    @Body() dto: EndMultiPartUploadDto,
    @Req() req: Request
  ) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    return await this.uploadsService.endMultiPartUpload(dto, userId);
  }

  @Delete("abortMultiPartUpload")
  @HttpCode(HttpStatus.OK)
  async abortMultiPartUpload(
    @Body() dto: AbortMultiPartUploadDto,
    @Req() req: Request
  ) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    return await this.uploadsService.abortMultiPartUpload(dto, userId);
  }

  /**
   * Upload a single file directly (any size)
   * Combines start, upload, and end in one operation
   */
  @Post("uploadFile")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @UploadedFile() file: any,
    @Body() dto: UploadFileDto,
    @Req() req: Request
  ) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }

    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Convert file buffer and pass DTO and file content to service
    const fileBuffer = Buffer.from(file.buffer);

    return await this.uploadsService.uploadFile(
      {
        ...dto,
        originalName: dto.originalName || file.originalname,
        mime: dto.mime || file.mimetype,
      },
      fileBuffer,
      userId
    );
  }
}
