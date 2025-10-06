import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { createMulterOptions } from '../upload/multer.config';
import { uploadConfigs } from '../upload/storage.config';

/**
 * Decorator for single file upload
 */
export function SingleFileUpload(
  fieldName: string,
  uploadType: keyof typeof uploadConfigs,
  description?: string
) {
  return applyDecorators(
    UseInterceptors(FileInterceptor(fieldName, createMulterOptions(uploadType))),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description: description || `Upload ${fieldName}`,
      type: 'multipart/form-data',
      schema: {
        type: 'object',
        properties: {
          [fieldName]: {
            type: 'string',
            format: 'binary',
            description: `File to upload (${uploadConfigs[uploadType].allowedTypes.join(', ')})`
          }
        }
      }
    })
  );
}

/**
 * Decorator for multiple files upload
 */
export function MultipleFilesUpload(
  fieldName: string,
  uploadType: keyof typeof uploadConfigs,
  maxCount: number = 10,
  description?: string
) {
  return applyDecorators(
    UseInterceptors(FilesInterceptor(fieldName, maxCount, createMulterOptions(uploadType))),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description: description || `Upload multiple ${fieldName}`,
      type: 'multipart/form-data',
      schema: {
        type: 'object',
        properties: {
          [fieldName]: {
            type: 'array',
            items: {
              type: 'string',
              format: 'binary'
            },
            description: `Files to upload (${uploadConfigs[uploadType].allowedTypes.join(', ')})`
          }
        }
      }
    })
  );
}
