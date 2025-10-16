import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { DocumentCategory, DocumentCategoryCreationAttributes } from '../models/document-category.model';
import { CreateDocumentCategoryDto } from '../dto/create-document-category.dto';
import { UpdateDocumentCategoryDto } from '../dto/update-document-category.dto';

@Injectable()
export class DocumentCategoryService {
  constructor(
    @InjectModel(DocumentCategory)
    private documentCategoryModel: typeof DocumentCategory,
  ) {}

  /**
   * Seed default document categories for a tenant
   */
  private async seedDefaultCategories(tenantId: string): Promise<void> {
    try {
      console.log('🌱 Seeding default document categories for tenant:', tenantId);

      const defaultCategories = [
        {
          categoryName: 'HR',
          categoryCode: 'HR',
          description: 'Human Resources related documents',
          icon: 'users',
          color: '#3B82F6',
          sortOrder: 1,
          tenantId,
        },
        {
          categoryName: 'Finance',
          categoryCode: 'FINANCE',
          description: 'Financial documents and reports',
          icon: 'dollar-sign',
          color: '#10B981',
          sortOrder: 2,
          tenantId,
        },
        {
          categoryName: 'Employee',
          categoryCode: 'EMPLOYEE',
          description: 'Employee personal documents',
          icon: 'user',
          color: '#F59E0B',
          sortOrder: 3,
          tenantId,
        },
        {
          categoryName: 'Admin',
          categoryCode: 'ADMIN',
          description: 'Administrative documents',
          icon: 'settings',
          color: '#EF4444',
          sortOrder: 4,
          tenantId,
        },
      ];

      // Create default categories
      await this.documentCategoryModel.bulkCreate(defaultCategories);
      console.log('✅ Default document categories created successfully');
    } catch (error) {
      console.error('❌ Error seeding default document categories:', error);
      throw error;
    }
  }

  /**
   * Create a new document category
   */
  async create(
    createDto: CreateDocumentCategoryDto,
    tenantId: string,
  ): Promise<DocumentCategory> {
    try {
      console.log('🔍 DEBUG - Creating document category:', createDto);

      // Auto-generate categoryCode if not provided
      const categoryCode = createDto.categoryCode || 
        createDto.categoryName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .substring(0, 20);

      // Check if category code already exists for this tenant
      const existingCategory = await this.documentCategoryModel.findOne({
        where: {
          tenantId,
          categoryCode,
        },
      });

      if (existingCategory) {
        throw new BadRequestException(`Category code '${categoryCode}' already exists`);
      }

      // Check if category name already exists for this tenant
      const existingName = await this.documentCategoryModel.findOne({
        where: {
          tenantId,
          categoryName: createDto.categoryName,
        },
      });

      if (existingName) {
        throw new BadRequestException(`Category name '${createDto.categoryName}' already exists`);
      }

      // Create the category
      const categoryData: DocumentCategoryCreationAttributes = {
        ...createDto,
        categoryCode,
        tenantId,
      };
      
      const category = await this.documentCategoryModel.create(categoryData);

      console.log('✅ Document category created successfully:', category.id);
      return category;
    } catch (error) {
      console.error('❌ ERROR - Failed to create document category:', error);
      throw error;
    }
  }

  /**
   * Get all document categories for a tenant
   */
  async findAll(
    tenantId: string,
    includeInactive: boolean = false,
  ): Promise<DocumentCategory[]> {
    try {
      console.log('🔍 DEBUG - Fetching document categories for tenant:', tenantId);

      const whereClause: any = { tenantId };
      
      if (!includeInactive) {
        whereClause.isActive = true;
      }

      let categories = await this.documentCategoryModel.findAll({
        where: whereClause,
        order: [['sortOrder', 'ASC'], ['categoryName', 'ASC']],
      });

      // If no categories exist, seed default categories
      if (categories.length === 0) {
        console.log('🌱 No categories found, seeding default categories...');
        await this.seedDefaultCategories(tenantId);
        
        // Fetch categories again after seeding
        categories = await this.documentCategoryModel.findAll({
          where: whereClause,
          order: [['sortOrder', 'ASC'], ['categoryName', 'ASC']],
        });
      }

      console.log(`✅ Found ${categories.length} document categories`);
      return categories;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch document categories:', error);
      throw new BadRequestException('Failed to fetch document categories');
    }
  }

