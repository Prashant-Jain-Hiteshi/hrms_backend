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
import { DocumentCategoryService } from '../services/document-category.service';
import { CreateDocumentCategoryDto } from '../dto/create-document-category.dto';
import { UpdateDocumentCategoryDto } from '../dto/update-document-category.dto';

@Controller('document/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentCategoryController {
  constructor(private readonly documentCategoryService: DocumentCategoryService) {}

  /**
   * Create a new document category
   * Only HR and Admin can create categories
   */
  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  async create(
    @Body() createDto: CreateDocumentCategoryDto,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Creating document category via API:', createDto);
      
      const tenantId = req.user.tenantId;
      const category = await this.documentCategoryService.create(createDto, tenantId);
      
      return {
        success: true,
        message: 'Document category created successfully',
        data: category,
      };
    } catch (error) {
      console.error('❌ ERROR - API create category failed:', error);
      throw error;
    }
  }

  /**
   * Get all document categories
   * All authenticated users can view categories
   */
  @Get()
  async findAll(
    @Query('includeInactive') includeInactive: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Fetching document categories via API');
      
      const tenantId = req.user.tenantId;
      const includeInactiveFlag = includeInactive === 'true';
      
      const categories = await this.documentCategoryService.findAll(tenantId, includeInactiveFlag);
      
      return {
        success: true,
        message: 'Document categories fetched successfully',
        data: categories,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch categories failed:', error);
      throw error;
    }
  }

  /**
   * Get active document categories for dropdowns
   * All authenticated users can view active categories
   */
  @Get('active')
  async findActive(@Request() req: any) {
    try {
      console.log('🔍 DEBUG - Fetching active document categories via API');
      
      const tenantId = req.user.tenantId;
      const categories = await this.documentCategoryService.findActive(tenantId);
      
      return {
        success: true,
        message: 'Active document categories fetched successfully',
        data: categories,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch active categories failed:', error);
      throw error;
    }
  }

  /**
   * Get category statistics
   * Only HR and Admin can view statistics
   */
  @Get('statistics')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async getStatistics(@Request() req: any) {
    try {
      console.log('🔍 DEBUG - Fetching category statistics via API');
      
      const tenantId = req.user.tenantId;
      const stats = await this.documentCategoryService.getStatistics(tenantId);
      
      return {
        success: true,
        message: 'Category statistics fetched successfully',
        data: stats,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch category statistics failed:', error);
      throw error;
    }
  }

  /**
   * Get a single document category by ID
   * All authenticated users can view category details
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Fetching document category by ID via API:', id);
      
      const tenantId = req.user.tenantId;
      const category = await this.documentCategoryService.findOne(id, tenantId);
      
      return {
        success: true,
        message: 'Document category fetched successfully',
        data: category,
      };
    } catch (error) {
      console.error('❌ ERROR - API fetch category by ID failed:', error);
      throw error;
    }
  }

  /**
   * Update a document category
   * Only HR and Admin can update categories
   */
  @Put(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDocumentCategoryDto,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Updating document category via API:', id, updateDto);
      
      const tenantId = req.user.tenantId;
      const category = await this.documentCategoryService.update(id, updateDto, tenantId);
      
      return {
        success: true,
        message: 'Document category updated successfully',
        data: category,
      };
    } catch (error) {
      console.error('❌ ERROR - API update category failed:', error);
      throw error;
    }
  }

  /**
   * Delete a document category (soft delete)
   * Only HR and Admin can delete categories
   */
  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async remove(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Deleting document category via API:', id);
      
      const tenantId = req.user.tenantId;
      await this.documentCategoryService.remove(id, tenantId);
      
      return {
        success: true,
        message: 'Document category deleted successfully',
      };
    } catch (error) {
      console.error('❌ ERROR - API delete category failed:', error);
      throw error;
    }
  }

  /**
   * Reorder document categories
   * Only HR and Admin can reorder categories
   */
  @Put('reorder/categories')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async reorderCategories(
    @Body() reorderData: { categoryOrders: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    try {
      console.log('🔍 DEBUG - Reordering document categories via API:', reorderData);
      
      const tenantId = req.user.tenantId;
      await this.documentCategoryService.reorderCategories(reorderData.categoryOrders, tenantId);
      
      return {
        success: true,
        message: 'Document categories reordered successfully',
      };
    } catch (error) {
      console.error('❌ ERROR - API reorder categories failed:', error);
      throw error;
    }
  }
}
