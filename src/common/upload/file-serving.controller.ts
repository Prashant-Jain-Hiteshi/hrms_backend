import { Controller, Get, Param, Res, NotFoundException, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('File Serving')
@Controller('api/files')
export class FileServingController {

  @Get('uploads/:folder/:filename')
  @ApiOperation({ summary: 'Serve uploaded files' })
  @ApiParam({ name: 'folder', description: 'Main folder (documents, expenses, employees, recruitment)' })
  @ApiParam({ name: 'filename', description: 'File name' })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async serveFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    // Handle nested folder structure for expenses
    let filePath: string;
    if (folder === 'expenses') {
      filePath = join(process.cwd(), 'uploads', 'expenses', 'receipts', filename);
    } else if (folder === 'employees') {
      filePath = join(process.cwd(), 'uploads', 'employees', 'documents', filename);
    } else if (folder === 'recruitment') {
      filePath = join(process.cwd(), 'uploads', 'recruitment', 'resumes', filename);
    } else {
      filePath = join(process.cwd(), 'uploads', folder, filename);
    }
    
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const file = createReadStream(filePath);
    
    // Set appropriate content type
    const extension = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif'
    };
    
    res.set({
      'Content-Type': extension ? (contentTypes[extension] || 'application/octet-stream') : 'application/octet-stream',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });

    return new StreamableFile(file);
  }

  @Get('download/uploads/:folder/:filename')
  @ApiOperation({ summary: 'Download uploaded files' })
  @ApiParam({ name: 'folder', description: 'Main folder (documents, expenses, employees, recruitment)' })
  @ApiParam({ name: 'filename', description: 'File name' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    // Handle nested folder structure for expenses
    let filePath: string;
    if (folder === 'expenses') {
      filePath = join(process.cwd(), 'uploads', 'expenses', 'receipts', filename);
    } else if (folder === 'employees') {
      filePath = join(process.cwd(), 'uploads', 'employees', 'documents', filename);
    } else if (folder === 'recruitment') {
      filePath = join(process.cwd(), 'uploads', 'recruitment', 'resumes', filename);
    } else {
      filePath = join(process.cwd(), 'uploads', folder, filename);
    }
    
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const file = createReadStream(filePath);
    
    // Set headers for download
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`
    });

    return new StreamableFile(file);
  }

  // Direct route for backward compatibility with stored URLs
  @Get('uploads/:folder/:subfolder/:filename')
  @ApiOperation({ summary: 'Serve files with nested folder structure (backward compatibility)' })
  @ApiParam({ name: 'folder', description: 'Main folder (expenses, employees, recruitment)' })
  @ApiParam({ name: 'subfolder', description: 'Subfolder (receipts, documents, resumes)' })
  @ApiParam({ name: 'filename', description: 'File name' })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async serveNestedFile(
    @Param('folder') folder: string,
    @Param('subfolder') subfolder: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const filePath = join(process.cwd(), 'uploads', folder, subfolder, filename);
    
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const file = createReadStream(filePath);
    
    // Set appropriate content type
    const extension = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif'
    };
    
    res.set({
      'Content-Type': extension ? (contentTypes[extension] || 'application/octet-stream') : 'application/octet-stream',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });

    return new StreamableFile(file);
  }
}
