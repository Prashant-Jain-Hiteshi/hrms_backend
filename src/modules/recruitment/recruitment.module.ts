import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DepartmentController } from './controllers/department.controller';
import { JobController } from './controllers/job.controller';
import { CandidateController } from './controllers/candidate.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { DepartmentService } from './services/department.service';
import { JobService } from './services/job.service';
import { CandidateService } from './services/candidate.service';
import { DashboardService } from './services/dashboard.service';
import { Department } from './models/department.model';
import { Job } from './models/job.model';
import { Candidate } from './models/candidate.model';
import { Company } from '../companies/companies.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Department,
      Job,
      Candidate,
      Company,
    ]),
  ],
  controllers: [
    DepartmentController,
    JobController,
    CandidateController,
    DashboardController,
  ],
  providers: [
    DepartmentService,
    JobService,
    CandidateService,
    DashboardService,
  ],
  exports: [
    DepartmentService,
    JobService,
    CandidateService,
  ],
})
export class RecruitmentModule {}
