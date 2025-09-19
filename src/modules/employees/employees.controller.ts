import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { TenantId, CompanyCode } from '../../common/decorators/tenant.decorator';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  private readonly logger = new Logger(EmployeesController.name);

  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  create(
    @Body() dto: CreateEmployeeDto,
    @TenantId() tenantId: string,
    @CompanyCode() companyCode: string
  ) {
    this.logger.log(`Creating employee for tenant: ${tenantId} (${companyCode})`);
    return this.employeesService.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List employees (paginated)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE, Role.EMPLOYEE)
  findAll(
    @TenantId() tenantId: string,
    @CompanyCode() companyCode: string,
    @Query('limit') limit?: string, 
    @Query('offset') offset?: string
  ) {
    this.logger.log(`Listing employees for tenant: ${tenantId} (${companyCode})`);
    return this.employeesService.findAll(
      Number(limit) || 50,
      Number(offset) || 0,
      tenantId
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE, Role.EMPLOYEE)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string
  ) {
    this.logger.log(`Finding employee ${id} for tenant: ${tenantId}`);
    return this.employeesService.findOne(id, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an employee by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEmployeeDto,
    @TenantId() tenantId: string
  ) {
    this.logger.log(`Updating employee ${id} for tenant: ${tenantId}`);
    return this.employeesService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an employee by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string
  ) {
    this.logger.log(`Deleting employee ${id} for tenant: ${tenantId}`);
    return this.employeesService.remove(id, tenantId);
  }
}
