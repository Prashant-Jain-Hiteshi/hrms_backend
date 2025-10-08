import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentCategoryDto } from './create-document-category.dto';

export class UpdateDocumentCategoryDto extends PartialType(CreateDocumentCategoryDto) {}
