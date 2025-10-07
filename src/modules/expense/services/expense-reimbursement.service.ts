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
      // Finance sees both approved AND paid reimbursements
      const financeReimbursements = await this.reimbursementModel.findAll({
        where: { 
          tenantId, 
          status: ['approved', 'paid'] // Include both approved and paid
        },
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['categoryName', 'categoryCode', 'autoApprovalPercent']
          }
        ],
        order: [
          ['status', 'ASC'], // Show approved first, then paid
          ['approvedAt', 'DESC'] // Most recently approved first within each status
        ],
      });
      
      console.log(`🔍 DEBUG - Found ${financeReimbursements.length} finance reimbursements (approved + paid) for tenant ${tenantId}`);
      financeReimbursements.forEach(r => {
        const actualStatus = r.dataValues?.status || r.status;
        const actualAmount = r.dataValues?.amount || r.amount;
        console.log(`🔍 DEBUG - Finance reimbursement: ${r.id} - Status: "${actualStatus}" - Amount: ${actualAmount}`);
      });
      
      return financeReimbursements;
    } catch (error) {
      throw new BadRequestException('Failed to fetch finance reimbursements');
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
      
      // Access status from dataValues (Sequelize model property access issue)
      const actualStatus = reimbursement.dataValues?.status || reimbursement.status;
      
      console.log(`🔍 DEBUG - Found reimbursement:`);
      console.log(`🔍 DEBUG - ID: ${reimbursement.id}`);
      console.log(`🔍 DEBUG - Status (direct): "${reimbursement.status}"`);
      console.log(`🔍 DEBUG - Status (dataValues): "${reimbursement.dataValues?.status}"`);
      console.log(`🔍 DEBUG - Actual Status: "${actualStatus}"`);
      console.log(`🔍 DEBUG - Status type: ${typeof actualStatus}`);
      console.log(`🔍 DEBUG - Status length: ${actualStatus?.length}`);

      // Check for exact match using the correct status value
      const isApproved = actualStatus === 'approved';
      console.log(`🔍 DEBUG - Status comparison result: ${isApproved}`);
      console.log(`🔍 DEBUG - actualStatus === 'approved': ${actualStatus === 'approved'}`);
      
      if (actualStatus !== 'approved') {
        console.log(`❌ ERROR - Status validation failed!`);
        console.log(`❌ ERROR - Expected: "approved" (length: 8)`);
        console.log(`❌ ERROR - Actual: "${actualStatus}" (length: ${actualStatus?.length})`);
        throw new BadRequestException(`Can only mark approved reimbursements as paid. Current status: "${actualStatus}"`);
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

      console.log(`🔍 DEBUG - Statistics for tenant ${tenantId}:`, {
        pendingAmount,
        approvedAmount,
        paidAmount,
        totalWillShow: paidAmount // Only paid amount shown in total
      });

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
          total: Number(paidAmount.toFixed(2)) // Only show paid amount in total
        }
      };
    } catch (error) {
      console.error('❌ ERROR - Failed to fetch statistics:', error);
      throw new BadRequestException('Failed to fetch statistics');
    }
  }

  async getMonthlyTrends(tenantId: string, months: number = 6): Promise<any> {
    try {
      console.log(`🔍 DEBUG - Getting monthly trends for tenant ${tenantId}, last ${months} months`);
      
      // Calculate date range for last N months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - (months - 1));
      startDate.setDate(1); // Start from first day of the month
      
      console.log(`🔍 DEBUG - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get all reimbursements in the date range
      const reimbursements = await this.reimbursementModel.findAll({
        where: {
          tenantId,
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate
          }
        },
        attributes: [
          'amount',
          'approvedAmount', 
          'status',
          'createdAt'
        ],
        raw: true
      });

      console.log(`🔍 DEBUG - Found ${reimbursements.length} reimbursements in date range`);

      // Group data by month
      const monthlyData: { [key: string]: any } = {};
      
      // Initialize all months with zero values
      for (let i = 0; i < months; i++) {
        const monthDate = new Date();
        monthDate.setMonth(monthDate.getMonth() - i);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
        
        monthlyData[monthKey] = {
          month: monthKey,
          monthName: monthName,
          totalAmount: 0,
          approvedAmount: 0,
          paidAmount: 0, // Add paid amount tracking
          counts: {
            approved: 0,
            pending: 0,
            rejected: 0,
            paid: 0,
            total: 0
          }
        };
      }

      // Process reimbursements and aggregate by month
      reimbursements.forEach(reimbursement => {
        const createdDate = new Date(reimbursement.createdAt);
        const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (monthlyData[monthKey]) {
          const amount = parseFloat(String(reimbursement.amount)) || 0;
          const approvedAmount = parseFloat(String(reimbursement.approvedAmount)) || 0;
          const status = reimbursement.status;

          monthlyData[monthKey].totalAmount += amount;
          monthlyData[monthKey].approvedAmount += approvedAmount;
          monthlyData[monthKey].counts.total += 1;

          // Count by status and add paid amounts
          if (status === 'approved') {
            monthlyData[monthKey].counts.approved += 1;
          } else if (status === 'submitted') {
            monthlyData[monthKey].counts.pending += 1;
          } else if (status === 'rejected') {
            monthlyData[monthKey].counts.rejected += 1;
          } else if (status === 'paid') {
            monthlyData[monthKey].counts.paid += 1;
            monthlyData[monthKey].paidAmount += approvedAmount; // Add to paid amount
          }
        }
      });

      // Convert to array and sort by month (oldest first)
      const result = Object.values(monthlyData)
        .sort((a: any, b: any) => a.month.localeCompare(b.month))
        .map((item: any) => ({
          ...item,
          totalAmount: Number(item.totalAmount.toFixed(2)),
          approvedAmount: Number(item.approvedAmount.toFixed(2)),
          paidAmount: Number(item.paidAmount.toFixed(2)) // Include paid amount in response
        }));

      console.log(`🔍 DEBUG - Monthly trends result:`, result);
      return result;

    } catch (error) {
      console.error('❌ ERROR - Failed to fetch monthly trends:', error);
      throw new BadRequestException('Failed to fetch monthly trends');
    }
  }

  async getCategoryBreakdown(tenantId: string): Promise<any> {
    try {
      console.log(`🔍 DEBUG - Getting category breakdown for tenant ${tenantId}`);

      // First, get all active categories configured by admin
      const activeCategories = await this.categoryModel.findAll({
        where: { 
          tenantId,
          isActive: true 
        },
        attributes: ['id', 'categoryName', 'categoryCode', 'description'],
        raw: false
      });

      console.log(`🔍 DEBUG - Found ${activeCategories.length} active categories`);
      activeCategories.forEach((category, index) => {
        console.log(`🔍 DEBUG - Active category ${index + 1}:`, {
          id: category.id,
          categoryName: category.categoryName,
          categoryCode: category.categoryCode,
          description: category.description,
          dataValues: category.dataValues,
          rawCategory: JSON.stringify(category, null, 2)
        });
      });

      if (activeCategories.length === 0) {
        console.log(`⚠️ WARNING - No active categories found for tenant ${tenantId}`);
        return [];
      }

      // Get category IDs for filtering reimbursements
      const activeCategoryIds = activeCategories.map(c => c.id);

      // Get reimbursements for these active categories only - PAID ONLY
      const reimbursements = await this.reimbursementModel.findAll({
        where: { 
          tenantId,
          status: 'paid', // Only include PAID reimbursements
          categoryId: activeCategoryIds // Only reimbursements with active categories
        },
        attributes: ['id', 'categoryId', 'amount', 'approvedAmount'],
        raw: true // Use raw for simpler data structure
      });

      console.log(`🔍 DEBUG - Found ${reimbursements.length} reimbursements with active categories`);

      // Create a map of categories for easy lookup
      const categoryMap: { [key: string]: any } = {};
      
      // Initialize all active categories with zero values
      activeCategories.forEach((category, index) => {
        const colors = [
          '#3B82F6', // Blue
          '#10B981', // Green  
          '#F59E0B', // Yellow
          '#EF4444', // Red
          '#8B5CF6', // Purple
          '#06B6D4', // Cyan
          '#F97316', // Orange
          '#84CC16', // Lime
          '#EC4899', // Pink
          '#6B7280'  // Gray
        ];

        // Handle Sequelize model data properly
        const categoryData = category.dataValues || category;
        const categoryName = categoryData.categoryName || category.categoryName;
        const categoryCode = categoryData.categoryCode || category.categoryCode;
        const description = categoryData.description || category.description;
        const categoryId = categoryData.id || category.id;

        console.log(`🔍 DEBUG - Processing category ${index + 1}:`, {
          categoryId,
          categoryName,
          categoryCode,
          description
        });

        categoryMap[categoryId] = {
          categoryName: categoryName,
          categoryCode: categoryCode,
          description: description,
          totalAmount: 0,
          approvedAmount: 0,
          paidAmount: 0, // Add paid amount tracking
          count: 0,
          color: colors[index % colors.length]
        };
      });

      // Process reimbursements and add to category totals
      reimbursements.forEach((reimbursement: any) => {
        const categoryId = reimbursement.categoryId;
        const amount = parseFloat(String(reimbursement.amount)) || 0;
        const approvedAmount = parseFloat(String(reimbursement.approvedAmount)) || 0;

        console.log(`🔍 DEBUG - Processing reimbursement ${reimbursement.id}:`, {
          categoryId,
          amount,
          approvedAmount
        });

        if (categoryMap[categoryId]) {
          categoryMap[categoryId].totalAmount += amount;
          categoryMap[categoryId].approvedAmount += approvedAmount;
          categoryMap[categoryId].paidAmount += approvedAmount; // Since all are paid, paidAmount = approvedAmount
          categoryMap[categoryId].count += 1;
        } else {
          console.log(`⚠️ WARNING - Reimbursement ${reimbursement.id} has categoryId ${categoryId} not in active categories`);
        }
      });

      // Convert to array (colors already assigned during initialization)
      const result = Object.values(categoryMap).map((category: any) => ({
        ...category,
        totalAmount: Number(category.totalAmount.toFixed(2)),
        approvedAmount: Number(category.approvedAmount.toFixed(2)),
        paidAmount: Number(category.paidAmount.toFixed(2)) // Include paid amount in response
      }));

      console.log(`🔍 DEBUG - Category breakdown result:`, JSON.stringify(result, null, 2));
      console.log(`🔍 DEBUG - Found ${result.length} categories with data`);
      
      // Debug each category
      result.forEach((category, index) => {
        console.log(`🔍 DEBUG - Category ${index + 1}:`, {
          categoryName: category.categoryName,
          categoryCode: category.categoryCode,
          totalAmount: category.totalAmount,
          approvedAmount: category.approvedAmount,
          paidAmount: category.paidAmount, // Include paid amount in debug
          count: category.count,
          color: category.color
        });
      });

      // If no categories found, return empty array instead of error
      if (result.length === 0) {
        console.log(`⚠️ WARNING - No categories found with reimbursement data`);
        return [];
      }

      return result;

    } catch (error) {
      console.error('❌ ERROR - Failed to fetch category breakdown:', error);
      throw new BadRequestException('Failed to fetch category breakdown');
    }
  }
}
