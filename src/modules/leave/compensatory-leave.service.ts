import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CompensatoryLeave, CompensatoryLeaveStatus } from './compensatory-leave.model';
import { User } from '../users/users.model';
import { Employee } from '../employees/employees.model';
import { 
  CreateCompensatoryLeaveDto, 
  UpdateCompensatoryLeaveDto, 
  CompensatoryLeaveQueryDto,
  CompensatoryCreditsSummaryDto 
} from './dto/compensatory-leave.dto';

@Injectable()
export class CompensatoryLeaveService {
  constructor(
    @InjectModel(CompensatoryLeave)
    private compensatoryLeaveModel: typeof CompensatoryLeave,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
  ) {}

  async create(createDto: CreateCompensatoryLeaveDto, assignedByUserId: string, tenantId: string): Promise<CompensatoryLeave> {
    console.log('🔍 CompensatoryLeave create - DTO:', createDto);
    console.log('🔍 CompensatoryLeave create - assignedByUserId:', assignedByUserId);
    console.log('🔍 CompensatoryLeave create - tenantId:', tenantId);
    
    // Find employee by ID within the same tenant
    const whereClause: any = { id: createDto.employeeId };
    
    // Only add tenantId filter if the column exists (after DB sync)
    try {
      whereClause.tenantId = tenantId;
      console.log('✅ Added tenantId filter to employee lookup');
    } catch (error) {
      console.log('⚠️ TenantId column may not exist yet, skipping tenant filter');
    }
    
    console.log('🔍 Employee lookup where clause:', whereClause);
    
    const employee = await this.employeeModel.findOne({
      where: whereClause,
      include: [{ model: User, as: 'user' }]
    });
    
    console.log('🔍 Employee found:', employee ? `${employee.name} (${employee.employeeId})` : 'NOT FOUND');

    if (!employee) {
      throw new NotFoundException('Employee not found in your organization');
    }

    // Find user by email within the same tenant
    const userWhereClause: any = { email: employee.email };
    
    // Only add tenantId filter if the column exists (after DB sync)
    try {
      userWhereClause.tenantId = tenantId;
      console.log('✅ Added tenantId filter to user lookup');
    } catch (error) {
      console.log('⚠️ TenantId column may not exist yet for users, skipping tenant filter');
    }
    
    console.log('🔍 User lookup where clause:', userWhereClause);
    
    const user = await this.userModel.findOne({
      where: userWhereClause
    });

    console.log('🔍 User found:', user ? `${user.firstName} ${user.lastName} (${user.email})` : 'NOT FOUND');

    if (!user) {
      throw new BadRequestException('Employee is not associated with a user account');
    }

    // Verify expiry date is in the future
    const expiryDate = new Date(createDto.expiryDate);
    const today = new Date();
    console.log('🔍 Date validation - Today:', today.toISOString().split('T')[0], 'Expiry:', createDto.expiryDate);
    
    if (expiryDate <= today) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    // Prepare the compensatory leave data
    const compensatoryData: any = {
      userId: user.id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      credits: createDto.credits,
      reason: createDto.reason,
      assignedDate: new Date().toISOString().split('T')[0],
      expiryDate: createDto.expiryDate,
      status: CompensatoryLeaveStatus.ACTIVE,
      assignedBy: assignedByUserId,
      notes: createDto.notes || null,
    };

    // Add tenantId to compensatory data
    try {
      compensatoryData.tenantId = tenantId;
      console.log('✅ Added tenantId to compensatory data');
    } catch (error) {
      console.log('⚠️ TenantId column may not exist yet in compensatory_leaves table:', error.message);
      // Continue without tenantId for now
    }

    console.log('🔍 Creating compensatory leave with data:', compensatoryData);

    const compensatoryLeave = await this.compensatoryLeaveModel.create(compensatoryData);
    
    console.log('✅ Compensatory leave created with ID:', compensatoryLeave.id);

    return this.findOne(compensatoryLeave.id, tenantId);
  }