  /**
   * Get active document categories for dropdown/selection
   */
  async findActive(tenantId: string): Promise<DocumentCategory[]> {
    return this.findAll(tenantId, false);
  }

  /**
   * Get a single document category by ID
   */
  async findOne(id: string, tenantId: string): Promise<DocumentCategory> {
    try {
      console.log('🔍 DEBUG - Fetching document category:', id);

      const category = await this.documentCategoryModel.findOne({
        where: { id, tenantId },
      });

      if (!category) {
        throw new NotFoundException(`Document category with ID ${id} not found`);
      }

      return category;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch document category:', error);
      throw error;
    }
  }

  /**
   * Update a document category
   */
  async update(
    id: string,
    updateDto: UpdateDocumentCategoryDto,
    tenantId: string,
  ): Promise<DocumentCategory> {
    try {
      console.log('🔍 DEBUG - Updating document category:', id, updateDto);

      const category = await this.findOne(id, tenantId);

      // Check if category code is being changed and if it conflicts
      if (updateDto.categoryCode && updateDto.categoryCode !== category.categoryCode) {
        const existingCategory = await this.documentCategoryModel.findOne({
          where: {
            tenantId,
            categoryCode: updateDto.categoryCode,
            id: { [Op.ne]: id },
          },
        });

        if (existingCategory) {
          throw new BadRequestException(`Category code '${updateDto.categoryCode}' already exists`);
        }
      }

      // Check if category name is being changed and if it conflicts
      if (updateDto.categoryName && updateDto.categoryName !== category.categoryName) {
        const existingName = await this.documentCategoryModel.findOne({
          where: {
            tenantId,
            categoryName: updateDto.categoryName,
            id: { [Op.ne]: id },
          },
        });

        if (existingName) {
          throw new BadRequestException(`Category name '${updateDto.categoryName}' already exists`);
        }
      }

      // Update the category
      await category.update(updateDto);

      console.log('✅ Document category updated successfully:', id);
      return category;
    } catch (error) {
      console.error('❌ ERROR - Failed to update document category:', error);
      throw error;
    }
  }

  /**
   * Delete a document category (soft delete by setting isActive to false)
   */
  async remove(id: string, tenantId: string): Promise<void> {
    try {
      console.log('🔍 DEBUG - Deleting document category:', id);

      const category = await this.findOne(id, tenantId);

      // TODO: Check if category has associated documents
      // const documentCount = await this.documentModel.count({
      //   where: { categoryId: id, tenantId }
      // });
      // 
      // if (documentCount > 0) {
      //   throw new BadRequestException(`Cannot delete category with ${documentCount} associated documents`);
      // }

      // Soft delete by setting isActive to false
      await category.update({ isActive: false });

      console.log('✅ Document category deleted successfully:', id);
    } catch (error) {
      console.error('❌ ERROR - Failed to delete document category:', error);
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  async getStatistics(tenantId: string): Promise<any> {
    try {
      console.log('🔍 DEBUG - Fetching category statistics for tenant:', tenantId);

      const totalCategories = await this.documentCategoryModel.count({
        where: { tenantId },
      });

      const activeCategories = await this.documentCategoryModel.count({
        where: { tenantId, isActive: true },
      });

      const inactiveCategories = totalCategories - activeCategories;

      const stats = {
        total: totalCategories,
        active: activeCategories,
        inactive: inactiveCategories,
      };

      console.log('✅ Category statistics:', stats);
      return stats;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch category statistics:', error);
      throw new BadRequestException('Failed to fetch category statistics');
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(
    categoryOrders: { id: string; sortOrder: number }[],
    tenantId: string,
  ): Promise<void> {
    try {
      console.log('🔍 DEBUG - Reordering categories:', categoryOrders);

      for (const { id, sortOrder } of categoryOrders) {
        await this.documentCategoryModel.update(
          { sortOrder },
          { where: { id, tenantId } }
        );
      }

      console.log('✅ Categories reordered successfully');
    } catch (error) {
      console.error('❌ ERROR - Failed to reorder categories:', error);
      throw new BadRequestException('Failed to reorder categories');
    }
  }
}
