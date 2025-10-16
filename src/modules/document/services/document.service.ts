import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Document, DocumentCreationAttributes } from '../models/document.model';
import { DocumentCategory } from '../models/document-category.model';
import { DocumentType } from '../models/document-type.model';
import { Employee } from '../../employees/employees.model';
import { User } from '../../users/users.model';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { FileUploadService, UploadedFileInfo } from '../../../common/upload/file-upload.service';

@Injectable()
export class DocumentService {
  constructor(
    @InjectModel(Document)
    private documentModel: typeof Document,
    @InjectModel(DocumentCategory)
    private documentCategoryModel: typeof DocumentCategory,
    @InjectModel(DocumentType)
    private documentTypeModel: typeof DocumentType,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(User)
    private userModel: typeof User,
    private fileUploadService: FileUploadService,
  ) {}


  /**
   * Create a new document with file upload
   */
  async create(
    createDto: CreateDocumentDto,
    files: Express.Multer.File[],
    uploadedBy: string,
    tenantId: string,
  ): Promise<Document> {
    try {
      console.log('🔍 DEBUG - Creating document:', createDto);
      console.log('🔍 DEBUG - Uploaded by user ID:', uploadedBy);

      // Find the user and their associated employee record
      const user = await this.userModel.findOne({
        where: { id: uploadedBy },
        include: [{
          model: Employee,
          as: 'employee',
          required: true
        }]
      });

      if (!user || !user.employee) {
        throw new BadRequestException('Employee record not found for the current user. Please contact administrator.');
      }

      const employee = user.employee;
      console.log('✅ User and Employee found:', {
        userId: user.id,
        userEmail: user.email,
        employeeId: employee.id,
        employeeCode: employee.employeeId
      });

      // Validate that category and type exist and belong to tenant
      const [category, type] = await Promise.all([
        this.documentCategoryModel.findOne({
          where: { id: createDto.categoryId, tenantId, isActive: true },
        }),
        this.documentTypeModel.findOne({
          where: { id: createDto.typeId, tenantId, isActive: true },
        }),
      ]);

      if (!category) {
        throw new BadRequestException('Invalid category selected');
      }

      if (!type) {
        throw new BadRequestException('Invalid document type selected');
      }

      // Validate file upload
      if (!files || files.length === 0) {
        throw new BadRequestException('At least one file must be uploaded');
      }

      if (files.length > 1) {
        throw new BadRequestException('Only one file can be uploaded per document');
      }

      // Process uploaded file
      const processedFiles = await this.fileUploadService.processUploadedFiles(files);
      const fileInfo = processedFiles[0];

      // Create document record
      const documentData: DocumentCreationAttributes = {
        documentName: createDto.documentName,
        description: createDto.description,
        fileName: fileInfo.originalName,
        filePath: fileInfo.path,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimetype,
        fileUrl: fileInfo.url,
        categoryId: createDto.categoryId,
        typeId: createDto.typeId,
        uploadedBy: employee.id, // Use the employee UUID instead of user ID
        tenantId,
        tags: createDto.tags,
        metadata: createDto.metadata,
      };

      const document = await this.documentModel.create(documentData);

      console.log('✅ Document created successfully:', document.id);
      return await this.findOne(document.id, tenantId);
    } catch (error) {
      console.error('❌ ERROR - Failed to create document:', error);
      
      // Clean up uploaded files if document creation fails
      if (files && files.length > 0) {
        const filePaths = files.map(file => file.path);
        await this.fileUploadService.deleteFiles(filePaths);
      }
      
      throw error;
    }
  }

