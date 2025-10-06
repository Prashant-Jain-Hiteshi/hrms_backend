import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ExpenseCategoryService } from '../services/expense-category.service';
import { CreateExpenseCategoryDto } from '../dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from '../dto/update-expense-category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { UserRole } from '../../users/user-role.enum';
import { NotFoundException, BadRequestException } from '@nestjs/common';

@ApiTags('Expense Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/expense/categories')
export class ExpenseCategoryController {
  constructor(private readonly expenseCategoryService: ExpenseCategoryService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new expense category' })
  @ApiResponse({ status: 201, description: 'Expense category created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or duplicate category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async create(
    @Body(ValidationPipe) createDto: CreateExpenseCategoryDto,
    @TenantId() tenantId: string,
  ) {
    try {
      const category = await this.expenseCategoryService.create(createDto, tenantId);
      return {
        success: true,
        message: 'Expense category created successfully',
        data: category,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create expense category');
    }
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get all expense categories' })
  @ApiResponse({ status: 200, description: 'Expense categories retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin, HR, or Finance role required' })
  async findAll(@TenantId() tenantId: string) {
    try {
      const categories = await this.expenseCategoryService.findAll(tenantId);
      return {
        success: true,
        message: 'Expense categories retrieved successfully',
        data: categories,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch expense categories');
    }
  }

  @Get('active')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.FINANCE, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get all active expense categories' })
  @ApiResponse({ status: 200, description: 'Active expense categories retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findActiveCategories(@TenantId() tenantId: string) {
    try {
      const categories = await this.expenseCategoryService.findActiveCategories(tenantId);
      return {
        success: true,
        message: 'Active expense categories retrieved successfully',
        data: categories,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch active expense categories');
    }
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get expense category by ID' })
  @ApiResponse({ status: 200, description: 'Expense category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Expense category not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin, HR, or Finance role required' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    try {
      const category = await this.expenseCategoryService.findOne(id, tenantId);
      return {
        success: true,
        message: 'Expense category retrieved successfully',
        data: category,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch expense category');
    }
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update expense category' })
  @ApiResponse({ status: 200, description: 'Expense category updated successfully' })
  @ApiResponse({ status: 404, description: 'Expense category not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or duplicate category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateDto: UpdateExpenseCategoryDto,
    @TenantId() tenantId: string,
  ) {
    try {
      const category = await this.expenseCategoryService.update(id, updateDto, tenantId);
      return {
        success: true,
        message: 'Expense category updated successfully',
        data: category,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update expense category');
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete expense category' })
  @ApiResponse({ status: 200, description: 'Expense category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Expense category not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    try {
      await this.expenseCategoryService.remove(id, tenantId);
      return {
        success: true,
        message: 'Expense category deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete expense category');
    }
  }
}
