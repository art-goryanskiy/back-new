import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import slugify from 'slugify';

@Schema({
  _id: false,
})
export class ProgramPricing {
  @Prop({ required: true, type: Number })
  hours: number;

  @Prop({ required: true, type: Number })
  price: number;
}

@Schema({ _id: false })
export class ProgramSubProgram {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;
}

@Schema({
  timestamps: true,
})
export class Program {
  @Prop({ required: true })
  title: string;

  @Prop()
  shortTitle?: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  description?: string;

  @Prop({
    ref: 'Category',
    type: Types.ObjectId,
    required: true,
  })
  category: Types.ObjectId;

  @Prop({
    ref: 'EducationDocument',
    type: Types.ObjectId,
    required: false,
  })
  educationDocument?: Types.ObjectId;

  @Prop()
  image?: string;

  @Prop()
  studentCategory?: string;

  @Prop()
  awardedQualification?: string;

  @Prop({ type: Number })
  awardedRankFrom?: number;

  @Prop({ type: Number })
  awardedRankTo?: number;

  @Prop({ required: false })
  baseHours?: number;

  @Prop({ type: [ProgramPricing], required: false, default: [] })
  pricing?: ProgramPricing[];

  @Prop({ default: 0, type: Number })
  views?: number;

  @Prop({ type: [ProgramSubProgram], required: false, default: [] })
  subPrograms?: ProgramSubProgram[];
}

export type ProgramDocument = HydratedDocument<Program>;
export const ProgramSchema = SchemaFactory.createForClass(Program);

ProgramSchema.pre('save', function () {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      locale: 'ru',
    });
  }
});

ProgramSchema.index({ title: 1 });
ProgramSchema.index({ category: 1 });
ProgramSchema.index({ views: -1 });

// НОВОЕ: составные индексы для оптимизации поиска с фильтрацией
ProgramSchema.index({ title: 1, category: 1 });
// Индекс для сортировки по createdAt (используется в findWithFilters)
ProgramSchema.index({ createdAt: -1 });
