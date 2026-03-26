import { IsIn, IsString } from 'class-validator';

export class ActivateAddonDto {
  @IsString()
  @IsIn(['geek', 'dlc'])
  addonType: 'geek' | 'dlc';
}
