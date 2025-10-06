import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface FileUploadConfig {
  destination: string;
  maxSize: number;
  allowedTypes: string[];
}

export const uploadConfigs = {
  expenses: {
    destination: 'uploads/expenses/receipts',
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['pdf', 'jpg', 'jpeg', 'png', 'gif']
  },
  employees: {
    destination: 'uploads/employees/documents',
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['pdf', 'jpg', 'jpeg', 'png']
  },
  recruitment: {
    destination: 'uploads/recruitment/resumes',
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['pdf', 'doc', 'docx']
  }
};

export const createMulterStorage = (uploadType: keyof typeof uploadConfigs) => {
  const config = uploadConfigs[uploadType];
  
  return diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = join(process.cwd(), config.destination);
      
      // Create directory if it doesn't exist
      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Generate filename with timestamp: timestamp_originalname.ext
      const timestamp = Date.now();
      const originalName = file.originalname.replace(/\s+/g, '_'); // Replace spaces with underscores
      const extension = extname(originalName);
      const nameWithoutExt = originalName.replace(extension, '');
      
      const filename = `${timestamp}_${nameWithoutExt}${extension}`;
      cb(null, filename);
    }
  });
};
