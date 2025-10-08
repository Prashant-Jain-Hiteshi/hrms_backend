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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role as UserRole } from '../../../common/enums/role.enum';
import { DocumentTypeService } from '../services/document-type.service';
import { CreateDocumentTypeDto } from '../dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from '../dto/update-document-type.dto';

@Controller('document/types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentTypeController {
  constructor(private readonly documentTypeService: DocumentTypeService) {}

  /**
   * Create a new document type
   * Only HR and Admin can create types
   */
  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  async create(
    @Body() createDto: CreateDocumentTypeDto,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Creating document type via API:', createDto);
      
      const tenantId = req.user.tenantId;
      const type = await this.documentTypeService.create(createDto, tenantId);
      
      return {
        success: true,
        message: 'Document type created successfully',
        data: type,
      };
    } catch (error) {
      console.error('❌ ERROR - API create type failed:', error);
      throw error;
    }
  }

  /**
   * Get all document types
   * All authenticated users can view types
   */
  @Get()
  async findAll(
    @Query('includeInactive') includeInactive: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Fetching document types via API');
      
      const tenantId = req.user.tenantId;
      const includeInactiveFlag = includeInactive === 'true';
      
      const types = await this.documentTypeService.findAll(tenantId, includeInactiveFlag);
      
      return {
        success: true,
        message: 'Document types fetched successfully',
        data: types,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch types failed:', error);
      throw error;
    }
  }

  /**
   * Get active document types for dropdowns
   * All authenticated users can view active types
   */
  @Get('active')
  async findActive(@Request() req: any) {
    try {
      console.log('🔍 DEBUG - Fetching active document types via API');
      
      const tenantId = req.user.tenantId;
      const types = await this.documentTypeService.findActive(tenantId);
      
      return {
        success: true,
        message: 'Active document types fetched successfully',
        data: types,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch active types failed:', error);
      throw error;
    }
  }

  /**
   * Get types that require approval
   * HR and Admin can view types requiring approval
   */
  @Get('requiring-approval')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async findTypesRequiringApproval(@Request() req: any) {
    try {
      console.log('🔍 DEBUG - Fetching types requiring approval via API');
      
      const tenantId = req.user.tenantId;
      const types = await this.documentTypeService.findTypesRequiringApproval(tenantId);
      
      return {
        success: true,
        message: 'Types requiring approval fetched successfully',
        data: types,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch types requiring approval failed:', error);
      throw error;
    }
  }

  /**
   * Get type statistics
   * Only HR and Admin can view statistics
   */
  @Get('statistics')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async getStatistics(@Request() req: any) {
    try {
      console.log('🔍 DEBUG - Fetching type statistics via API');
      
      const tenantId = req.user.tenantId;
      const stats = await this.documentTypeService.getStatistics(tenantId);
      
      return {
        success: true,
        message: 'Type statistics fetched successfully',
        data: stats,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch type statistics failed:', error);
      throw error;
    }
  }

  /**
   * Validate file against document type
   * All authenticated users can validate files
   */
  @Post(':id/validate-file')
  async validateFile(
    @Param('id') typeId: string,
    @Body() fileData: { fileName: string; fileSize: number },
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Validating file against type via API:', typeId, fileData);
      
      const tenantId = req.user.tenantId;
      const validation = await this.documentTypeService.validateFile(
        typeId,
        fileData.fileName,
        fileData.fileSize,
        tenantId,
      );
      
      return {
        success: true,
        message: 'File validation completed',
        data: validation,
      };
    } catch (error) {
      console.error('❌ ERROR - API file validation failed:', error);
      throw error;
    }
  }

  /**
   * Get a single document type by ID
   * All authenticated users can view type details
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Fetching document type by ID via API:', id);
      
      const tenantId = req.user.tenantId;
      const type = await this.documentTypeService.findOne(id, tenantId);
      
      return {
        success: true,
        message: 'Document type fetched successfully',
        data: type,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch type by ID failed:', error);
      throw error;
    }
  }

  /**
   * Update a document type
   * Only HR and Admin can update types
   */
  @Put(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDocumentTypeDto,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Updating document type via API:', id, updateDto);
      
      const tenantId = req.user.tenantId;
      const type = await this.documentTypeService.update(id, updateDto, tenantId);
      
      return {
        success: true,
        message: 'Document type updated successfully',
        data: type,
      };
    } catch (error) {
      console.error('❌ ERROR - API update type failed:', error);
      throw error;
    }
  }

  /**
   * Delete a document type (soft delete)
   * Only HR and Admin can delete types
   */
  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async remove(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Deleting document type via API:', id);
      
      const tenantId = req.user.tenantId;
      await this.documentTypeService.remove(id, tenantId);
      
      return {
        success: true,
        message: 'Document type deleted successfully',
      };
    } catch (error) {
      console.error('❌ ERROR - API delete type failed:', error);
      throw error;
    }
  }

  /**
   * Reorder document types
   * Only HR and Admin can reorder types
   */
  @Put('reorder/types')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async reorderTypes(
    @Body() reorderData: { typeOrders: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Reordering document types via API:', reorderData);
      
      const tenantId = req.user.tenantId;
      await this.documentTypeService.reorderTypes(reorderData.typeOrders, tenantId);
      
      return {
        success: true,
        message: 'Document types reordered successfully',
      };
    } catch (error) {
      console.error('❌ ERROR - API reorder types failed:', error);
      throw error;
    }
  }
}
