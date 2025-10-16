import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileServingController } from './file-serving.controller';

@Module({
  controllers: [FileServingController],
  providers: [FileUploadService],
  exports: [FileUploadService],
})
export class UploadModule {}
