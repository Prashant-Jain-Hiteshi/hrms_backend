import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PerformanceGoal, GoalStatus } from '../models/performance-goal.model';
import { PerformanceGoalAssignment, AssignmentStatus, PerformanceGoalAssignmentCreationAttributes } from '../models/performance-goal-assignment.model';
import { User } from '../../users/users.model';
import { Employee } from '../../employees/employees.model';
import { CreatePerformanceGoalDto } from '../dto/create-performance-goal.dto';
import { UpdatePerformanceGoalDto } from '../dto/update-performance-goal.dto';
import { AssignGoalDto } from '../dto/assign-goal.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { Op } from 'sequelize';

@Injectable()
export class PerformanceGoalService {
  constructor(
    @InjectModel(PerformanceGoal)
    private performanceGoalModel: typeof PerformanceGoal,
    @InjectModel(PerformanceGoalAssignment)
    private performanceGoalAssignmentModel: typeof PerformanceGoalAssignment,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
  ) {}

  /**
   * Create a new performance goal
   */
  async create(
    createDto: CreatePerformanceGoalDto,
    tenantId: string,
    createdBy: string,
  ): Promise<PerformanceGoal> {
    try {
      // Check if goal name already exists for this tenant
      const existingGoal = await this.performanceGoalModel.findOne({
        where: {
          goalName: createDto.goalName,
          tenantId,
          isActive: true,
        },
      });

      if (existingGoal) {
        throw new ConflictException(
          `Goal with name '${createDto.goalName}' already exists`,
        );
      }

      // Verify creator exists and has proper role
      const creator = await this.userModel.findOne({
        where: { id: createdBy, tenantId },
      });

      if (!creator) {
        throw new NotFoundException('Creator user not found');
      }

      if (!['admin', 'hr'].includes(creator.role?.toLowerCase())) {
        throw new ForbiddenException('Only Admin and HR can create performance goals');
      }

      // Create the goal
      const goal = await this.performanceGoalModel.create({
        goalName: createDto.goalName,
        category: createDto.category,
        description: createDto.description,
        tenantId,
        createdBy,
        status: GoalStatus.CREATED,
        isActive: true,
      } as any);

      // Return goal with creator info
      return await this.findOne(goal.id, tenantId);
    } catch (error) {
      if (error instanceof ConflictException || 
          error instanceof NotFoundException || 
          error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Failed to create performance goal:', error);
      throw new BadRequestException('Failed to create performance goal');
    }
  }

  /**
   * Find all goals for a tenant with optional filtering
   */
  async findAll(
    tenantId: string,
    userRole: string,
    includeInactive = false,
  ): Promise<PerformanceGoal[]> {
    try {
      // Only Admin and HR can view all goals
      if (!['admin', 'hr'].includes(userRole?.toLowerCase())) {
        throw new ForbiddenException('Only Admin and HR can view all performance goals');
      }

      const whereClause: any = { tenantId };
      
      if (!includeInactive) {
        whereClause.isActive = true;
      }

      return await this.performanceGoalModel.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Failed to fetch performance goals:', error);
      throw new BadRequestException('Failed to fetch performance goals');
    }
  }

  /**
   * Find a specific goal by ID
   */
  async findOne(id: string, tenantId: string): Promise<PerformanceGoal> {
    try {
      const goal = await this.performanceGoalModel.findOne({
        where: { id, tenantId, isActive: true },
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
          },
        ],
      });

      if (!goal) {
        throw new NotFoundException('Performance goal not found');
      }

      return goal;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Failed to fetch performance goal:', error);
      throw new BadRequestException('Failed to fetch performance goal');
    }
  }

  /**
   * Update a performance goal (only if not assigned yet)
   */
  async update(
    id: string,
    updateDto: UpdatePerformanceGoalDto,
    tenantId: string,
    userId: string,
  ): Promise<PerformanceGoal> {
    try {
      const goal = await this.findOne(id, tenantId);

      // Check if user has permission to update
      const user = await this.userModel.findOne({
        where: { id: userId, tenantId },
      });

      if (!user || !['admin', 'hr'].includes(user.role?.toLowerCase())) {
        throw new ForbiddenException('Only Admin and HR can update performance goals');
      }

      // Check if goal can be updated (only if status is 'created')
      if (goal.status !== GoalStatus.CREATED) {
        throw new ForbiddenException('Cannot update goal after it has been assigned');
      }

      // Check for duplicate name if goalName is being updated
      if (updateDto.goalName && updateDto.goalName !== goal.goalName) {
        const existingGoal = await this.performanceGoalModel.findOne({
          where: {
            goalName: updateDto.goalName,
            tenantId,
            isActive: true,
            id: { [Op.ne]: id },
          },
        });

        if (existingGoal) {
          throw new ConflictException(
            `Goal with name '${updateDto.goalName}' already exists`,
          );
        }
      }

      // Update the goal
      await goal.update(updateDto);

      return await this.findOne(id, tenantId);
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof ForbiddenException || 
          error instanceof ConflictException) {
        throw error;
      }
      console.error('Failed to update performance goal:', error);
      throw new BadRequestException('Failed to update performance goal');
    }
  }

  /**
   * Soft delete a performance goal (only if not assigned yet)
   */
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    try {
      const goal = await this.findOne(id, tenantId);

      // Check if user has permission to delete
      const user = await this.userModel.findOne({
        where: { id: userId, tenantId },
      });

      if (!user || !['admin', 'hr'].includes(user.role?.toLowerCase())) {
        throw new ForbiddenException('Only Admin and HR can delete performance goals');
      }

      // Check if goal can be deleted (only if status is 'created')
      if (goal.status !== GoalStatus.CREATED) {
        throw new ForbiddenException('Cannot delete goal after it has been assigned');
      }

      // Soft delete
      await goal.update({ isActive: false });
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Failed to delete performance goal:', error);
      throw new BadRequestException('Failed to delete performance goal');
    }
  }

  /**
   * Get performance goal statistics
   */
  async getStatistics(tenantId: string, userRole: string): Promise<any> {
    try {
      // Only Admin and HR can view statistics
      if (!['admin', 'hr'].includes(userRole?.toLowerCase())) {
        throw new ForbiddenException('Only Admin and HR can view performance goal statistics');
      }

      const [total, active, byStatus, byCategory] = await Promise.all([
        this.performanceGoalModel.count({ where: { tenantId } }),
        this.performanceGoalModel.count({ where: { tenantId, isActive: true } }),
        this.performanceGoalModel.findAll({
          where: { tenantId, isActive: true },
          attributes: ['status'],
          group: ['status'],
          raw: true,
        }),
        this.performanceGoalModel.findAll({
          where: { tenantId, isActive: true },
          attributes: ['category'],
          group: ['category'],
          raw: true,
        }),
      ]);

      return {
        total,
        active,
        inactive: total - active,
        byStatus: byStatus.length,
        byCategory: byCategory.length,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Failed to fetch performance goal statistics:', error);
      throw new BadRequestException('Failed to fetch performance goal statistics');
    }
  }

  /**
   * Assign goal to multiple employees with reviewers
   */
  async assignGoal(
    assignDto: AssignGoalDto,
    tenantId: string,
    assignedBy: string,
  ): Promise<PerformanceGoalAssignment[]> {
    // Validate goalId is provided (should be set by controller)
    if (!assignDto.goalId) {
      throw new BadRequestException('Goal ID is required');
    }

    console.log('🎯 PerformanceGoalService: Assigning goal to employees', {
      goalId: assignDto.goalId,
      assignmentCount: assignDto.assignments.length,
      tenantId,
      assignedBy,
    });

    try {
      // 1. Verify goal exists and belongs to tenant
      const goal = await this.performanceGoalModel.findOne({
        where: {
          id: assignDto.goalId!,
          tenantId,
        },
      });

      if (!goal) {
        throw new NotFoundException('Performance goal not found');
      }

      if (goal.status !== GoalStatus.CREATED) {
        throw new BadRequestException('Goal must be in created status to assign');
      }

      // 2. Get assignedBy employee UUID (convert string employeeId to UUID)
      const assignedByEmployee = await this.employeeModel.findOne({
        where: {
          employeeId: assignedBy, // assignedBy is string employeeId from JWT
          tenantId,
        },
      });

      if (!assignedByEmployee) {
        throw new NotFoundException('Assigned by employee not found');
      }

      // 3. Validate all employees and reviewers exist and belong to tenant
      const employeeIds = assignDto.assignments.map(a => a.employeeId);
      const reviewerIds = assignDto.assignments.map(a => a.reviewerId);
      const allUserIds = [...new Set([...employeeIds, ...reviewerIds])];

      const employees = await this.employeeModel.findAll({
        where: {
          id: { [Op.in]: allUserIds },
          tenantId,
        },
      });

      if (employees.length !== allUserIds.length) {
        throw new BadRequestException('One or more employees/reviewers not found');
      }

      // 4. Validate reviewer != employee for each assignment
      for (const assignment of assignDto.assignments) {
        if (assignment.employeeId === assignment.reviewerId) {
          throw new BadRequestException('Reviewer cannot be the same as the assigned employee');
        }
      }

      // 5. Check for existing assignments
      const existingAssignments = await this.performanceGoalAssignmentModel.findAll({
        where: {
          goalId: assignDto.goalId!,
          employeeId: { [Op.in]: employeeIds },
          tenantId,
        },
      });

      if (existingAssignments.length > 0) {
        const duplicateEmployees = existingAssignments.map(a => a.employeeId);
        throw new BadRequestException(`Goal already assigned to some employees: ${duplicateEmployees.join(', ')}`);
      }

      // 6. Create assignments
      const assignments = await Promise.all(
        assignDto.assignments.map(assignment => {
          const assignmentData: PerformanceGoalAssignmentCreationAttributes = {
            goalId: assignDto.goalId!,
            employeeId: assignment.employeeId,
            reviewerId: assignment.reviewerId,
            assignedBy: assignedByEmployee.id,
            status: AssignmentStatus.ASSIGNED,
            tenantId,
          };
          return this.performanceGoalAssignmentModel.create(assignmentData);
        })
      );

      // 7. Update goal status to assigned
      await goal.update({ status: GoalStatus.ASSIGNED });

      console.log('✅ PerformanceGoalService: Goal assigned successfully', {
        goalId: assignDto.goalId!,
        assignmentCount: assignments.length,
      });

      // 8. Load assignments with relations for response
      return await this.performanceGoalAssignmentModel.findAll({
        where: {
          id: { [Op.in]: assignments.map(a => a.id) },
        },
        include: [
          {
            model: this.employeeModel,
            as: 'employee',
            attributes: ['id', 'employeeId', 'name'],
          },
          {
            model: this.employeeModel,
            as: 'reviewer',
            attributes: ['id', 'employeeId', 'name'],
          },
          {
            model: this.performanceGoalModel,
            as: 'goal',
            attributes: ['id', 'goalName', 'category', 'description'],
          },
        ],
      });

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ PerformanceGoalService: Failed to assign goal:', error);
      throw new BadRequestException('Failed to assign goal to employees');
    }
  }

  /**
   * Update goal assignments (add/remove employees, change reviewers)
   */
  async updateGoalAssignment(
    assignDto: AssignGoalDto,
    tenantId: string,
    updatedBy: string,
  ): Promise<PerformanceGoalAssignment[]> {
    // Validate goalId is provided (should be set by controller)
    if (!assignDto.goalId) {
      throw new BadRequestException('Goal ID is required');
    }

    console.log('🔄 PerformanceGoalService: Updating goal assignments', {
      goalId: assignDto.goalId,
      assignmentCount: assignDto.assignments.length,
      tenantId,
      updatedBy,
    });

    try {
      // 1. Verify goal exists and belongs to tenant
      const goal = await this.performanceGoalModel.findOne({
        where: {
          id: assignDto.goalId!,
          tenantId,
        },
      });

      if (!goal) {
        throw new NotFoundException('Performance goal not found');
      }

      if (goal.status !== GoalStatus.ASSIGNED) {
        throw new BadRequestException('Goal must be in assigned status to update assignments');
      }

      // 2. Get updatedBy employee UUID (convert string employeeId to UUID)
      const updatedByEmployee = await this.employeeModel.findOne({
        where: {
          employeeId: updatedBy, // updatedBy is string employeeId from JWT
          tenantId,
        },
      });

      if (!updatedByEmployee) {
        throw new NotFoundException('Updated by employee not found');
      }

      // 3. Validate all employees and reviewers exist and belong to tenant
      const employeeIds = assignDto.assignments.map(a => a.employeeId);
      const reviewerIds = assignDto.assignments.map(a => a.reviewerId);
      const allUserIds = [...new Set([...employeeIds, ...reviewerIds])];

      const employees = await this.employeeModel.findAll({
        where: {
          id: { [Op.in]: allUserIds },
          tenantId,
        },
      });

      if (employees.length !== allUserIds.length) {
        throw new BadRequestException('One or more employees/reviewers not found');
      }

      // 4. Validate reviewer != employee for each assignment
      for (const assignment of assignDto.assignments) {
        if (assignment.employeeId === assignment.reviewerId) {
          throw new BadRequestException('Reviewer cannot be the same as the assigned employee');
        }
      }

      // 5. Delete existing assignments for this goal
      await this.performanceGoalAssignmentModel.destroy({
        where: {
          goalId: assignDto.goalId!,
          tenantId,
        },
      });

      console.log('🗑️ Deleted existing assignments for goal:', assignDto.goalId);

      // 6. Create new assignments
      const assignments = await Promise.all(
        assignDto.assignments.map(assignment => {
          const assignmentData: PerformanceGoalAssignmentCreationAttributes = {
            goalId: assignDto.goalId!,
            employeeId: assignment.employeeId,
            reviewerId: assignment.reviewerId,
            assignedBy: updatedByEmployee.id,
            status: AssignmentStatus.ASSIGNED,
            tenantId,
          };
          return this.performanceGoalAssignmentModel.create(assignmentData);
        })
      );

      console.log('✅ PerformanceGoalService: Goal assignments updated successfully', {
        goalId: assignDto.goalId!,
        assignmentCount: assignments.length,
      });

      // 7. Load assignments with relations for response
      return await this.performanceGoalAssignmentModel.findAll({
        where: {
          id: { [Op.in]: assignments.map(a => a.id) },
        },
        include: [
          {
            model: this.employeeModel,
            as: 'employee',
            attributes: ['id', 'employeeId', 'name'],
          },
          {
            model: this.employeeModel,
            as: 'reviewer',
            attributes: ['id', 'employeeId', 'name'],
          },
          {
            model: this.performanceGoalModel,
            as: 'goal',
            attributes: ['id', 'goalName', 'category', 'description'],
          },
        ],
      });

    } catch (error) {
      console.error('❌ PerformanceGoalService: Failed to update goal assignments:', error);
      throw error;
    }
  }

  /**
   * Get assignments for a goal
   */
  async getGoalAssignments(
    goalId: string,
    tenantId: string,
  ): Promise<PerformanceGoalAssignment[]> {
    try {
      return await this.performanceGoalAssignmentModel.findAll({
        where: {
          goalId,
          tenantId,
        },
        include: [
          {
            model: this.employeeModel,
            as: 'employee',
            attributes: ['id', 'employeeId', 'name'],
          },
          {
            model: this.employeeModel,
            as: 'reviewer',
            attributes: ['id', 'employeeId', 'name'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
    } catch (error) {
      console.error('❌ PerformanceGoalService: Failed to get goal assignments:', error);
      throw new BadRequestException('Failed to get goal assignments');
    }
  }

  /**
   * Get eligible employees for assignment (excludes finance/admin)
   */
  async getEligibleEmployees(tenantId: string): Promise<Employee[]> {
    try {
      return await this.employeeModel.findAll({
        where: {
          tenantId,
          status: 'active',
        },
        include: [
          {
            model: this.userModel,
            as: 'user',
            where: {
              role: { [Op.notIn]: ['finance', 'admin'] },
            },
            attributes: ['id', 'role'],
          },
        ],
        attributes: ['id', 'employeeId', 'name', 'department'],
        order: [['name', 'ASC']],
      });
    } catch (error) {
      console.error('❌ PerformanceGoalService: Failed to get eligible employees:', error);
      throw new BadRequestException('Failed to get eligible employees');
    }
  }
}
