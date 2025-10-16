import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { createMulterStorage, uploadConfigs } from './storage.config';
import { createFileFilter, validateFileSize } from './file-validation';

export const createMulterOptions = (uploadType: keyof typeof uploadConfigs): MulterOptions => {
  return {
    storage: createMulterStorage(uploadType),
    fileFilter: createFileFilter(uploadType),
    limits: {
      fileSize: validateFileSize(uploadType),
      files: 10 // Maximum 10 files at once
    }
  };
};

// Pre-configured options for different upload types
export const expenseMulterOptions: MulterOptions = createMulterOptions('expenses');
export const employeeMulterOptions: MulterOptions = createMulterOptions('employees');
export const recruitmentMulterOptions: MulterOptions = createMulterOptions('recruitment');
export const documentMulterOptions: MulterOptions = createMulterOptions('documents');
