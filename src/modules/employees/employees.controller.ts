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
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List employees (paginated)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE, Role.EMPLOYEE)
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.employeesService.findAll(
      Number(limit) || 50,
      Number(offset) || 0,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE, Role.EMPLOYEE)
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.employeesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an employee by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an employee by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.employeesService.remove(id);
  }
}