  /**
   * Get all documents for a tenant with role-based filtering
   */
  async findAll(
    tenantId: string,
    userRole: string,
    filters?: {
      categoryId?: string;
      typeId?: string;
      uploadedBy?: string;
      search?: string;
      isActive?: boolean;
    },
  ): Promise<Document[]> {
    try {
      console.log('🔍 DEBUG - Fetching documents for tenant:', tenantId, 'with role:', userRole);

      const whereClause: any = { 
        tenantId,
        isActive: true // Only show active documents by default
      };

      // Apply role-based filtering
      if (userRole !== 'admin' && userRole !== 'hr') {
        // Get the category for role-based filtering
        let categoryCode: string;
        switch (userRole.toLowerCase()) {
          case 'employee':
            categoryCode = 'EMPLOYEE';
            break;
          case 'finance':
            categoryCode = 'FINANCE';
            break;
          default:
            // For unknown roles, show no documents
            categoryCode = 'UNKNOWN_ROLE';
            break;
        }

        // Find the category ID for the role
        const category = await this.documentCategoryModel.findOne({
          where: { tenantId, categoryCode, isActive: true },
        });

        if (category) {
          whereClause.categoryId = category.id;
          console.log(`🔒 Role-based filter applied: ${userRole} -> ${categoryCode} (${category.id})`);
        } else {
          // If category doesn't exist, show no documents
          whereClause.categoryId = 'non-existent-category';
          console.log(`⚠️ Category ${categoryCode} not found for role ${userRole}`);
        }
      } else {
        console.log(`👑 ${userRole.toUpperCase()} role: showing all documents`);
      }

      if (filters) {
        if (filters.categoryId) {
          whereClause.categoryId = filters.categoryId;
        }
        if (filters.typeId) {
          whereClause.typeId = filters.typeId;
        }
        if (filters.uploadedBy) {
          whereClause.uploadedBy = filters.uploadedBy;
        }
        if (filters.search) {
          whereClause[Op.or] = [
            { documentName: { [Op.iLike]: `%${filters.search}%` } },
            { description: { [Op.iLike]: `%${filters.search}%` } },
          ];
        }
        // Allow explicit override of isActive filter
        if (filters.isActive !== undefined) {
          whereClause.isActive = filters.isActive;
        }
      }

      const documents = await this.documentModel.findAll({
        where: whereClause,
        include: [
          {
            model: DocumentCategory,
            as: 'category',
            attributes: ['id', 'categoryName', 'categoryCode', 'icon', 'color'],
          },
          {
            model: DocumentType,
            as: 'type',
            attributes: ['id', 'typeName', 'typeCode', 'icon', 'color'],
          },
          {
            model: Employee,
            as: 'uploader',
            attributes: ['id', 'employeeId', 'name'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      console.log(`✅ Found ${documents.length} documents`);
      return documents;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch documents:', error);
      throw error;
    }
  }

  /**
   * Get a single document by ID
   */
  async findOne(id: string, tenantId: string): Promise<Document> {
    try {
      console.log('🔍 DEBUG - Fetching document by ID:', id);

      const document = await this.documentModel.findOne({
        where: { id, tenantId },
        include: [
          {
            model: DocumentCategory,
            as: 'category',
            attributes: ['id', 'categoryName', 'categoryCode', 'icon', 'color'],
          },
          {
            model: DocumentType,
            as: 'type',
            attributes: ['id', 'typeName', 'typeCode', 'icon', 'color'],
          },
          {
            model: Employee,
            as: 'uploader',
            attributes: ['id', 'employeeId', 'name'],
          },
        ],
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      console.log('✅ Document found:', document.id);
      return document;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch document:', error);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async update(
    id: string,
    updateDto: UpdateDocumentDto,
    tenantId: string,
    userId: string,
  ): Promise<Document> {
    try {
      console.log('🔍 DEBUG - Updating document:', id, updateDto);

      const document = await this.documentModel.findOne({
        where: { id, tenantId },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      // Check if user can update this document (owner or admin/hr)
      // For now, allowing all updates - you can add role-based checks here

      // Validate category and type if being updated
      if (updateDto.categoryId) {
        const category = await this.documentCategoryModel.findOne({
          where: { id: updateDto.categoryId, tenantId, isActive: true },
        });
        if (!category) {
          throw new BadRequestException('Invalid category selected');
        }
      }

      if (updateDto.typeId) {
        const type = await this.documentTypeModel.findOne({
          where: { id: updateDto.typeId, tenantId, isActive: true },
        });
        if (!type) {
          throw new BadRequestException('Invalid document type selected');
        }
      }

      await document.update(updateDto);

      console.log('✅ Document updated successfully:', document.id);
      return await this.findOne(document.id, tenantId);
    } catch (error) {
      console.error('❌ ERROR - Failed to update document:', error);
      throw error;
    }
  }

  /**
   * Delete a document (soft delete)
   */
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    try {
      console.log('🔍 DEBUG - Deleting document:', id);

      const document = await this.documentModel.findOne({
        where: { id, tenantId },
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      // Check if user can delete this document (owner or admin/hr)
      // For now, allowing all deletions - you can add role-based checks here

      // Soft delete
      await document.update({ isActive: false });

      // Optionally delete the physical file
      // await this.fileUploadService.deleteFile(document.filePath);

      console.log('✅ Document deleted successfully:', document.id);
    } catch (error) {
      console.error('❌ ERROR - Failed to delete document:', error);
      throw error;
    }
  }

  /**
   * Get documents statistics with role-based filtering
   */
  async getStatistics(tenantId: string, userRole: string): Promise<any> {
    try {
      console.log('🔍 DEBUG - Fetching document statistics for tenant:', tenantId, 'with role:', userRole);

      // Build where clause based on role
      const baseWhere: any = { tenantId, isActive: true };
      
      // Apply role-based filtering (same logic as findAll)
      if (userRole !== 'admin' && userRole !== 'hr') {
        let categoryCode: string;
        switch (userRole.toLowerCase()) {
          case 'employee':
            categoryCode = 'EMPLOYEE';
            break;
          case 'finance':
            categoryCode = 'FINANCE';
            break;
          default:
            categoryCode = 'UNKNOWN_ROLE';
            break;
        }

        // Find the category ID for the role
        const category = await this.documentCategoryModel.findOne({
          where: { tenantId, categoryCode, isActive: true },
        });

        if (category) {
          baseWhere.categoryId = category.id;
          console.log(`🔒 Statistics filter applied: ${userRole} -> ${categoryCode} (${category.id})`);
        } else {
          baseWhere.categoryId = 'non-existent-category';
          console.log(`⚠️ Category ${categoryCode} not found for role ${userRole}`);
        }
      } else {
        console.log(`👑 ${userRole.toUpperCase()} role: showing all document statistics`);
      }

      // Create separate where clause for total count (without isActive filter)
      const totalWhere = { ...baseWhere };
      delete totalWhere.isActive; // Remove isActive to count all documents

      const [total, active, byCategory, byType] = await Promise.all([
        this.documentModel.count({ where: totalWhere }), // Total includes inactive
        this.documentModel.count({ where: baseWhere }), // Active only
        this.documentModel.findAll({
          where: baseWhere,
          include: [{ model: DocumentCategory, as: 'category' }],
          attributes: ['categoryId'],
          group: ['categoryId', 'category.id', 'category.categoryName'],
          raw: false,
        }),
        this.documentModel.findAll({
          where: baseWhere,
          include: [{ model: DocumentType, as: 'type' }],
          attributes: ['typeId'],
          group: ['typeId', 'type.id', 'type.typeName'],
          raw: false,
        }),
      ]);

      const stats = {
        total: active, // For role-based users, total = active (they can't see inactive anyway)
        active,
        inactive: 0, // Role-based users don't see inactive documents
        byCategory: byCategory.length,
        byType: byType.length,
      };

      // For admin and HR, show real total and inactive counts
      if (userRole === 'admin' || userRole === 'hr') {
        const realTotal = await this.documentModel.count({ where: { tenantId } });
        const inactive = await this.documentModel.count({ where: { tenantId, isActive: false } });
        stats.total = realTotal;
        stats.inactive = inactive;
      }

      console.log('✅ Document statistics fetched:', stats);
      return stats;
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch document statistics:', error);
      throw error;
    }
  }
}
