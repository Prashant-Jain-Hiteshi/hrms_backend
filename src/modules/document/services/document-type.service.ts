import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { DocumentType, DocumentTypeCreationAttributes } from '../models/document-type.model';
import { CreateDocumentTypeDto } from '../dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from '../dto/update-document-type.dto';

@Injectable()
export class DocumentTypeService {
  constructor(
    @InjectModel(DocumentType)
    private documentTypeModel: typeof DocumentType,
  ) {}

  /**
   * Create a new document type
   */
  async create(
    createDto: CreateDocumentTypeDto,
    tenantId: string,
  ): Promise<DocumentType> {
    try {
      console.log('🔍 DEBUG - Creating document type:', createDto);

      // Auto-generate typeCode if not provided
      const typeCode = createDto.typeCode || 
        createDto.typeName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .substring(0, 20);

      // Check if type code already exists for this tenant
      const existingType = await this.documentTypeModel.findOne({
        where: {
          tenantId,
          typeCode,
        },
      });

      if (existingType) {
        throw new BadRequestException(`Type code '${typeCode}' already exists`);
      }

      // Check if type name already exists for this tenant
      const existingName = await this.documentTypeModel.findOne({
        where: {
          tenantId,
          typeName: createDto.typeName,
        },
      });

      if (existingName) {
        throw new BadRequestException(`Type name '${createDto.typeName}' already exists`);
      }

      // Create the type
      const typeData: DocumentTypeCreationAttributes = {
        ...createDto,
        typeCode,
        tenantId,
      };
      
      const type = await this.documentTypeModel.create(typeData);

      console.log('✅ Document type created successfully:', type.id);
      return type;
    } catch (error) {
      console.error('❌ ERROR - Failed to create document type:', error);
      throw error;
    }
  }

  /**
   * Get all document types for a tenant
   */
  async findAll(
    tenantId: string,
    includeInactive: boolean = false,
  ): Promise<DocumentType[]> {
    try {
      console.log('🔍 DEBUG - Fetching document types for tenant:', tenantId);

      const whereClause: any = { tenantId };
      
      if (!includeInactive) {
        whereClause.isActive = true;
      }

      const types = await this.documentTypeModel.findAll({
        where: whereClause,
        order: [['sortOrder', 'ASC'], ['typeName', 'ASC']],
      });

      console.log(`✅ Found ${types.length} document types`);
      return types;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch document types:', error);
      throw new BadRequestException('Failed to fetch document types');
    }
  }

  /**
   * Get active document types for dropdown/selection
   */
  async findActive(tenantId: string): Promise<DocumentType[]> {
    return this.findAll(tenantId, false);
  }

  /**
   * Get a single document type by ID
   */
  async findOne(id: string, tenantId: string): Promise<DocumentType> {
    try {
      console.log('🔍 DEBUG - Fetching document type:', id);

      const type = await this.documentTypeModel.findOne({
        where: { id, tenantId },
      });

      if (!type) {
        throw new NotFoundException(`Document type with ID ${id} not found`);
      }

      return type;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch document type:', error);
      throw error;
    }
  }

  /**
   * Update a document type
   */
  async update(
    id: string,
    updateDto: UpdateDocumentTypeDto,
    tenantId: string,
  ): Promise<DocumentType> {
    try {
      console.log('🔍 DEBUG - Updating document type:', id, updateDto);

      const type = await this.findOne(id, tenantId);

      // Check if type code is being changed and if it conflicts
      if (updateDto.typeCode && updateDto.typeCode !== type.typeCode) {
        const existingType = await this.documentTypeModel.findOne({
          where: {
            tenantId,
            typeCode: updateDto.typeCode,
            id: { [Op.ne]: id },
          },
        });

        if (existingType) {
          throw new BadRequestException(`Type code '${updateDto.typeCode}' already exists`);
        }
      }

      // Check if type name is being changed and if it conflicts
      if (updateDto.typeName && updateDto.typeName !== type.typeName) {
        const existingName = await this.documentTypeModel.findOne({
          where: {
            tenantId,
            typeName: updateDto.typeName,
            id: { [Op.ne]: id },
          },
        });

        if (existingName) {
          throw new BadRequestException(`Type name '${updateDto.typeName}' already exists`);
        }
      }

      // Update the type
      await type.update(updateDto);

      console.log('✅ Document type updated successfully:', id);
      return type;
    } catch (error) {
      console.error('❌ ERROR - Failed to update document type:', error);
      throw error;
    }
  }

