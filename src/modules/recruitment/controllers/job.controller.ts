import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JobService } from '../services/job.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { JobQueryDto } from '../dto/job-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/recruitment/jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new job posting' })
  @ApiResponse({ status: 201, description: 'Job created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid department or deadline' })
  async create(@Body() createJobDto: CreateJobDto, @Request() req: any) {
    const job = await this.jobService.create(createJobDto, req.user.tenantId);
    
    return {
      message: 'Job created successfully',
      data: job,
    };
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE, Role.FINANCE)
  @ApiOperation({ summary: 'Get all jobs with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in title and location' })
  @ApiQuery({ name: 'department', required: false, type: String, description: 'Filter by department ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'closed'], description: 'Filter by status' })
  @ApiQuery({ name: 'jobType', required: false, enum: ['full-time', 'part-time', 'contract', 'internship'], description: 'Filter by job type' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  async findAll(@Query() query: JobQueryDto, @Request() req: any) {
    const result = await this.jobService.findAll(req.user.tenantId, query);
    
    return {
      message: 'Jobs retrieved successfully',
      data: result.jobs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Get job statistics' })
  @ApiResponse({ status: 200, description: 'Job statistics retrieved successfully' })
  async getStats(@Request() req: any) {
    const stats = await this.jobService.getJobStats(req.user.tenantId);
    
    return {
      message: 'Job statistics retrieved successfully',
      data: stats,
    };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE, Role.FINANCE)
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const job = await this.jobService.findOneWithApplicationCount(id, req.user.tenantId);
    
    return {
      message: 'Job retrieved successfully',
      data: job,
    };
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Update job' })
  @ApiResponse({ status: 200, description: 'Job updated successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Invalid department or deadline' })
  async update(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @Request() req: any,
  ) {
    const job = await this.jobService.update(id, updateJobDto, req.user.tenantId);
    
    return {
      message: 'Job updated successfully',
      data: job,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete job' })
  @ApiResponse({ status: 204, description: 'Job deleted successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.jobService.remove(id, req.user.tenantId);
    
    return {
      message: 'Job deleted successfully',
    };
  }
}
