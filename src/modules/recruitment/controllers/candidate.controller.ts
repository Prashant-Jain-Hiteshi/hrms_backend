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
  ValidationPipe,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { CandidateService } from '../services/candidate.service';
import { CreateCandidateDto } from '../dto/create-candidate.dto';
import { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { CandidateStatus } from '../models/candidate.model';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/recruitment/candidates')
@UseGuards(JwtAuthGuard)
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Post()
  async create(
    @Body(ValidationPipe) createCandidateDto: CreateCandidateDto,
    @Request() req: any,
  ) {
    try {
      const candidate = await this.candidateService.create(
        createCandidateDto,
        req.user.tenantId,
      );

      return {
        success: true,
        message: 'Candidate created successfully',
        data: candidate,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('search') search?: string,
    @Query('status', new ParseEnumPipe(CandidateStatus, { optional: true })) status?: CandidateStatus,
    @Query('jobId', new ParseUUIDPipe({ optional: true })) jobId?: string,
  ) {
    try {
      const result = await this.candidateService.findAll(req.user.tenantId, {
        page,
        limit,
        search,
        status,
        jobId,
      });

      return {
        success: true,
        message: 'Candidates retrieved successfully',
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    try {
      const candidate = await this.candidateService.findOne(id, req.user.tenantId);

      return {
        success: true,
        message: 'Candidate retrieved successfully',
        data: candidate,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateCandidateDto: UpdateCandidateDto,
    @Request() req: any,
  ) {
    try {
      const candidate = await this.candidateService.update(
        id,
        updateCandidateDto,
        req.user.tenantId,
      );

      return {
        success: true,
        message: 'Candidate updated successfully',
        data: candidate,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status', new ParseEnumPipe(CandidateStatus)) status: CandidateStatus,
    @Request() req: any,
  ) {
    try {
      const candidate = await this.candidateService.updateStatus(
        id,
        status,
        req.user.tenantId,
      );

      return {
        success: true,
        message: 'Candidate status updated successfully',
        data: candidate,
      };
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    try {
      await this.candidateService.remove(id, req.user.tenantId);

      return {
        success: true,
        message: 'Candidate deleted successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('job/:jobId/stats')
  async getJobStats(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Request() req: any,
  ) {
    try {
      const stats = await this.candidateService.getStatsByJob(
        jobId,
        req.user.tenantId,
      );

      return {
        success: true,
        message: 'Candidate statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      throw error;
    }
  }
}