  /**
   * Delete a document type (soft delete by setting isActive to false)
   */
  async remove(id: string, tenantId: string): Promise<void> {
    try {
      console.log('🔍 DEBUG - Deleting document type:', id);

      const type = await this.findOne(id, tenantId);

      // TODO: Check if type has associated documents
      // const documentCount = await this.documentModel.count({
      //   where: { typeId: id, tenantId }
      // });
      // 
      // if (documentCount > 0) {
      //   throw new BadRequestException(`Cannot delete type with ${documentCount} associated documents`);
      // }

      // Soft delete by setting isActive to false
      await type.update({ isActive: false });

      console.log('✅ Document type deleted successfully:', id);
    } catch (error) {
      console.error('❌ ERROR - Failed to delete document type:', error);
      throw error;
    }
  }

  /**
   * Get type statistics
   */
  async getStatistics(tenantId: string): Promise<any> {
    try {
      console.log('🔍 DEBUG - Fetching type statistics for tenant:', tenantId);

      const totalTypes = await this.documentTypeModel.count({
        where: { tenantId },
      });

      const activeTypes = await this.documentTypeModel.count({
        where: { tenantId, isActive: true },
      });

      const inactiveTypes = totalTypes - activeTypes;

      const stats = {
        total: totalTypes,
        active: activeTypes,
        inactive: inactiveTypes,
      };

      console.log('✅ Type statistics:', stats);
      return stats;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch type statistics:', error);
      throw new BadRequestException('Failed to fetch type statistics');
    }
  }

  /**
   * Validate file against document type constraints
   */
  async validateFile(
    typeId: string,
    fileName: string,
    fileSize: number,
    tenantId: string,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      console.log('🔍 DEBUG - Validating file against type:', { typeId, fileName, fileSize });

      const type = await this.findOne(typeId, tenantId);
      const errors: string[] = [];

      // Extract file extension
      const extension = fileName.split('.').pop()?.toLowerCase();
      
      if (!extension) {
        errors.push('File must have an extension');
      } else if (!type.isExtensionAllowed(extension)) {
        errors.push(`File extension '${extension}' is not allowed. Allowed: ${type.allowedExtensions.join(', ')}`);
      }

      // Check file size
      if (!type.isFileSizeAllowed(fileSize)) {
        errors.push(`File size exceeds maximum allowed size of ${type.getFormattedMaxSize()}`);
      }

      const isValid = errors.length === 0;

      console.log('✅ File validation result:', { isValid, errors });
      return { isValid, errors };
    } catch (error) {
      console.error('❌ ERROR - Failed to validate file:', error);
      throw error;
    }
  }

  /**
   * Reorder types
   */
  async reorderTypes(
    typeOrders: { id: string; sortOrder: number }[],
    tenantId: string,
  ): Promise<void> {
    try {
      console.log('🔍 DEBUG - Reordering types:', typeOrders);

      for (const { id, sortOrder } of typeOrders) {
        await this.documentTypeModel.update(
          { sortOrder },
          { where: { id, tenantId } }
        );
      }

      console.log('✅ Types reordered successfully');
    } catch (error) {
      console.error('❌ ERROR - Failed to reorder types:', error);
      throw new BadRequestException('Failed to reorder types');
    }
  }

  /**
   * Get types that require approval
   */
  async findTypesRequiringApproval(tenantId: string): Promise<DocumentType[]> {
    try {
      console.log('🔍 DEBUG - Fetching types requiring approval for tenant:', tenantId);

      const types = await this.documentTypeModel.findAll({
        where: {
          tenantId,
          isActive: true,
          requiresApproval: true,
        },
        order: [['typeName', 'ASC']],
      });

      console.log(`✅ Found ${types.length} types requiring approval`);
      return types;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch types requiring approval:', error);
      throw new BadRequestException('Failed to fetch types requiring approval');
    }
  }
}
