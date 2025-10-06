import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Job } from '../models/job.model';
import { Candidate } from '../models/candidate.model';
import { Department } from '../models/department.model';

export interface DashboardStats {
  totalApplications: number;
  interviewsScheduled: number;
  hiredThisMonth: number;
}

export interface RecruitmentFunnelItem {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyTrendItem {
  month: string;
  applications: number;
  hired: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Job)
    private jobModel: typeof Job,
    @InjectModel(Candidate)
    private candidateModel: typeof Candidate,
    @InjectModel(Department)
    private departmentModel: typeof Department,
  ) {}

  async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get total applications count
      const totalApplications = await this.candidateModel.count({
        include: [
          {
            model: Job,
            as: 'job',
            where: { tenantId },
            attributes: []
          }
        ]
      });

      // Get interviews scheduled (candidates with status 'interview' or 'hired')
      const interviewsScheduled = await this.candidateModel.count({
        where: {
          status: {
            [Op.in]: ['interview', 'hired']
          }
        },
        include: [
          {
            model: Job,
            as: 'job',
            where: { tenantId },
            attributes: []
          }
        ]
      });

      // Get hired this month
      const hiredThisMonth = await this.candidateModel.count({
        where: {
          status: 'hired',
          updatedAt: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        },
        include: [
          {
            model: Job,
            as: 'job',
            where: { tenantId },
            attributes: []
          }
        ]
      });

      return {
        totalApplications,
        interviewsScheduled,
        hiredThisMonth,
      };
    } catch (error) {
      console.error('❌ ERROR in getDashboardStats:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🏢 Tenant ID:', tenantId);
      
      throw new InternalServerErrorException('Failed to fetch dashboard stats');
    }
  }

  async getRecruitmentFunnel(tenantId: string): Promise<RecruitmentFunnelItem[]> {
    try {
      // Get candidate counts by status
      const statusCounts = await this.candidateModel.findAll({
        attributes: [
          ['status', 'status'], // Explicitly specify candidate status
          [this.candidateModel.sequelize?.fn('COUNT', this.candidateModel.sequelize?.col('Candidate.id')) || 'COUNT(*)', 'count']
        ],
        include: [
          {
            model: Job,
            as: 'job',
            where: { tenantId },
            attributes: []
          }
        ],
        group: ['Candidate.status'], // Explicitly specify table.column
        raw: true
      });

      // Define status colors
      const statusColors = {
        applied: '#3b82f6',
        screening: '#f59e0b',
        interview: '#10b981',
        hired: '#8b5cf6',
        rejected: '#ef4444'
      };

      // Convert to funnel format
      const funnel: RecruitmentFunnelItem[] = statusCounts.map((item: any) => ({
        name: item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown',
        value: parseInt(item.count) || 0,
        color: statusColors[item.status as keyof typeof statusColors] || '#6b7280'
      }));

      // If no data found, return default funnel with 0 counts for all statuses
      if (funnel.length === 0) {
        return [
          { name: 'Applied', value: 0, color: '#3b82f6' },
          { name: 'Screening', value: 0, color: '#f59e0b' },
          { name: 'Interview', value: 0, color: '#10b981' },
          { name: 'Hired', value: 0, color: '#8b5cf6' },
          { name: 'Rejected', value: 0, color: '#ef4444' }
        ];
      }

      // Ensure all statuses are represented (fill missing ones with 0)
      const allStatuses = ['applied', 'screening', 'interview', 'hired', 'rejected'];
      const existingStatuses = funnel.map(item => item.name.toLowerCase());
      
      // Add missing statuses with 0 count
      allStatuses.forEach(status => {
        if (!existingStatuses.includes(status)) {
          funnel.push({
            name: status.charAt(0).toUpperCase() + status.slice(1),
            value: 0,
            color: statusColors[status as keyof typeof statusColors] || '#6b7280'
          });
        }
      });

      // Sort funnel by predefined order
      const statusOrder = ['applied', 'screening', 'interview', 'hired', 'rejected'];
      funnel.sort((a, b) => {
        const aIndex = statusOrder.indexOf(a.name.toLowerCase());
        const bIndex = statusOrder.indexOf(b.name.toLowerCase());
        return aIndex - bIndex;
      });

      return funnel;
    } catch (error) {
      console.error('❌ ERROR in getRecruitmentFunnel:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🏢 Tenant ID:', tenantId);
      
      throw new InternalServerErrorException('Failed to fetch recruitment funnel');
    }
  }

  async getMonthlyTrends(tenantId: string, months: number = 6): Promise<MonthlyTrendItem[]> {
    try {
      const now = new Date();
      const trends: MonthlyTrendItem[] = [];

      // Generate data for the last N months including current month
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        // Get applications count for this month
        const applications = await this.candidateModel.count({
          where: {
            createdAt: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          },
          include: [
            {
              model: Job,
              as: 'job',
              where: { tenantId },
              attributes: []
            }
          ]
        });

        // Get hired count for this month (based on when status was updated to 'hired')
        const hired = await this.candidateModel.count({
          where: {
            status: 'hired',
            updatedAt: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          },
          include: [
            {
              model: Job,
              as: 'job',
              where: { tenantId },
              attributes: []
            }
          ]
        });

        trends.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          applications,
          hired
        });
      }

      return trends;
    } catch (error) {
      console.error('❌ ERROR in getMonthlyTrends:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🏢 Tenant ID:', tenantId);
      console.error('📊 Months requested:', months);
      
      throw new InternalServerErrorException('Failed to fetch monthly trends');
    }
  }

  async getWeeklyInterviewCount(tenantId: string): Promise<number> {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // End of current week (Saturday)
      endOfWeek.setHours(23, 59, 59, 999);

      const weeklyInterviews = await this.candidateModel.count({
        where: {
          status: 'interview',
          updatedAt: {
            [Op.between]: [startOfWeek, endOfWeek]
          }
        },
        include: [
          {
            model: Job,
            as: 'job',
            where: { tenantId },
            attributes: []
          }
        ]
      });

      return weeklyInterviews;
    } catch (error) {
      console.error('❌ ERROR in getWeeklyInterviewCount:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🏢 Tenant ID:', tenantId);
      
      throw new InternalServerErrorException('Failed to fetch weekly interview count');
    }
  }

  async getMonthlyApplicationCount(tenantId: string): Promise<number> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const monthlyApplications = await this.candidateModel.count({
        where: {
          createdAt: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        },
        include: [
          {
            model: Job,
            as: 'job',
            where: { tenantId },
            attributes: []
          }
        ]
      });

      return monthlyApplications;
    } catch (error) {
      console.error('❌ ERROR in getMonthlyApplicationCount:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🏢 Tenant ID:', tenantId);
      
      throw new InternalServerErrorException('Failed to fetch monthly application count');
    }
  }

  async getTodaysInterviews(tenantId: string): Promise<any[]> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      const todaysInterviews = await this.candidateModel.findAll({
        where: {
          status: 'interview',
          updatedAt: {
            [Op.between]: [startOfDay, endOfDay]
          }
        },
        include: [
          {
            model: Job,
            as: 'job',
            where: { tenantId },
            attributes: ['id', 'title'],
            required: true
          }
        ],
        attributes: ['id', 'fullName', 'position', 'updatedAt'],
        order: [['updatedAt', 'DESC']]
      });

      // Debug the raw data
      console.log('🔍 Raw today\'s interviews data:', JSON.stringify(todaysInterviews, null, 2));

      // Format the response
      return todaysInterviews.map(candidate => {
        console.log('🔍 Processing candidate:', {
          id: candidate.id,
          fullName: candidate.fullName,
          position: candidate.position,
          jobTitle: candidate.job?.title
        });
        
        return {
          id: candidate.id,
          candidate: candidate.fullName,
          position: candidate.position || candidate.job?.title || 'N/A',
          jobTitle: candidate.job?.title || 'N/A'
        };
      });
    } catch (error) {
      console.error('❌ ERROR in getTodaysInterviews:');
      console.error('🔍 Error type:', error.constructor.name);
      console.error('📝 Error message:', error.message);
      console.error('📊 Error stack:', error.stack);
      console.error('🏢 Tenant ID:', tenantId);
      
      throw new InternalServerErrorException('Failed to fetch today\'s interviews');
    }
  }
}
