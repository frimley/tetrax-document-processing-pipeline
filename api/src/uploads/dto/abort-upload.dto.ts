import { IsUUID } from 'class-validator';

export class AbortMultiPartUploadDto {
  @IsUUID()
  fileId: string;
}
