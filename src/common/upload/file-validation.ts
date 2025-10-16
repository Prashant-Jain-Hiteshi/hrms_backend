import { BadRequestException } from '@nestjs/common';
import { uploadConfigs } from './storage.config';

export const createFileFilter = (uploadType: keyof typeof uploadConfigs) => {
  const config = uploadConfigs[uploadType];
  
  return (req: any, file: Express.Multer.File, cb: any) => {
    // Check file type
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !config.allowedTypes.includes(fileExtension)) {
      return cb(
        new BadRequestException(
          `Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`
        ),
        false
      );
    }
    
    // Additional MIME type validation
    const allowedMimeTypes: Record<string, string[]> = {
      pdf: ['application/pdf'],
      jpg: ['image/jpeg'],
      jpeg: ['image/jpeg'],
      png: ['image/png'],
      gif: ['image/gif'],
      doc: ['application/msword'],
      docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    };
    
    const validMimeTypes = config.allowedTypes.flatMap(type => allowedMimeTypes[type] || []);
    
    if (!validMimeTypes.includes(file.mimetype)) {
      return cb(
        new BadRequestException(
          `Invalid file format. Expected: ${config.allowedTypes.join(', ')}`
        ),
        false
      );
    }
    
    cb(null, true);
  };
};

export const validateFileSize = (uploadType: keyof typeof uploadConfigs) => {
  const config = uploadConfigs[uploadType];
  return config.maxSize;
};

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif'];
  const extension = filename.split('.').pop()?.toLowerCase();
  return imageExtensions.includes(extension || '');
};

export const isPdfFile = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension === 'pdf';
};
