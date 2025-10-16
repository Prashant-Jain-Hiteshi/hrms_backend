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
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role as UserRole } from '../../../common/enums/role.enum';
import { PerformanceGoalService } from '../services/performance-goal.service';
import { CreatePerformanceGoalDto } from '../dto/create-performance-goal.dto';
import { UpdatePerformanceGoalDto } from '../dto/update-performance-goal.dto';
import { AssignGoalDto } from '../dto/assign-goal.dto';

@Controller('performance/goals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceGoalController {
  constructor(private readonly performanceGoalService: PerformanceGoalService) {}

  /**
   * Create a new performance goal
   * Only HR and Admin can create goals
   */
  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreatePerformanceGoalDto,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const createdBy = req.user.id;
      
      const goal = await this.performanceGoalService.create(createDto, tenantId, createdBy);
      
      return {
        success: true,
        message: 'Performance goal created successfully',
        data: goal,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all performance goals
   * Only HR and Admin can view all goals
   */
  @Get()
  @Roles(UserRole.HR, UserRole.ADMIN)
  async findAll(
    @Query('includeInactive') includeInactive: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;
      const includeInactiveFlag = includeInactive === 'true';
      
      const goals = await this.performanceGoalService.findAll(
        tenantId,
        userRole,
        includeInactiveFlag,
      );
      
      return {
        success: true,
        message: 'Performance goals fetched successfully',
        data: goals,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get performance goal statistics
   * Only HR and Admin can view statistics
   */
  @Get('statistics')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async getStatistics(@Request() req: any) {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;
      
      const stats = await this.performanceGoalService.getStatistics(tenantId, userRole);
      
      return {
        success: true,
        message: 'Performance goal statistics fetched successfully',
        data: stats,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get eligible employees for assignment
   * Excludes finance and admin roles
   */
  @Get('eligible-employees')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async getEligibleEmployees(@Request() req: any) {
    try {
      const tenantId = req.user.tenantId;

      const employees = await this.performanceGoalService.getEligibleEmployees(tenantId);

      return {
        success: true,
        message: 'Eligible employees fetched successfully',
        data: employees,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a specific performance goal by ID
   * Only HR and Admin can view goals
   */
  @Get(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const goal = await this.performanceGoalService.findOne(id, tenantId);
      
      return {
        success: true,
        message: 'Performance goal fetched successfully',
        data: goal,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a performance goal
   * Only HR and Admin can update goals (and only if status is 'created')
   */
  @Put(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePerformanceGoalDto,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const goal = await this.performanceGoalService.update(id, updateDto, tenantId, userId);
      
      return {
        success: true,
        message: 'Performance goal updated successfully',
        data: goal,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a performance goal (soft delete)
   * Only HR and Admin can delete goals (and only if status is 'created')
   */
  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      await this.performanceGoalService.remove(id, tenantId, userId);
      
      return {
        success: true,
        message: 'Performance goal deleted successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Assign goal to employees with reviewers
   * Only HR and Admin can assign goals
   */
  @Post(':goalId/assign')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async assignGoal(
    @Param('goalId') goalId: string,
    @Body() assignDto: AssignGoalDto,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const assignedBy = req.user.employeeId;

      // Validate goalId is a valid UUID
      if (!goalId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(goalId)) {
        throw new BadRequestException('Goal ID must be a valid UUID');
      }

      // Set goalId from URL parameter
      assignDto.goalId = goalId;

      const assignments = await this.performanceGoalService.assignGoal(
        assignDto,
        tenantId,
        assignedBy,
      );

      return {
        success: true,
        message: 'Goal assigned to employees successfully',
        data: assignments,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update goal assignments (add/remove employees, change reviewers)
   * Only HR and Admin can update assignments
   */
  @Put(':goalId/assign')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateGoalAssignment(
    @Param('goalId') goalId: string,
    @Body() assignDto: AssignGoalDto,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const updatedBy = req.user.employeeId;

      // Validate goalId is a valid UUID
      if (!goalId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(goalId)) {
        throw new BadRequestException('Goal ID must be a valid UUID');
      }

      // Set goalId from URL parameter
      assignDto.goalId = goalId;

      const assignments = await this.performanceGoalService.updateGoalAssignment(
        assignDto,
        tenantId,
        updatedBy,
      );

      return {
        success: true,
        message: 'Goal assignment updated successfully',
        data: assignments,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get assignments for a specific goal
   * HR and Admin can view all assignments
   */
  @Get(':goalId/assignments')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async getGoalAssignments(
    @Param('goalId') goalId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const assignments = await this.performanceGoalService.getGoalAssignments(
        goalId,
        tenantId,
      );

      return {
        success: true,
        message: 'Goal assignments fetched successfully',
        data: assignments,
      };
    } catch (error) {
      throw error;
    }
  }
}
