import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import { UserRole } from 'src/user/schemas/user.schema';
import { EducationDocumentEntity } from './education-document.entity';
import { EducationDocumentService } from './education-document.service';
import {
  CreateEducationDocumentInput,
  UpdateEducationDocumentInput,
} from './education-document.input';
import {
  toEducationDocumentEntity,
  toEducationDocumentEntityArray,
} from 'src/common/mappers/education-document.mapper';

@Resolver(() => EducationDocumentEntity)
export class EducationDocumentResolver {
  constructor(
    private readonly educationDocumentService: EducationDocumentService,
  ) {}

  private assertAdmin(user: CurrentUserPayload) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
  }

  @Query(() => [EducationDocumentEntity])
  async educationDocuments(): Promise<EducationDocumentEntity[]> {
    const docs = await this.educationDocumentService.findAll();
    return toEducationDocumentEntityArray(docs);
  }

  @Query(() => EducationDocumentEntity, { nullable: true })
  async educationDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EducationDocumentEntity | null> {
    try {
      const doc = await this.educationDocumentService.findOne(id);
      return toEducationDocumentEntity(doc);
    } catch {
      return null;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => EducationDocumentEntity)
  async createEducationDocument(
    @Args('input') input: CreateEducationDocumentInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<EducationDocumentEntity> {
    this.assertAdmin(user);
    const doc = await this.educationDocumentService.create(input);
    return toEducationDocumentEntity(doc)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => EducationDocumentEntity)
  async updateEducationDocument(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEducationDocumentInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<EducationDocumentEntity> {
    this.assertAdmin(user);
    const doc = await this.educationDocumentService.update(id, input);
    return toEducationDocumentEntity(doc)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => EducationDocumentEntity)
  async deleteEducationDocument(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<EducationDocumentEntity> {
    this.assertAdmin(user);
    const doc = await this.educationDocumentService.remove(id);
    return toEducationDocumentEntity(doc)!;
  }
}
