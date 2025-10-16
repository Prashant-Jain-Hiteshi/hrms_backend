import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

// Models
import { DocumentCategory } from './models/document-category.model';
import { DocumentType } from './models/document-type.model';
import { Document } from './models/document.model';
import { Employee } from '../employees/employees.model';
import { User } from '../users/users.model';

// Services
import { DocumentCategoryService } from './services/document-category.service';
import { DocumentTypeService } from './services/document-type.service';
import { DocumentService } from './services/document.service';

// Controllers
import { DocumentCategoryController } from './controllers/document-category.controller';
import { DocumentTypeController } from './controllers/document-type.controller';
import { DocumentController } from './controllers/document.controller';

// Import other modules
import { UploadModule } from '../../common/upload/upload.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      DocumentCategory,
      DocumentType,
      Document,
      Employee,
      User,
    ]),
    UploadModule,
    EmployeesModule,
  ],
  controllers: [
    DocumentCategoryController,
    DocumentTypeController,
    DocumentController,
  ],
  providers: [
    DocumentCategoryService,
    DocumentTypeService,
    DocumentService,
  ],
  exports: [
    DocumentCategoryService,
    DocumentTypeService,
    DocumentService,
    SequelizeModule,
  ],
})
export class DocumentModule {
  constructor() {
    console.log('📄 Document Module initialized successfully');
  }
}
