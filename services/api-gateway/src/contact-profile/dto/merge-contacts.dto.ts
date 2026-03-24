import { IsString, IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class MergeContactsDto {
  /** The contact that survives the merge (primary record). */
  @IsString()
  @IsUUID()
  primaryId!: string;

  /** IDs of duplicate contacts to merge into the primary and then delete. */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  duplicateIds!: string[];
}
