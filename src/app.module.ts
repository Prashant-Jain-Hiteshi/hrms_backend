import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';

@Module({
  imports: [
    // Load env vars globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Initialize Sequelize (Postgres) using env vars
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logging = config.get('DB_LOGGING') === 'true' ? console.log : false;
        const ssl = config.get('DB_SSL') === 'true';
        const dialectOptions = ssl
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {};

        return {
          dialect: 'postgres',
          host: config.get('DB_HOST', 'localhost'),
          port: parseInt(config.get('DB_PORT', '5432'), 10),
          database: config.get('DB_NAME', 'hrm_db'),
          username: config.get('DB_USER', 'postgres'),
          password: config.get('DB_PASS', 'postgres'),
          autoLoadModels: true,
          synchronize: config.get('DB_SYNC', 'false') === 'true',
          logging,
          dialectOptions,
        } as any;
      },
    }),
    UsersModule,
    AuthModule,
    EmployeesModule,
    AttendanceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
