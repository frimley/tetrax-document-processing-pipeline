import { IsString, IsUUID, IsNotEmpty, IsOptional } from "class-validator";

export class UploadFileDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsString()
  @IsNotEmpty()
  mime: string;

  @IsUUID()
  projectId: string;

  @IsString()
  @IsOptional()
  originalName?: string;
}
