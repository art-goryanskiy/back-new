import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  Resolver,
  ResolveField,
} from '@nestjs/graphql';
import { CategoryEntity } from './category.entity';
import { CategoryService } from './category.service';
import {
  CategoryFilterInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './category.input';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ProgramsService } from 'src/programs/programs.service';
import { BaseResolver } from 'src/common/base/base.resolver';
import {
  toCategoryEntity,
  toCategoryEntityArray,
} from 'src/common/mappers/category.mapper';

@Resolver(() => CategoryEntity)
export class CategoryResolver extends BaseResolver {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly programsService: ProgramsService,
  ) {
    super();
  }

  @ResolveField(() => Number, { nullable: true })
  async programsCount(
    @Parent() category: CategoryEntity | null,
  ): Promise<number | null> {
    if (!category?.id) {
      return null;
    }

    try {
      return await this.programsService.countByCategory(category.id);
    } catch {
      return null;
    }
  }

  @Query(() => [CategoryEntity])
  async categories(
    @Args('filter', { nullable: true, type: () => CategoryFilterInput })
    filter?: CategoryFilterInput,
  ): Promise<CategoryEntity[]> {
    const categories = await this.categoryService.findWithFilters(filter);
    return toCategoryEntityArray(categories);
  }

  @Query(() => CategoryEntity, { nullable: true })
  async category(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CategoryEntity | null> {
    try {
      const category = await this.categoryService.findOne(id);
      return toCategoryEntity(category);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => CategoryEntity)
  async createCategory(
    @Args('input') input: CreateCategoryInput,
  ): Promise<CategoryEntity> {
    const category = await this.categoryService.create(input);
    return toCategoryEntity(category)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => CategoryEntity)
  async updateCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCategoryInput,
  ): Promise<CategoryEntity> {
    const category = await this.categoryService.update(id, input);
    return toCategoryEntity(category)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => CategoryEntity)
  async deleteCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CategoryEntity> {
    const category = await this.categoryService.remove(id);
    return toCategoryEntity(category)!;
  }
}
