import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import slugify from 'slugify';

export enum CategoryType {
  QUALIFICATION_UPGRADE = 'qualification_upgrade', // Повышение квалификации
  PROFESSIONAL_RETRAINING = 'professional_retraining', // Профессиональная переподготовка
  PROFESSIONAL_EDUCATION = 'professional_education', // Профессиональное обучение
}

@Schema({
  timestamps: true,
})
export class Category {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  slug: string;

  @Prop({
    ref: 'Category',
    type: Types.ObjectId,
    required: false,
  })
  parent?: Types.ObjectId;

  @Prop()
  image?: string;

  @Prop()
  description?: string;

  @Prop({ enum: CategoryType, required: false, type: String })
  type: CategoryType;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
export type CategoryDocument = HydratedDocument<Category>;

CategorySchema.pre('save', function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      locale: 'ru',
    });
  }
});

CategorySchema.index({ name: 1 });
CategorySchema.index({ parent: 1 });
CategorySchema.index(
  { name: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { parent: null },
  },
);
CategorySchema.index(
  { name: 1, parent: 1 },
  {
    unique: true,
    partialFilterExpression: { parent: { $ne: null } },
  },
);
CategorySchema.index({ slug: 1 });
