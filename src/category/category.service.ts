import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type QueryFilter } from 'mongoose';
import { Category, type CategoryDocument } from './category.schema';
import {
  CategoryFilterInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './category.input';
import { CacheService } from 'src/cache/cache.service';
import slugify from 'slugify';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';

import { CATEGORY_SELECT } from './category.select';
import { buildCategoryQuery, applyPagination } from './category.query';
import {
  buildCategoryFilterCacheKey,
  getCategoryFilterCached,
  setCategoryFilterCache,
  invalidateCategoryFilters,
  type CategoryPlain,
} from './category.cache';

@Injectable()
export class CategoryService {
  private readonly CACHE_KEYS = {
    ALL: 'category:all',
    BY_ID: (id: string) => `category:${id}`,
  };

  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
    private cacheService: CacheService,
    private fileCleanupService: FileCleanupService,
  ) {}

  async create(
    createCategoryInput: CreateCategoryInput,
  ): Promise<CategoryDocument> {
    const query: QueryFilter<CategoryDocument> = {
      name: createCategoryInput.name,
    };

    if (createCategoryInput.parent) {
      query.parent = new Types.ObjectId(createCategoryInput.parent);

      const exists = await this.categoryModel
        .findOne(query)
        .select('_id')
        .lean();
      if (exists) {
        throw new ConflictException(
          'Category with this name already exists in this parent category',
        );
      }
    } else {
      if (!createCategoryInput.type) {
        throw new BadRequestException('Type is required for main categories');
      }

      query.type = createCategoryInput.type;

      const exists = await this.categoryModel
        .findOne(query)
        .select('_id')
        .lean();
      if (exists) {
        throw new ConflictException(
          'Category with this name already exists in this category type',
        );
      }
    }

    if (createCategoryInput.parent) {
      const parent = await this.categoryModel
        .findById(createCategoryInput.parent)
        .select('_id')
        .lean();

      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const slug = slugify(createCategoryInput.name, {
      lower: true,
      strict: true,
      locale: 'ru',
    });

    const category = await this.categoryModel.create({
      ...createCategoryInput,
      slug,
      parent: createCategoryInput.parent
        ? new Types.ObjectId(createCategoryInput.parent)
        : undefined,
    });

    await this.cacheService.del(this.CACHE_KEYS.ALL);
    await invalidateCategoryFilters(this.cacheService);

    return category;
  }

  async findAll(): Promise<CategoryDocument[]> {
    const cached = await this.cacheService.get<CategoryPlain[]>(
      this.CACHE_KEYS.ALL,
    );
    if (cached) {
      return cached.map((item) =>
        this.categoryModel.hydrate(item),
      ) as CategoryDocument[];
    }

    const categories = await this.categoryModel.find();
    await this.cacheService.set(
      this.CACHE_KEYS.ALL,
      categories.map((cat) => cat.toObject()),
    );

    return categories;
  }

  async findOne(id: string): Promise<CategoryDocument> {
    const cached = await this.cacheService.get<CategoryPlain>(
      this.CACHE_KEYS.BY_ID(id),
    );
    if (cached) {
      return this.categoryModel.hydrate(cached) as CategoryDocument;
    }

    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    await this.cacheService.set(this.CACHE_KEYS.BY_ID(id), category.toObject());
    return category;
  }

  async update(
    id: string,
    updateCategoryInput: UpdateCategoryInput,
  ): Promise<CategoryDocument> {
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    const oldImageUrl = category.image;

    if (
      updateCategoryInput.name &&
      updateCategoryInput.name !== category.name
    ) {
      const q: QueryFilter<CategoryDocument> = {
        name: updateCategoryInput.name,
        _id: { $ne: new Types.ObjectId(id) },
      };

      const finalParent =
        updateCategoryInput.parent !== undefined
          ? updateCategoryInput.parent
          : category.parent
            ? category.parent.toString()
            : undefined;

      if (finalParent) {
        q.parent = new Types.ObjectId(finalParent);
      } else {
        const finalType =
          updateCategoryInput.type !== undefined
            ? updateCategoryInput.type
            : category.type;

        if (!finalType)
          throw new BadRequestException('Type is required for main categories');
        q.type = finalType;
      }

      const exists = await this.categoryModel.findOne(q).select('_id').lean();
      if (exists) {
        throw new ConflictException(
          'Category with this name already exists in this category type/parent',
        );
      }

      category.name = updateCategoryInput.name;
      category.slug = slugify(updateCategoryInput.name, {
        lower: true,
        strict: true,
        locale: 'ru',
      });
    }

    if (updateCategoryInput.parent !== undefined) {
      if (updateCategoryInput.parent === id) {
        throw new ConflictException('Category cannot be its own parent');
      }

      if (updateCategoryInput.parent) {
        const parent = await this.categoryModel
          .findById(updateCategoryInput.parent)
          .select('_id')
          .lean();

        if (!parent) throw new NotFoundException('Parent category not found');

        category.parent = new Types.ObjectId(updateCategoryInput.parent);
      } else {
        category.parent = undefined;
      }
    }

    if (updateCategoryInput.image !== undefined) {
      if (oldImageUrl && oldImageUrl !== updateCategoryInput.image) {
        await this.fileCleanupService.safeDeleteFile(
          oldImageUrl,
          'category old image',
        );
      }
      category.image = updateCategoryInput.image;
    }

    if (updateCategoryInput.description !== undefined) {
      category.description = updateCategoryInput.description;
    }

    if (updateCategoryInput.type !== undefined) {
      category.type = updateCategoryInput.type;
    }

    const updated = await category.save();

    await this.cacheService.del(this.CACHE_KEYS.BY_ID(id));
    await this.cacheService.del(this.CACHE_KEYS.ALL);
    await invalidateCategoryFilters(this.cacheService);

    return updated;
  }

  async remove(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    const subcategoriesCount = await this.categoryModel.countDocuments({
      parent: new Types.ObjectId(id),
    });

    if (subcategoriesCount > 0) {
      throw new ConflictException('Cannot delete category with subcategories');
    }

    if (category.image) {
      await this.fileCleanupService.safeDeleteFile(
        category.image,
        'category image',
      );
    }

    await this.categoryModel.findByIdAndDelete(id);

    await this.cacheService.del(this.CACHE_KEYS.BY_ID(id));
    await this.cacheService.del(this.CACHE_KEYS.ALL);
    await invalidateCategoryFilters(this.cacheService);

    return category;
  }

  async findWithFilters(
    filterInput?: CategoryFilterInput,
  ): Promise<CategoryDocument[]> {
    const search =
      typeof filterInput?.search === 'string' ? filterInput.search.trim() : '';
    const parent = filterInput?.parent;
    const parentIsSet = filterInput?.parent !== undefined;

    const cacheKey = buildCategoryFilterCacheKey({
      search: search || undefined,
      parent: parent ?? undefined,
      limit: filterInput?.limit ?? undefined,
      offset: filterInput?.offset ?? undefined,
    });

    const cached = await getCategoryFilterCached(
      this.cacheService,
      this.categoryModel,
      cacheKey,
    );
    if (cached) return cached;

    const query = buildCategoryQuery({ search, parent, parentIsSet });

    let q = this.categoryModel.find(query).select(CATEGORY_SELECT);
    q = applyPagination(q, filterInput?.limit, filterInput?.offset);

    const result = await q.exec();

    await setCategoryFilterCache(this.cacheService, cacheKey, result, 60);

    return result;
  }
}
