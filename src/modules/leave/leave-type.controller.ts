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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LeaveTypeService } from './leave-type.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';

@ApiTags('Leave Types Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-types')
export class LeaveTypeController {
  constructor(private readonly leaveTypeService: LeaveTypeService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new leave type (Admin only)' })
  @ApiResponse({ status: 201, description: 'Leave type created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - leave type name already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async createLeaveType(@Body() createLeaveTypeDto: CreateLeaveTypeDto) {
    return this.leaveTypeService.createLeaveType(createLeaveTypeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active leave types' })
  @ApiResponse({ status: 200, description: 'Leave types retrieved successfully' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for filtering leave types' })
  @ApiQuery({ name: 'eligibility', required: false, description: 'Filter by eligibility type' })
  async getAllLeaveTypes(
    @Query('search') search?: string,
    @Query('eligibility') eligibility?: string,
  ) {
    if (search) {
      return this.leaveTypeService.searchLeaveTypes(search);
    }
    
    if (eligibility) {
      return this.leaveTypeService.getLeaveTypesByEligibility(eligibility);
    }

    return this.leaveTypeService.getAllLeaveTypes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave type by ID' })
  @ApiResponse({ status: 200, description: 'Leave type retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  async getLeaveTypeById(@Param('id', ParseIntPipe) id: number) {
    return this.leaveTypeService.getLeaveTypeById(id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update leave type (Admin only)' })
  @ApiResponse({ status: 200, description: 'Leave type updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @ApiResponse({ status: 409, description: 'Conflict - leave type name already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async updateLeaveType(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeaveTypeDto: UpdateLeaveTypeDto,
  ) {
    return this.leaveTypeService.updateLeaveType(id, updateLeaveTypeDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete leave type (Admin only)' })
  @ApiResponse({ status: 200, description: 'Leave type deleted successfully' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @HttpCode(HttpStatus.OK)
  async deleteLeaveType(@Param('id', ParseIntPipe) id: number) {
    return this.leaveTypeService.deleteLeaveType(id);
  }

  @Put(':id/toggle-status')
  @Roles('admin')
  @ApiOperation({ summary: 'Toggle leave type active status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Leave type status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async toggleLeaveTypeStatus(@Param('id', ParseIntPipe) id: number) {
    return this.leaveTypeService.toggleLeaveTypeStatus(id);
  }
}
