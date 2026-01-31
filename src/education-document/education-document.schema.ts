import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
})
export class EducationDocument {
  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;
}

export type EducationDocumentDocument = HydratedDocument<EducationDocument>;
export const EducationDocumentSchema =
  SchemaFactory.createForClass(EducationDocument);

EducationDocumentSchema.index({ name: 1 });
