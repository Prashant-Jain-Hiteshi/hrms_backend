import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Company } from './companies.model';

@Module({
  imports: [SequelizeModule.forFeature([Company])],
  exports: [SequelizeModule],
})
export class CompaniesModule {}
