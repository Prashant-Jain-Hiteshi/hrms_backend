import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Job } from '../models/job.model';
import { Department } from '../models/department.model';
import { Candidate } from '../models/candidate.model';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { JobQueryDto } from '../dto/job-query.dto';

interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class JobService {
  constructor(
    @InjectModel(Job)
    private jobModel: typeof Job,
    @InjectModel(Department)
    private departmentModel: typeof Department,
    @InjectModel(Candidate)
    private candidateModel: typeof Candidate,
  ) {}

  async findAll(tenantId: string, query: JobQueryDto): Promise<JobListResponse> {
    try {
      const { page = 1, limit = 10, search, department, status, jobType } = query;
      const offset = (page - 1) * limit;

      // Build where conditions
      const where: any = { tenantId };

      // Search in title and location
      if (search) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { location: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Filters
      if (department) where.departmentId = department;
      if (status) where.status = status;
      if (jobType) where.jobType = jobType;

      const { rows: jobs, count: total } = await this.jobModel.findAndCountAll({
        where,
        include: [
          {
            model: Department,
            as: 'department',
            attributes: ['id', 'name']
          },
          {
            model: Candidate,
            as: 'candidates',
            attributes: ['id'], // Only need count, not full data
            required: false // LEFT JOIN to include jobs with 0 candidates
          }
        ],
        order: [['createdAt', 'DESC']], // New first
        limit,
        offset,
      });

      const totalPages = Math.ceil(total / limit);

      // Add application count to each job
      const jobsWithApplicationCount = jobs.map(job => {
        const jobData = job.toJSON();
        jobData.applications = job.candidates ? job.candidates.length : 0;
        // Remove candidates array from response to keep it clean
        delete jobData.candidates;
        return jobData;
      });

      return {
        jobs: jobsWithApplicationCount,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      console.error('Error fetching jobs:', error);
      throw new InternalServerErrorException('Failed to fetch jobs');
    }
  }

  async findOne(id: string, tenantId: string): Promise<Job> {
    try {
      const job = await this.jobModel.findOne({
        where: { id, tenantId },
        include: [
          {
            model: Department,
            as: 'department',
            attributes: ['id', 'name']
          }
        ],
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }

      return job;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching job:', error);
      throw new InternalServerErrorException('Failed to fetch job');
    }
  }

  async findOneWithApplicationCount(id: string, tenantId: string): Promise<any> {
    try {
      const job = await this.jobModel.findOne({
        where: { id, tenantId },
        include: [
          {
            model: Department,
            as: 'department',
            attributes: ['id', 'name']
          },
          {
            model: Candidate,
            as: 'candidates',
            attributes: ['id'], // Only need count, not full data
            required: false // LEFT JOIN to include jobs with 0 candidates
          }
        ],
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }

      // Add application count to job data
      const jobData = job.toJSON();
      jobData.applications = job.candidates ? job.candidates.length : 0;
      // Remove candidates array from response to keep it clean
      delete jobData.candidates;

      return jobData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching job with application count:', error);
      throw new InternalServerErrorException('Failed to fetch job');
    }
  }

  async create(createJobDto: CreateJobDto, tenantId: string): Promise<Job> {
    try {
      // Validate department exists and is active
      const department = await this.departmentModel.findOne({
        where: { 
          id: createJobDto.departmentId, 
          tenantId, 
          isActive: true 
        },
      });

      if (!department) {
        throw new BadRequestException('Invalid department selected');
      }

      // Validate application deadline is in future
      if (createJobDto.applicationDeadline) {
        const deadline = new Date(createJobDto.applicationDeadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (deadline < today) {
          throw new BadRequestException('Application deadline cannot be in the past');
        }
      }

      const job = await this.jobModel.create({
        ...createJobDto,
        tenantId,
        status: createJobDto.status || 'active',
      });

      // Return job with department details
      return await this.findOne(job.id, tenantId);
    } catch (error) {
      console.error('❌ ERROR in job creation:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('📥 Input data that caused error:', JSON.stringify(createJobDto, null, 2));
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

      // Throw internal server error for all other cases
      throw new InternalServerErrorException('Failed to create job');
    }
  }

  async update(id: string, updateJobDto: UpdateJobDto, tenantId: string): Promise<Job> {
    try {
      const job = await this.findOne(id, tenantId);

      // Validate department if being updated
      if (updateJobDto.departmentId) {
        const department = await this.departmentModel.findOne({
          where: { 
            id: updateJobDto.departmentId, 
            tenantId, 
            isActive: true 
          },
        });

        if (!department) {
          throw new BadRequestException('Invalid department selected');
        }
      }

      // Validate application deadline if being updated
      if (updateJobDto.applicationDeadline) {
        const deadline = new Date(updateJobDto.applicationDeadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (deadline < today) {
          throw new BadRequestException('Application deadline cannot be in the past');
        }
      }

      await job.update(updateJobDto);
      return await this.findOne(job.id, tenantId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error updating job:', error);
      throw new InternalServerErrorException('Failed to update job');
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      // Find the job instance directly for deletion (not using findOne which returns plain object)
      const job = await this.jobModel.findOne({
        where: { id, tenantId },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }

      // Check if job has applications (when candidate module is implemented)
      // For now, just delete the job
      
      await job.destroy();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('❌ ERROR in job deletion:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('📤 Job ID that caused error:', id);
      console.error('🏢 Tenant ID:', tenantId);
      
      throw new InternalServerErrorException('Failed to delete job');
    }
  }

  async getJobStats(tenantId: string): Promise<any> {
    try {
      const [activeJobs, totalJobs, closedJobs] = await Promise.all([
        this.jobModel.count({ where: { tenantId, status: 'active' } }),
        this.jobModel.count({ where: { tenantId } }),
        this.jobModel.count({ where: { tenantId, status: 'closed' } }),
      ]);

      return {
        activeJobs,
        totalJobs,
        closedJobs,
        inactiveJobs: totalJobs - activeJobs - closedJobs,
      };
    } catch (error) {
      console.error('Error fetching job stats:', error);
      throw new InternalServerErrorException('Failed to fetch job statistics');
    }
  }
}
