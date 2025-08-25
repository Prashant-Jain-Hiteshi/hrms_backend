import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async health() {
    try {
      await this.sequelize.authenticate();
      return { status: 'ok', db: 'up' };
    } catch (error) {
      return { status: 'degraded', db: 'down', error: String(error) };
    }
  }
}
