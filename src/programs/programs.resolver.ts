import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ProgramsService } from './programs.service';
import { ProgramEntity } from './program.entity';
import {
  CreateProgramInput,
  ProgramFilterInput,
  UpdateProgramInput,
} from './program.input';
import {
  CurrentUserPayload,
  OptionalUser,
} from 'src/common/decorators/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { toProgramEntity } from 'src/common/mappers/program.mapper';

@Resolver(() => ProgramEntity)
export class ProgramsResolver {
  constructor(private readonly programsService: ProgramsService) {}

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
  ): Promise<ProgramEntity> {
    const program = await this.programsService.create(input);
    return toProgramEntity(program)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProgramEntity)
  async updateProgram(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateProgramInput,
  ): Promise<ProgramEntity> {
    const program = await this.programsService.update(id, input);
    return toProgramEntity(program)!;
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProgramEntity)
  async deleteProgram(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ProgramEntity> {
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