  async findAll(query: CompensatoryLeaveQueryDto = {}, tenantId: string): Promise<CompensatoryLeave[]> {
    const whereClause: any = {
      tenantId: tenantId  // Filter by tenant
    };

    if (query.employeeId) {
      whereClause.employeeId = query.employeeId;
    }

    if (query.userId) {
      whereClause.userId = query.userId;
    }

    if (query.status) {
      whereClause.status = query.status;
    }

    if (query.department) {
      whereClause.department = { [Op.iLike]: `%${query.department}%` };
    }

    if (query.startDate && query.endDate) {
      whereClause.assignedDate = {
        [Op.between]: [query.startDate, query.endDate]
      };
    } else if (query.startDate) {
      whereClause.assignedDate = { [Op.gte]: query.startDate };
    } else if (query.endDate) {
      whereClause.assignedDate = { [Op.lte]: query.endDate };
    }

    return this.compensatoryLeaveModel.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'assignedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        }
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async findOne(id: number, tenantId?: string): Promise<CompensatoryLeave> {
    const whereClause: any = { id };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const compensatoryLeave = await this.compensatoryLeaveModel.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'assignedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        }
      ],
    });

    if (!compensatoryLeave) {
      throw new NotFoundException('Compensatory leave record not found');
    }

    return compensatoryLeave;
  }

  async findByUserId(userId: string, status?: CompensatoryLeaveStatus, tenantId?: string): Promise<CompensatoryLeave[]> {
    const whereClause: any = { userId };
    
    if (status) {
      whereClause.status = status;
    }

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    return this.compensatoryLeaveModel.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'assignedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        }
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async update(id: number, updateDto: UpdateCompensatoryLeaveDto, updatedByUserId: number): Promise<CompensatoryLeave> {
    const compensatoryLeave = await this.findOne(id);

    // Validate expiry date if provided
    if (updateDto.expiryDate) {
      const expiryDate = new Date(updateDto.expiryDate);
      const today = new Date();
      if (expiryDate <= today) {
        throw new BadRequestException('Expiry date must be in the future');
      }
    }

    await compensatoryLeave.update(updateDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const compensatoryLeave = await this.findOne(id);
    await compensatoryLeave.destroy();
  }

  async getSummary(tenantId: string): Promise<CompensatoryCreditsSummaryDto> {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const [
      totalActiveCredits,
      totalEmployees,
      expiringSoon,
      totalExpired,
      totalUsed
    ] = await Promise.all([
      // Total active credits for this tenant
      this.compensatoryLeaveModel.sum('credits', {
        where: { 
          status: CompensatoryLeaveStatus.ACTIVE,
          tenantId: tenantId 
        }
      }),

      // Total employees with active credits for this tenant
      this.compensatoryLeaveModel.count({
        where: { 
          status: CompensatoryLeaveStatus.ACTIVE,
          tenantId: tenantId 
        },
        distinct: true,
        col: 'userId'
      }),

      // Credits expiring soon (within 30 days) for this tenant
      this.compensatoryLeaveModel.count({
        where: {
          status: CompensatoryLeaveStatus.ACTIVE,
          tenantId: tenantId,
          expiryDate: {
            [Op.between]: [today.toISOString().split('T')[0], thirtyDaysFromNow.toISOString().split('T')[0]]
          }
        }
      }),

      // Total expired credits for this tenant
      this.compensatoryLeaveModel.count({
        where: { 
          status: CompensatoryLeaveStatus.EXPIRED,
          tenantId: tenantId 
        }
      }),

      // Total used credits for this tenant
      this.compensatoryLeaveModel.count({
        where: { 
          status: CompensatoryLeaveStatus.USED,
          tenantId: tenantId 
        }
      })
    ]);

    return {
      totalActiveCredits: totalActiveCredits || 0,
      totalEmployees: totalEmployees || 0,
      expiringSoon: expiringSoon || 0,
      totalExpired: totalExpired || 0,
      totalUsed: totalUsed || 0,
    };
  }

  async getActiveCreditsForUser(userId: number, tenantId?: string): Promise<number> {
    const whereClause: any = {
      userId,
      status: CompensatoryLeaveStatus.ACTIVE,
      expiryDate: { [Op.gte]: new Date().toISOString().split('T')[0] }
    };

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const result = await this.compensatoryLeaveModel.sum('credits', {
      where: whereClause
    });

    return result || 0;
  }

  async getActiveCreditsForUserByMonth(userId: number, tenantId?: string): Promise<Record<string, number>> {
    const whereClause: any = {
      userId,
      status: CompensatoryLeaveStatus.ACTIVE,
    };

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    // Add expiry date filter to where clause
    whereClause.expiryDate = { [Op.gte]: new Date().toISOString().split('T')[0] };

    const activeCredits = await this.compensatoryLeaveModel.findAll({
      where: whereClause,
      attributes: ['credits', 'assignedDate']
    });

    const creditsByMonth: Record<string, number> = {};
    
    activeCredits.forEach(credit => {
      const assignedDate = new Date(credit.assignedDate);
      const yearMonth = `${assignedDate.getFullYear()}-${String(assignedDate.getMonth() + 1).padStart(2, '0')}`;
      creditsByMonth[yearMonth] = (creditsByMonth[yearMonth] || 0) + Number(credit.credits);
    });

    return creditsByMonth;
  }

  async expireOldCredits(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    const [updatedCount] = await this.compensatoryLeaveModel.update(
      { status: CompensatoryLeaveStatus.EXPIRED },
      {
        where: {
          status: CompensatoryLeaveStatus.ACTIVE,
          expiryDate: { [Op.lt]: today }
        }
      }
    );

    return updatedCount;
  }

  async useCredits(userId: number, creditsToUse: number): Promise<void> {
    const activeCredits = await this.compensatoryLeaveModel.findAll({
      where: {
        userId,
        status: CompensatoryLeaveStatus.ACTIVE,
        expiryDate: { [Op.gte]: new Date().toISOString().split('T')[0] }
      },
      order: [['expiryDate', 'ASC']] // Use credits that expire first
    });

    let remainingToUse = creditsToUse;
    
    for (const credit of activeCredits) {
      if (remainingToUse <= 0) break;

      const availableCredits = Number(credit.credits);
      
      if (availableCredits <= remainingToUse) {
        // Use all credits from this record
        await credit.update({ status: CompensatoryLeaveStatus.USED });
        remainingToUse -= availableCredits;
      } else {
        // Partially use credits - split the record
        const remainingCredits = availableCredits - remainingToUse;
        
        // Update current record to used amount
        await credit.update({ 
          credits: remainingToUse,
          status: CompensatoryLeaveStatus.USED 
        });
        
        // Create new record for remaining credits
        await this.compensatoryLeaveModel.create({
          userId: credit.userId,
          employeeId: credit.employeeId,
          employeeName: credit.employeeName,
          department: credit.department,
          credits: remainingCredits,
          reason: credit.reason,
          assignedDate: credit.assignedDate,
          expiryDate: credit.expiryDate,
          status: CompensatoryLeaveStatus.ACTIVE,
          assignedBy: credit.assignedBy,
          notes: credit.notes,
        } as any);
        
        remainingToUse = 0;
      }
    }

    if (remainingToUse > 0) {
      throw new BadRequestException(`Insufficient compensatory credits. Missing ${remainingToUse} credits.`);
    }
  }
}
