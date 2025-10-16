import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { isImageFile, isPdfFile } from './file-validation';

export interface UploadedFileInfo {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
  url: string;
}

@Injectable()
export class FileUploadService {
  constructor(private configService: ConfigService) {}

  /**
   * Process uploaded files with compression
   */
  async processUploadedFiles(files: Express.Multer.File[]): Promise<UploadedFileInfo[]> {
    const processedFiles: UploadedFileInfo[] = [];

    for (const file of files) {
      try {
        let processedFile = file;

        // Compress images
        if (isImageFile(file.filename)) {
          processedFile = await this.compressImage(file);
        }

        // For PDFs, we could add compression here in the future
        // if (isPdfFile(file.filename)) {
        //   processedFile = await this.compressPdf(file);
        // }

        const fileInfo: UploadedFileInfo = {
          filename: processedFile.filename,
          originalName: processedFile.originalname,
          path: processedFile.path,
          size: processedFile.size,
          mimetype: processedFile.mimetype,
          url: this.generateFileUrl(processedFile.path)
        };

        processedFiles.push(fileInfo);
      } catch (error) {
        // Clean up file if processing fails
        await this.deleteFile(file.path);
        throw new BadRequestException(`Failed to process file ${file.originalname}: ${error.message}`);
      }
    }

    return processedFiles;
  }

  /**
   * Compress image files
   */
  private async compressImage(file: Express.Multer.File): Promise<Express.Multer.File> {
    try {
      const compressedPath = file.path.replace(extname(file.path), '_compressed' + extname(file.path));
      
      await sharp(file.path)
        .resize(1920, 1080, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 80,
          progressive: true 
        })
        .png({ 
          compressionLevel: 8 
        })
        .toFile(compressedPath);

      // Get compressed file stats
      const stats = await fs.stat(compressedPath);
      
      // Replace original file with compressed version
      await fs.unlink(file.path);
      await fs.rename(compressedPath, file.path);

      // Update file object
      file.size = stats.size;
      
      return file;
    } catch (error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
  }

  /**
   * Generate public URL for file access
   */
  private generateFileUrl(filePath: string): string {
    // Get base URL from environment, with fallback to localhost
    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:4000');
    const relativePath = filePath.replace(process.cwd(), '').replace(/\\/g, '/');
    return `${baseUrl}/api/files${relativePath}`;
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map(path => this.deleteFile(path)));
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string): Promise<UploadedFileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      const filename = filePath.split('/').pop() || filePath.split('\\').pop() || '';
      
      return {
        filename,
        originalName: filename,
        path: filePath,
        size: stats.size,
        mimetype: this.getMimeType(filename),
        url: this.generateFileUrl(filePath)
      };
    } catch {
      return null;
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif'
    };
    return (extension && mimeTypes[extension]) || 'application/octet-stream';
  }
}
