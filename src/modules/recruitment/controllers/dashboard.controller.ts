import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DashboardService, RecruitmentFunnelItem, MonthlyTrendItem } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Recruitment Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/recruitment/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  async getDashboardStats(@Request() req: any) {
    try {
      const tenantId = req.user.tenantId;
      const stats = await this.dashboardService.getDashboardStats(tenantId);
      
      return {
        success: true,
        ...stats
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Get recruitment funnel data' })
  @ApiResponse({ status: 200, description: 'Recruitment funnel data retrieved successfully' })
  async getRecruitmentFunnel(@Request() req: any) {
    try {
      const tenantId = req.user.tenantId;
      const funnel = await this.dashboardService.getRecruitmentFunnel(tenantId);
      
      return funnel;
    } catch (error) {
      throw error;
    }
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get monthly hiring trends' })
  @ApiResponse({ status: 200, description: 'Monthly trends data retrieved successfully' })
  async getMonthlyTrends(
    @Request() req: any,
    @Query('months') months?: string
  ) {
    try {
      const tenantId = req.user.tenantId;
      const monthsCount = months ? parseInt(months) : 6;
      const trends = await this.dashboardService.getMonthlyTrends(tenantId, monthsCount);
      
      return trends;
    } catch (error) {
      throw error;
    }
  }

  @Get('hr-stats')
  @ApiOperation({ summary: 'Get HR dashboard statistics' })
  @ApiResponse({ status: 200, description: 'HR dashboard stats retrieved successfully' })
  async getHRDashboardStats(@Request() req: any) {
    try {
      const tenantId = req.user.tenantId;
      console.log('🔄 HR Dashboard API called for tenant:', tenantId);
      
      const [weeklyInterviews, monthlyApplications, todaysInterviews] = await Promise.all([
        this.dashboardService.getWeeklyInterviewCount(tenantId),
        this.dashboardService.getMonthlyApplicationCount(tenantId),
        this.dashboardService.getTodaysInterviews(tenantId)
      ]);
      
      console.log('📊 HR Dashboard results:');
      console.log('- Weekly interviews:', weeklyInterviews);
      console.log('- Monthly applications:', monthlyApplications);
      console.log('- Today\'s interviews:', todaysInterviews);
      
      return {
        success: true,
        upcomingInterviews: weeklyInterviews,
        newApplications: monthlyApplications,
        todaysInterviews: todaysInterviews
      };
    } catch (error) {
      throw error;
    }
  }
}
