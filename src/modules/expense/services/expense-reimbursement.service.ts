import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ExpenseReimbursement } from '../models/expense-reimbursement.model';
import { ExpenseCategory } from '../models/expense-category.model';
import { Employee } from '../../employees/employees.model';
import { User } from '../../users/users.model';
import { CreateExpenseReimbursementDto } from '../dto/create-expense-reimbursement.dto';
import { UpdateReimbursementStatusDto } from '../dto/update-reimbursement-status.dto';
import { CalculateAmountDto } from '../dto/calculate-amount.dto';
import { FileUploadService, UploadedFileInfo } from '../../../common/upload/file-upload.service';

@Injectable()
export class ExpenseReimbursementService {
  constructor(
    @InjectModel(ExpenseReimbursement)
    private reimbursementModel: typeof ExpenseReimbursement,
    @InjectModel(ExpenseCategory)
    private categoryModel: typeof ExpenseCategory,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(User)
    private userModel: typeof User,
    private fileUploadService: FileUploadService,
  ) {}

  async create(
    createDto: CreateExpenseReimbursementDto,
    employeeId: string,
    tenantId: string,
    receiptFiles?: Express.Multer.File[]
  ): Promise<ExpenseReimbursement> {
    try {
      // Validate category exists
      const category = await this.categoryModel.findOne({
        where: { id: createDto.categoryId, tenantId, isActive: true }
      });

      if (!category) {
        throw new BadRequestException('Invalid or inactive expense category');
      }

      // Fetch employee name from users table (employeeId = user.id)
      let employeeName = 'Unknown Employee';
      try {
        const user = await this.userModel.findOne({
          where: { id: employeeId },
          attributes: ['firstName', 'lastName']
        });
        if (user) {
          employeeName = `${user.firstName} ${user.lastName}`;
        }
        console.log('👤 Found employee name from users table:', employeeName);
      } catch (error) {
        console.warn('⚠️ Could not fetch employee name from users table, using default');
      }

      // Debug the entire DTO
      console.log('🔍 Full createDto object:', JSON.stringify(createDto, null, 2));
      console.log('🔍 createDto.approvedAmount:', createDto.approvedAmount, typeof createDto.approvedAmount);
      
      // Use approved amount sent from frontend (already calculated)
      const approvedAmount = createDto.approvedAmount;
      console.log('💰 Using frontend-calculated approved amount:', approvedAmount, typeof approvedAmount);

      // Process uploaded receipt files
      let receiptUrl = '';
      if (receiptFiles && receiptFiles.length > 0) {
        const processedFiles = await this.fileUploadService.processUploadedFiles(receiptFiles);
        // Store first file URL (can be extended for multiple files)
        receiptUrl = processedFiles[0]?.url || '';
      }

      console.log('🚨 CRITICAL: About to create reimbursement with approvedAmount:', approvedAmount, typeof approvedAmount);
      
      const reimbursement = await this.reimbursementModel.create({
        tenantId,
        employeeId,
        employeeName,
        categoryId: createDto.categoryId,
        amount: createDto.amount,
        approvedAmount,
        expenseDate: new Date(createDto.expenseDate),
        description: createDto.description,
        vendor: createDto.vendor,
        businessPurpose: createDto.businessPurpose,
        receiptUrl,
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy: employeeId,
      });

      const createdApprovedAmount = reimbursement.dataValues?.approvedAmount || reimbursement.approvedAmount;
      console.log('💾 Created reimbursement approvedAmount:', createdApprovedAmount, typeof createdApprovedAmount);
      
      const result = await this.findOne(reimbursement.id, tenantId);
      const retrievedApprovedAmount = result.dataValues?.approvedAmount || result.approvedAmount;
      console.log('🔄 Retrieved reimbursement approvedAmount:', retrievedApprovedAmount, typeof retrievedApprovedAmount);
      
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create expense reimbursement');
    }
  }

