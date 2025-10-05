import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentService } from '../services/department.service';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  @ApiResponse({ status: 409, description: 'Department already exists' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto, @Request() req: any) {
    const department = await this.departmentService.create(
      createDepartmentDto,
      req.user.tenantId,
    );
    
    return {
      message: 'Department created successfully',
      data: department,
    };
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE, Role.FINANCE)
  @ApiOperation({ summary: 'Get all departments' })
  @ApiResponse({ status: 200, description: 'Departments retrieved successfully' })
  async findAll(@Request() req: any) {
    const departments = await this.departmentService.findAll(req.user.tenantId);
    
    return {
      message: 'Departments retrieved successfully',
      data: departments,
    };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE, Role.FINANCE)
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiResponse({ status: 200, description: 'Department retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const department = await this.departmentService.findOne(id, req.user.tenantId);
    
    return {
      message: 'Department retrieved successfully',
      data: department,
    };
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Update department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 409, description: 'Department name already exists' })
  async update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @Request() req: any,
  ) {
    const department = await this.departmentService.update(
      id,
      updateDepartmentDto,
      req.user.tenantId,
    );
    
    return {
      message: 'Department updated successfully',
      data: department,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete department (soft delete)' })
  @ApiResponse({ status: 204, description: 'Department deleted successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete department with active jobs' })
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.departmentService.remove(id, req.user.tenantId);
    
    return {
      message: 'Department deleted successfully',
    };
  }
}
