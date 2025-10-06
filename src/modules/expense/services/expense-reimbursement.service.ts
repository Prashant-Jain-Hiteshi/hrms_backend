import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ExpenseReimbursement } from '../models/expense-reimbursement.model';
import { ExpenseCategory } from '../models/expense-category.model';
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
    private fileUploadService: FileUploadService,
  ) {}

  async create(
    createDto: CreateExpenseReimbursementDto,
    employeeId: string,
    tenantId: string,
    receiptFiles?: Express.Multer.File[]
  ): Promise<ExpenseReimbursement> {
    try {
      // Get category to calculate approved amount
      const category = await this.categoryModel.findOne({
        where: { id: createDto.categoryId, tenantId, isActive: true }
      });

      if (!category) {
        throw new BadRequestException('Invalid or inactive expense category');
      }

      // Calculate approved amount based on category percentage
      const approvedAmount = (createDto.amount * category.autoApprovalPercent) / 100;

      // Process uploaded receipt files
      let receiptUrl = '';
      if (receiptFiles && receiptFiles.length > 0) {
        const processedFiles = await this.fileUploadService.processUploadedFiles(receiptFiles);
        // Store first file URL (can be extended for multiple files)
        receiptUrl = processedFiles[0]?.url || '';
      }

      const reimbursement = await this.reimbursementModel.create({
        tenantId,
        employeeId,
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

      return await this.findOne(reimbursement.id, tenantId);
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
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: filters?.limit || 50,
        offset: filters?.offset || 0,
      });

      return { data: rows, total: count };
    } catch (error) {
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
          }
        ],
        order: [['createdAt', 'ASC']], // Oldest first for processing
      });
    } catch (error) {
      throw new BadRequestException('Failed to fetch pending reimbursements');
    }
  }

  async findOne(id: string, tenantId: string): Promise<ExpenseReimbursement> {
    try {
      const reimbursement = await this.reimbursementModel.findOne({
        where: { id, tenantId },
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['categoryName', 'categoryCode', 'autoApprovalPercent']
          }
        ],
      });

      if (!reimbursement) {
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

      // Validate status transitions
      if (reimbursement.status === 'paid') {
        throw new BadRequestException('Cannot modify paid reimbursement');
      }

      if (updateDto.status === 'paid' && reimbursement.status !== 'approved') {
        throw new BadRequestException('Can only mark approved reimbursements as paid');
      }

      const updateData: any = {
        status: updateDto.status,
        approverComments: updateDto.approverComments,
      };

      if (updateDto.status === 'approved' || updateDto.status === 'rejected') {
        updateData.approvedAt = new Date();
        updateData.approvedBy = approverId;
      }

      if (updateDto.status === 'paid') {
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

  async cancel(id: string, employeeId: string, tenantId: string): Promise<void> {
    try {
      const reimbursement = await this.findOne(id, tenantId);

      // Only employee who submitted can cancel
      if (reimbursement.employeeId !== employeeId) {
        throw new ForbiddenException('You can only cancel your own reimbursements');
      }

      // Can only cancel submitted requests
      if (reimbursement.status !== 'submitted') {
        throw new BadRequestException('Can only cancel submitted reimbursements');
      }

      // Delete associated receipt file if exists
      if (reimbursement.receiptUrl) {
        // Extract file path from URL and delete
        const filePath = reimbursement.receiptUrl.replace(/.*\/api\/files/, process.cwd());
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

      const approvedAmount = (calculateDto.amount * category.autoApprovalPercent) / 100;

      return {
        requestedAmount: calculateDto.amount,
        approvedAmount: Number(approvedAmount.toFixed(2)),
        approvalPercentage: category.autoApprovalPercent
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
