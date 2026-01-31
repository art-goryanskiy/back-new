import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateEducationDocumentInput {
  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  image?: string;
}

@InputType()
export class UpdateEducationDocumentInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  image?: string;
}
