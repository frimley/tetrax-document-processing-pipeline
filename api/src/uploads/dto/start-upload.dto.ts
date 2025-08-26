import { IsString, IsNumber, IsUUID, IsNotEmpty, Min } from "class-validator";

export class StartMultiPartUploadDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsNumber()
  @Min(1)
  size: number;

  @IsString()
  @IsNotEmpty()
  mime: string;

  @IsUUID()
  projectId: string;
}
