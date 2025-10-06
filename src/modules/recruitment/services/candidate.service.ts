import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Candidate, CandidateStatus } from '../models/candidate.model';
import { Job } from '../models/job.model';
import { Department } from '../models/department.model';
import { CreateCandidateDto } from '../dto/create-candidate.dto';
import { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { Op } from 'sequelize';

@Injectable()
export class CandidateService {
  constructor(
    @InjectModel(Candidate)
    private candidateModel: typeof Candidate,
    @InjectModel(Job)
    private jobModel: typeof Job,
  ) {}

  async findAll(tenantId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: CandidateStatus;
    jobId?: string;
  } = {}): Promise<{
    data: Candidate[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const offset = (page - 1) * limit;

      const whereClause: any = { tenantId };

      // Add search functionality
      if (options.search) {
        whereClause[Op.or] = [
          { fullName: { [Op.iLike]: `%${options.search}%` } },
          { email: { [Op.iLike]: `%${options.search}%` } },
          { position: { [Op.iLike]: `%${options.search}%` } }
        ];
      }

      // Filter by status
      if (options.status) {
        whereClause.status = options.status;
      }

      // Filter by job
      if (options.jobId) {
        whereClause.jobId = options.jobId;
      }

      const { count, rows } = await this.candidateModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Job,
            include: [Department]
          }
        ],
        limit,
        offset,
        order: [['appliedDate', 'DESC']],
      });

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      console.error('❌ ERROR in candidate listing:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🏢 Tenant ID:', tenantId);
      console.error('📥 Options:', JSON.stringify(options, null, 2));

      throw new InternalServerErrorException('Failed to fetch candidates');
    }
  }

  async findOne(id: string, tenantId: string): Promise<Candidate> {
    try {
      const candidate = await this.candidateModel.findOne({
        where: { id, tenantId },
        include: [
          {
            model: Job,
            include: [Department]
          }
        ],
      });

      if (!candidate) {
        throw new NotFoundException('Candidate not found');
      }

      return candidate;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      console.error('❌ ERROR in candidate fetch:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🆔 Candidate ID:', id);
      console.error('🏢 Tenant ID:', tenantId);

      throw new InternalServerErrorException('Failed to fetch candidate');
    }
  }

  async create(createCandidateDto: CreateCandidateDto, tenantId: string): Promise<Candidate> {
    try {
      // Validate job exists and is active
      const job = await this.jobModel.findOne({
        where: { 
          id: createCandidateDto.jobId, 
          tenantId, 
          status: 'active' 
        },
      });

      if (!job) {
        throw new BadRequestException('Invalid job selected or job is not active');
      }

      const candidate = await this.candidateModel.create({
        ...createCandidateDto,
        tenantId,
        status: CandidateStatus.APPLIED,
        appliedDate: new Date(),
      } as any);

      // Return candidate with job details
      return await this.findOne(candidate.id, tenantId);
    } catch (error) {
      console.error('❌ ERROR in candidate creation:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('📥 Input data:', JSON.stringify(createCandidateDto, null, 2));
      console.error('🏢 Tenant ID:', tenantId);

      // Log specific error details based on error type
      if (error.name === 'SequelizeValidationError') {
        console.error('🔍 Validation errors:', error.errors);
      } else if (error.name === 'SequelizeUniqueConstraintError') {
        console.error('🔍 Unique constraint violation:', error.fields);
      } else if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.error('🔍 Foreign key constraint error:', error.fields);
      } else if (error.name === 'SequelizeDatabaseError') {
        console.error('🔍 Database error details:', error.sql);
      }

      // Re-throw BadRequestException as-is
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create candidate');
    }
  }

  async update(id: string, updateCandidateDto: UpdateCandidateDto, tenantId: string): Promise<Candidate> {
    try {
      const candidate = await this.findOne(id, tenantId);

      await candidate.update(updateCandidateDto);

      // Return updated candidate with job details
      return await this.findOne(candidate.id, tenantId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('❌ ERROR in candidate update:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🆔 Candidate ID:', id);
      console.error('📥 Update data:', JSON.stringify(updateCandidateDto, null, 2));
      console.error('🏢 Tenant ID:', tenantId);

      if (error.name === 'SequelizeValidationError') {
        console.error('🔍 Validation errors:', error.errors);
      }

      throw new InternalServerErrorException('Failed to update candidate');
    }
  }

  async updateStatus(id: string, status: CandidateStatus, tenantId: string): Promise<Candidate> {
    try {
      const candidate = await this.findOne(id, tenantId);

      await candidate.update({ status });

      return await this.findOne(candidate.id, tenantId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('❌ ERROR in candidate status update:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🆔 Candidate ID:', id);
      console.error('📊 New status:', status);
      console.error('🏢 Tenant ID:', tenantId);

      throw new InternalServerErrorException('Failed to update candidate status');
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      const candidate = await this.findOne(id, tenantId);

      await candidate.destroy();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('❌ ERROR in candidate deletion:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🆔 Candidate ID:', id);
      console.error('🏢 Tenant ID:', tenantId);

      throw new InternalServerErrorException('Failed to delete candidate');
    }
  }

  async getStatsByJob(jobId: string, tenantId: string): Promise<{
    total: number;
    byStatus: Record<CandidateStatus, number>;
  }> {
    try {
      const candidates = await this.candidateModel.findAll({
        where: { jobId, tenantId },
        attributes: ['status'],
      });

      const total = candidates.length;
      const byStatus = Object.values(CandidateStatus).reduce((acc, status) => {
        acc[status] = candidates.filter(c => c.status === status).length;
        return acc;
      }, {} as Record<CandidateStatus, number>);

      return { total, byStatus };
    } catch (error) {
      console.error('❌ ERROR in candidate stats:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🆔 Job ID:', jobId);
      console.error('🏢 Tenant ID:', tenantId);

      throw new InternalServerErrorException('Failed to fetch candidate statistics');
    }
  }
}
