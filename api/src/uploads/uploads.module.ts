import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";
import { SharedModule } from "../shared/shared.module";
import { AuthModule } from "../auth/auth.module";

/**
 * Uploads Module
 * Handles multipart file uploads with S3 and Redis session management
 */
@Module({
  imports: [SharedModule, AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService], // Export if other modules need upload functionality
})
export class UploadsModule {}
