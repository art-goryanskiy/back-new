import { CategoryDocument } from 'src/category/category.schema';
import { CategoryEntity } from 'src/category/category.entity';
import { extractId } from './base.mapper';

export function toCategoryEntity(
  category: CategoryDocument | null,
): CategoryEntity | null {
  if (!category) return null;

  const categoryObj = category.toObject();
  const categoryWithTimestamps = categoryObj as typeof categoryObj & {
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: extractId(category),
    name: category.name,
    slug: category.slug,
    parent: category.parent?.toString(),
    image: category.image,
    description: category.description,
    type: category.type,
    createdAt: categoryWithTimestamps.createdAt || new Date(),
    updatedAt: categoryWithTimestamps.updatedAt || new Date(),
  };
}

export function toCategoryEntityArray(
  categories: CategoryDocument[],
): CategoryEntity[] {
  return categories
    .map(toCategoryEntity)
    .filter((c): c is CategoryEntity => c !== null);
}
