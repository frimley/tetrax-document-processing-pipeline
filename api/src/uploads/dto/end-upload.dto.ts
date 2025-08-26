import { IsUUID } from 'class-validator';

export class EndMultiPartUploadDto {
  @IsUUID()
  fileId: string;
}
