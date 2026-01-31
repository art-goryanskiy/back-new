import { Args, ID, Mutation, Parent, Query, Resolver, ResolveField } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { ProgramEntity, ProgramsPageEntity } from './program.entity';
import {
  CreateProgramInput,
  ProgramFilterInput,
  UpdateProgramInput,
} from './program.input';
import {
  CurrentUser,
  CurrentUserPayload,
  OptionalUser,
} from 'src/common/decorators/current-user.decorator';
import { UserRole } from 'src/user/schemas/user.schema';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { toProgramEntity } from 'src/common/mappers/program.mapper';
import { EducationDocumentEntity } from 'src/education-document/education-document.entity';
import { EducationDocumentService } from 'src/education-document/education-document.service';
import { toEducationDocumentEntity } from 'src/common/mappers/education-document.mapper';

@Resolver(() => ProgramEntity)
export class ProgramsResolver {
  constructor(
    private readonly programsService: ProgramsService,
    private readonly educationDocumentService: EducationDocumentService,
  ) {}

  private assertAdmin(user: CurrentUserPayload) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
  }

  @ResolveField(() => EducationDocumentEntity, { nullable: true })
  async educationDocument(
    @Parent() program: ProgramEntity,
  ): Promise<EducationDocumentEntity | null> {
    const id = program.educationDocumentId;
    if (!id) return null;
    const doc = await this.educationDocumentService.findById(id);
    return toEducationDocumentEntity(doc);
  }

  private hidePriceIfUnauthorized(
    program: ProgramEntity,
    isAuthorized: boolean,
  ): ProgramEntity {
    if (isAuthorized) return program;

    return {
      ...program,
      pricing: program.pricing.map((item) => ({
        hours: item.hours,
        price: undefined,
      })),
    };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Query(() => [ProgramEntity])
  async programs(
    @Args('filter', { nullable: true, type: () => ProgramFilterInput })
    filter?: ProgramFilterInput,
    @OptionalUser() user?: CurrentUserPayload | null,
  ): Promise<ProgramEntity[]> {
    const programs = await this.programsService.findWithFilters(filter);
    const isAuthorized = !!user;

    return programs
      .map(toProgramEntity)
      .filter((p): p is ProgramEntity => p !== null)
      .map((p) => this.hidePriceIfUnauthorized(p, isAuthorized));
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Query(() => ProgramsPageEntity)
  async programsPage(
    @Args('filter', { nullable: true, type: () => ProgramFilterInput })
    filter?: ProgramFilterInput,
    @OptionalUser() user?: CurrentUserPayload | null,
  ): Promise<ProgramsPageEntity> {
    const { items, total } = await this.programsService.findPage(filter);
    const isAuthorized = !!user;

    return {
      total,
      items: items
        .map(toProgramEntity)
        .filter((p): p is ProgramEntity => p !== null)
        .map((p) => this.hidePriceIfUnauthorized(p, isAuthorized)),
    };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Query(() => ProgramEntity)
  async program(
    @Args('id', { type: () => ID }) id: string,
    @OptionalUser() user?: CurrentUserPayload | null,
  ): Promise<ProgramEntity> {
    const program = await this.programsService.incrementViews(id);
    const isAuthorized = !!user;

    const entity = toProgramEntity(program);
    if (!entity) throw new Error('Program not found');

    return this.hidePriceIfUnauthorized(entity, isAuthorized);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProgramEntity)
  async createProgram(
    @Args('input') input: CreateProgramInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProgramEntity> {
    this.assertAdmin(user);
    const program = await this.programsService.create(input);
    return toProgramEntity(program)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProgramEntity)
  async updateProgram(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateProgramInput,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProgramEntity> {
    this.assertAdmin(user);
    const program = await this.programsService.update(id, input);
    return toProgramEntity(program)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProgramEntity)
  async deleteProgram(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProgramEntity> {
    this.assertAdmin(user);
    const program = await this.programsService.remove(id);
    return toProgramEntity(program)!;
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Query(() => [ProgramEntity], { name: 'topPrograms' })
  async topPrograms(
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 10 })
    limit: number,
    @OptionalUser() user?: CurrentUserPayload | null,
  ): Promise<ProgramEntity[]> {
    const programs = await this.programsService.findWithFilters({
      sortBy: 'views',
      sortOrder: 'desc',
      limit,
    });

    const isAuthorized = !!user;
    return programs
      .map(toProgramEntity)
      .filter((p): p is ProgramEntity => p !== null)
      .map((p) => this.hidePriceIfUnauthorized(p, isAuthorized));
  }
}
