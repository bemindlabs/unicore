import type { Template } from '../common/interfaces/template.interface';

export class TemplateListResponseDto {
  success!: boolean;
  data!: Template[];
}

export class TemplateDetailResponseDto {
  success!: boolean;
  data!: Template;
}
