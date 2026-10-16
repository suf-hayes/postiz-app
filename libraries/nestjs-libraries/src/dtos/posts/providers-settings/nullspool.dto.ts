import { IsString, Matches } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

export class NullspoolDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,79}$/, {
    message: 'Episode slug: lowercase letters, digits and dashes',
  })
  @JSONSchema({
    description: 'Episode slug, the folder name under shows/<show>/episodes/',
  })
  slug: string;
}
