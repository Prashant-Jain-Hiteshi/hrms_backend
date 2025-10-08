import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UploadedFiles,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role as UserRole } from '../../../common/enums/role.enum';
import { DocumentService } from '../services/document.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { MultipleFilesUpload } from '../../../common/decorators/file-upload.decorator';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Upload a new document
   * All authenticated users can upload documents
   */
  @Post()
  @MultipleFilesUpload('files', 'documents', 1, 'Upload document file')
  async create(
    @Body() createDto: CreateDocumentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Uploading document via API:', createDto);
      
      const tenantId = req.user.tenantId;
      const uploadedBy = req.user.id;
      
      const document = await this.documentService.create(createDto, files, uploadedBy, tenantId);
      
      return {
        success: true,
        message: 'Document uploaded successfully',
        data: document,
      };
    } catch (error) {
      console.error('❌ ERROR - API upload document failed:', error);
      throw error;
    }
  }

  /**
   * Get all documents
   * All authenticated users can view documents
   */
  @Get()
  async findAll(
    @Query('categoryId') categoryId: string,
    @Query('typeId') typeId: string,
    @Query('uploadedBy') uploadedBy: string,
    @Query('search') search: string,
    @Query('isActive') isActive: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Fetching documents via API');
      
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;
      const filters = {
        categoryId,
        typeId,
        uploadedBy,
        search,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };
      
      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if ((filters as any)[key] === undefined) {
          delete (filters as any)[key];
        }
      });
      
      const documents = await this.documentService.findAll(tenantId, userRole, filters);
      
      return {
        success: true,
        message: 'Documents fetched successfully',
        data: documents,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch documents failed:', error);
      throw error;
    }
  }

  /**
   * Get my documents (uploaded by current user)
   * All authenticated users can view their own documents
   */
  @Get('my-documents')
  async findMyDocuments(@Request() req: any) {
    try {
      console.log('🔍 DEBUG - Fetching my documents via API');
      
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;
      const uploadedBy = req.user.id;
      
      const documents = await this.documentService.findAll(tenantId, userRole, { uploadedBy });
      
      return {
        success: true,
        message: 'My documents fetched successfully',
        data: documents,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch my documents failed:', error);
      throw error;
    }
  }

  /**
   * Get document statistics with role-based filtering
   * All authenticated users can view statistics for their accessible documents
   */
  @Get('statistics')
  async getStatistics(@Request() req: any) {
    try {
      console.log('🔍 DEBUG - Fetching document statistics via API');
      
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;
      const stats = await this.documentService.getStatistics(tenantId, userRole);
      
      return {
        success: true,
        message: 'Document statistics fetched successfully',
        data: stats,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch document statistics failed:', error);
      throw error;
    }
  }

  /**
   * Get a single document by ID
   * All authenticated users can view document details
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Fetching document by ID via API:', id);
      
      const tenantId = req.user.tenantId;
      const document = await this.documentService.findOne(id, tenantId);
      
      return {
        success: true,
        message: 'Document fetched successfully',
        data: document,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch document by ID failed:', error);
      throw error;
    }
  }

  /**
   * Update a document
   * All authenticated users can update documents (with restrictions in service)
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDocumentDto,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Updating document via API:', id, updateDto);
      
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const document = await this.documentService.update(id, updateDto, tenantId, userId);
      
      return {
        success: true,
        message: 'Document updated successfully',
        data: document,
      };
    } catch (error) {
      console.error('❌ ERROR - API update document failed:', error);
      throw error;
    }
  }

  /**
   * Delete a document (soft delete)
   * All authenticated users can delete documents (with restrictions in service)
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Deleting document via API:', id);
      
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      await this.documentService.remove(id, tenantId, userId);
      
      return {
        success: true,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      console.error('❌ ERROR - API delete document failed:', error);
      throw error;
    }
  }

}