  async findByEmployee(employeeId: string, tenantId: string): Promise<ExpenseReimbursement[]> {
    try {
      return await this.reimbursementModel.findAll({
        where: { employeeId, tenantId },
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['categoryName', 'categoryCode', 'autoApprovalPercent']
          },
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId', 'email'],
            required: false // Left join - don't fail if employee not found
          }
        ],
        order: [['createdAt', 'DESC']],
      });
    } catch (error) {
      throw new BadRequestException('Failed to fetch employee reimbursements');
    }
  }

  async findAll(tenantId: string, filters?: any): Promise<{ data: ExpenseReimbursement[], total: number }> {
    try {
      console.log('🔍 DEBUG - Finding all reimbursements for tenantId:', tenantId);
      const whereClause: any = { tenantId };

      // Apply filters
      if (filters?.status) {
        whereClause.status = filters.status;
      }
      if (filters?.employeeId) {
        whereClause.employeeId = filters.employeeId;
      }
      if (filters?.categoryId) {
        whereClause.categoryId = filters.categoryId;
      }
      if (filters?.dateFrom && filters?.dateTo) {
        whereClause.expenseDate = {
          [Op.between]: [new Date(filters.dateFrom), new Date(filters.dateTo)]
        };
      }
      if (filters?.amountMin && filters?.amountMax) {
        whereClause.amount = {
          [Op.between]: [filters.amountMin, filters.amountMax]
        };
      }

      const { count, rows } = await this.reimbursementModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['categoryName', 'categoryCode', 'autoApprovalPercent']
          },
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId', 'email'],
            required: false // Left join - don't fail if employee not found
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: filters?.limit || 50,
        offset: filters?.offset || 0,
      });

      console.log('🔍 DEBUG - Found reimbursements:', rows.length);
      console.log('🔍 DEBUG - Sample employeeName from stored data:', rows[0]?.employeeName);
      
      return { data: rows, total: count };
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch reimbursements:', error);
      throw new BadRequestException('Failed to fetch reimbursements');
    }
  }

  async findPending(tenantId: string): Promise<ExpenseReimbursement[]> {
    try {
      return await this.reimbursementModel.findAll({
        where: { tenantId, status: 'submitted' },
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['categoryName', 'categoryCode', 'autoApprovalPercent']
          },
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId', 'email'],
            required: false // Left join - don't fail if employee not found
          }
        ],
        order: [['createdAt', 'ASC']], // Oldest first for processing
      });
    } catch (error) {
      throw new BadRequestException('Failed to fetch pending reimbursements');
    }
  }

  async findApproved(tenantId: string): Promise<ExpenseReimbursement[]> {
    try {
      const approvedReimbursements = await this.reimbursementModel.findAll({
        where: { tenantId, status: 'approved' },
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['categoryName', 'categoryCode', 'autoApprovalPercent']
          }
        ],
        order: [['approvedAt', 'DESC']], // Most recently approved first
      });
      
      console.log(`🔍 DEBUG - Found ${approvedReimbursements.length} approved reimbursements for tenant ${tenantId}`);
      approvedReimbursements.forEach(r => {
        console.log(`🔍 DEBUG - Approved reimbursement: ${r.id} - Status: "${r.status}" - Amount: ${r.amount}`);
      });
      
      return approvedReimbursements;
    } catch (error) {
      throw new BadRequestException('Failed to fetch approved reimbursements');
    }
  }

  async findOne(id: string, tenantId: string): Promise<ExpenseReimbursement> {
    try {
      console.log(`🔍 DEBUG - findOne called with ID: ${id}, tenantId: ${tenantId}`);
      
      const reimbursement = await this.reimbursementModel.findOne({
        where: { id, tenantId },
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['categoryName', 'categoryCode', 'autoApprovalPercent']
          },
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId', 'email'],
            required: false // Left join - don't fail if employee not found
          }
        ],
      });

      console.log(`🔍 DEBUG - Database query result:`, reimbursement ? 'Found' : 'Not found');
      if (reimbursement) {
        console.log(`🔍 DEBUG - Raw DB status: "${reimbursement.status}"`);
        console.log(`🔍 DEBUG - Raw DB dataValues:`, reimbursement.dataValues);
      }

      if (!reimbursement) {
        console.log(`❌ ERROR - Reimbursement not found in database`);
        throw new NotFoundException('Expense reimbursement not found');
      }

      return reimbursement;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch expense reimbursement');
    }
  }

  async updateStatus(
    id: string,
    updateDto: UpdateReimbursementStatusDto,
    approverId: string,
    tenantId: string
  ): Promise<ExpenseReimbursement> {
    try {
      const reimbursement = await this.findOne(id, tenantId);

      // Validate status transition
      if (reimbursement.status === 'cancelled') {
        throw new BadRequestException('Cannot update status of cancelled reimbursement');
      }

      if (reimbursement.status === 'paid') {
        throw new BadRequestException('Cannot update status of already paid reimbursement');
      }

      // For paid status, ensure it's currently approved
      if (updateDto.status === 'paid' && reimbursement.status !== 'approved') {
        throw new BadRequestException('Can only mark approved reimbursements as paid');
      }

      // Update the reimbursement
      const updateData: any = {
        status: updateDto.status,
        approverComments: updateDto.approverComments,
      };

      if (updateDto.status === 'approved') {
        updateData.approvedAt = new Date();
        updateData.approvedBy = approverId;
      } else if (updateDto.status === 'paid') {
        updateData.paidAt = new Date();
        updateData.paidBy = approverId;
      }

      await reimbursement.update(updateData);

      return await this.findOne(id, tenantId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update reimbursement status');
    }
  }

  async markAsPaid(
    id: string,
    financeUserId: string,
    tenantId: string,
    comments?: string
  ): Promise<ExpenseReimbursement> {
    try {
      console.log(`🔍 DEBUG - markAsPaid called with:`);
      console.log(`🔍 DEBUG - ID: ${id}`);
      console.log(`🔍 DEBUG - financeUserId: ${financeUserId}`);
      console.log(`🔍 DEBUG - tenantId: ${tenantId}`);
      console.log(`🔍 DEBUG - comments: ${comments}`);

      const reimbursement = await this.findOne(id, tenantId);
      
      console.log(`🔍 DEBUG - Found reimbursement:`);
      console.log(`🔍 DEBUG - ID: ${reimbursement.id}`);
      console.log(`🔍 DEBUG - Status: "${reimbursement.status}"`);
      console.log(`🔍 DEBUG - Status type: ${typeof reimbursement.status}`);
      console.log(`🔍 DEBUG - Status length: ${reimbursement.status?.length}`);
      console.log(`🔍 DEBUG - Amount: ${reimbursement.amount}`);
      console.log(`🔍 DEBUG - ApprovedBy: ${reimbursement.approvedBy}`);
      console.log(`🔍 DEBUG - ApprovedAt: ${reimbursement.approvedAt}`);
      console.log(`🔍 DEBUG - Raw reimbursement object:`, JSON.stringify(reimbursement, null, 2));

      // Check for exact match
      const isApproved = reimbursement.status === 'approved';
      console.log(`🔍 DEBUG - Status comparison result: ${isApproved}`);
      console.log(`🔍 DEBUG - Status === 'approved': ${reimbursement.status === 'approved'}`);
      console.log(`🔍 DEBUG - Status.trim() === 'approved': ${reimbursement.status?.trim() === 'approved'}`);
      
      if (reimbursement.status !== 'approved') {
        console.log(`❌ ERROR - Status validation failed!`);
        console.log(`❌ ERROR - Expected: "approved" (length: 8)`);
        console.log(`❌ ERROR - Actual: "${reimbursement.status}" (length: ${reimbursement.status?.length})`);
        throw new BadRequestException(`Can only mark approved reimbursements as paid. Current status: "${reimbursement.status}"`);
      }

      // Update to paid status
      await reimbursement.update({
        status: 'paid',
        paidAt: new Date(),
        paidBy: financeUserId,
        approverComments: comments || reimbursement.approverComments,
      });

      console.log(`💰 Reimbursement ${id} marked as paid by finance user ${financeUserId}`);
      
      return await this.findOne(id, tenantId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to mark reimbursement as paid');
    }
  }

  async cancel(id: string, employeeId: string, tenantId: string): Promise<void> {
    try {
      const reimbursement = await this.findOne(id, tenantId);
    

      // Only employee who submitted can cancel
      const reimbursementEmployeeId = reimbursement.dataValues?.employeeId || reimbursement.employeeId;
    
      if (reimbursementEmployeeId !== employeeId) {
        throw new ForbiddenException('You can only cancel your own reimbursements');
      }

      // Can only cancel submitted requests
      const reimbursementStatus = reimbursement.dataValues?.status || reimbursement.status;
      if (reimbursementStatus !== 'submitted') {
        throw new BadRequestException('Can only cancel submitted reimbursements');
      }

      // Delete associated receipt file if exists
      const receiptUrl = reimbursement.dataValues?.receiptUrl || reimbursement.receiptUrl;
      if (receiptUrl) {
        // Extract file path from URL and delete
        const filePath = receiptUrl.replace(/.*\/api\/files/, process.cwd());
        await this.fileUploadService.deleteFile(filePath);
      }

      await reimbursement.destroy();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to cancel reimbursement');
    }
  }

  async calculateApprovedAmount(calculateDto: CalculateAmountDto, tenantId: string): Promise<{ requestedAmount: number, approvedAmount: number, approvalPercentage: number }> {
    try {
      const category = await this.categoryModel.findOne({
        where: { id: calculateDto.categoryId, tenantId, isActive: true }
      });

      if (!category) {
        throw new BadRequestException('Invalid or inactive expense category');
      }

      const approvalPercent = parseFloat(category.autoApprovalPercent.toString());
      const approvedAmount = Number(((calculateDto.amount * approvalPercent) / 100).toFixed(2));

      return {
        requestedAmount: calculateDto.amount,
        approvedAmount: approvedAmount,
        approvalPercentage: parseFloat(category.autoApprovalPercent.toString())
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to calculate approved amount');
    }
  }

  async getStatistics(tenantId: string): Promise<any> {
    try {
      const totalPending = await this.reimbursementModel.count({
        where: { tenantId, status: 'submitted' }
      });

      const totalApproved = await this.reimbursementModel.count({
        where: { tenantId, status: 'approved' }
      });

      const totalPaid = await this.reimbursementModel.count({
        where: { tenantId, status: 'paid' }
      });

      const totalRejected = await this.reimbursementModel.count({
        where: { tenantId, status: 'rejected' }
      });

      const pendingAmount = await this.reimbursementModel.sum('approvedAmount', {
        where: { tenantId, status: 'submitted' }
      }) || 0;

      const approvedAmount = await this.reimbursementModel.sum('approvedAmount', {
        where: { tenantId, status: 'approved' }
      }) || 0;

      const paidAmount = await this.reimbursementModel.sum('approvedAmount', {
        where: { tenantId, status: 'paid' }
      }) || 0;

      return {
        counts: {
          pending: totalPending,
          approved: totalApproved,
          paid: totalPaid,
          rejected: totalRejected,
          total: totalPending + totalApproved + totalPaid + totalRejected
        },
        amounts: {
          pending: Number(pendingAmount.toFixed(2)),
          approved: Number(approvedAmount.toFixed(2)),
          paid: Number(paidAmount.toFixed(2)),
          total: Number((pendingAmount + approvedAmount + paidAmount).toFixed(2))
        }
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch statistics');
    }
  }
}
