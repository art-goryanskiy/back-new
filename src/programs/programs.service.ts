import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Program,
  type ProgramDocument,
  ProgramPricing,
  ProgramSubProgram,
} from './program.schema';
import { CacheService } from 'src/cache/cache.service';
import {
  CreateProgramInput,
  ProgramFilterInput,
  UpdateProgramInput,
} from './program.input';
import { CategoryService } from 'src/category/category.service';
import { CategoryType } from 'src/category/category.schema';
import { EducationDocumentService } from 'src/education-document/education-document.service';
import slugify from 'slugify';
import { FileCleanupService } from 'src/common/services/file-cleanup.service';

import { PROGRAM_SELECT } from './programs.select';
import {
  validatePricing,
  normalizeAwardedQualification,
  validateAwardedRankRange,
  normalizeSubPrograms,
  normalizeShortTitle,
  buildShortTitleFromTitle,
} from './programs.validation';
import {
  buildProgramsQuery,
  computeSort,
  applySort,
  applyPagination,
} from './programs.query';
import {
  buildProgramsFilterCacheKey,
  getProgramsFilterCached,
  setProgramsFilterCache,
  invalidateProgramsFilters,
} from './programs.cache';

@Injectable()
export class ProgramsService {
  private readonly CACHE_KEYS = {
    ALL: 'program:all',
    BY_ID: (id: string) => `program:${id}`,
  };

  constructor(
    @InjectModel(Program.name)
    private programModel: Model<ProgramDocument>,
    private cacheService: CacheService,
    private categoryService: CategoryService,
    private educationDocumentService: EducationDocumentService,
    private fileCleanupService: FileCleanupService,
  ) {}

  async create(
    createProgramInput: CreateProgramInput,
  ): Promise<ProgramDocument> {
    const existingProgram = await this.programModel
      .findOne({ title: createProgramInput.title })
      .select('_id')
      .lean();

    if (existingProgram) {
      throw new ConflictException('Program with this title already exists');
    }

    const category = await this.categoryService.findOne(
      createProgramInput.category,
    );

    validatePricing(createProgramInput.pricing);

    // awardedQualification
    if (category.type === CategoryType.PROFESSIONAL_RETRAINING) {
      const aq = normalizeAwardedQualification(
        createProgramInput.awardedQualification,
      );
      if (!aq) {
        throw new BadRequestException(
          'Awarded qualification is required for professional retraining programs',
        );
      }
      createProgramInput.awardedQualification = aq;
    } else {
      if (createProgramInput.awardedQualification != null) {
        throw new BadRequestException(
          'Awarded qualification is allowed only for professional retraining programs',
        );
      }
      createProgramInput.awardedQualification = undefined;
    }

    // awardedRankFrom/To
    if (category.type === CategoryType.PROFESSIONAL_EDUCATION) {
      const { from, to } = validateAwardedRankRange(
        createProgramInput.awardedRankFrom,
        createProgramInput.awardedRankTo,
      );
      createProgramInput.awardedRankFrom = from;
      createProgramInput.awardedRankTo = to;
    } else {
      if (
        createProgramInput.awardedRankFrom != null ||
        createProgramInput.awardedRankTo != null
      ) {
        throw new BadRequestException(
          'Awarded rank range is allowed only for professional education programs',
        );
      }
      createProgramInput.awardedRankFrom = undefined;
      createProgramInput.awardedRankTo = undefined;
    }

    const slug = slugify(createProgramInput.title, {
      lower: true,
      strict: true,
      locale: 'ru',
    });

    const subPrograms =
      normalizeSubPrograms(createProgramInput.subPrograms) ?? [];

    const shortTitle =
      normalizeShortTitle(createProgramInput.shortTitle) ??
      buildShortTitleFromTitle(createProgramInput.title);

    let educationDocumentId: Types.ObjectId | undefined;
    if (createProgramInput.educationDocumentId) {
      const ed = await this.educationDocumentService.findById(
        createProgramInput.educationDocumentId,
      );
      if (!ed) {
        throw new NotFoundException('Education document not found');
      }
      educationDocumentId = new Types.ObjectId(
        createProgramInput.educationDocumentId,
      );
    }

    const program = await this.programModel.create({
      ...createProgramInput,
      shortTitle,
      subPrograms,
      slug,
      category: new Types.ObjectId(createProgramInput.category),
      educationDocument: educationDocumentId,
      pricing: createProgramInput.pricing || [],
    });

    await this.cacheService.del(this.CACHE_KEYS.ALL);
    await invalidateProgramsFilters(this.cacheService);

    return program;
  }

  async findAll(): Promise<ProgramDocument[]> {
    type ProgramPlain = Program & {
      _id: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
      shortTitle?: string;
      category: Types.ObjectId | string;
      pricing?: ProgramPricing[];
      subPrograms?: ProgramSubProgram[];
    };

    const cached = await this.cacheService.get<ProgramPlain[]>(
      this.CACHE_KEYS.ALL,
    );
    if (cached) {
      return cached.map((item) =>
        this.programModel.hydrate(item),
      ) as ProgramDocument[];
    }

    const programs = await this.programModel.find();
    await this.cacheService.set(
      this.CACHE_KEYS.ALL,
      programs.map((p) => p.toObject()),
    );

    return programs;
  }

  async findOne(id: string): Promise<ProgramDocument> {
    type ProgramPlain = Program & {
      _id: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
      shortTitle?: string;
      category: Types.ObjectId | string;
      pricing?: ProgramPricing[];
      subPrograms?: ProgramSubProgram[];
    };

    const cached = await this.cacheService.get<ProgramPlain>(
      this.CACHE_KEYS.BY_ID(id),
    );
    if (cached) {
      return this.programModel.hydrate(cached) as ProgramDocument;
    }

    const program = await this.programModel.findById(id);
    if (!program) throw new NotFoundException('Program not found');

    await this.cacheService.set(this.CACHE_KEYS.BY_ID(id), program.toObject());

    return program;
  }

  async update(
    id: string,
    updateProgramInput: UpdateProgramInput,
  ): Promise<ProgramDocument> {
    const program = await this.programModel.findById(id);
    if (!program) throw new NotFoundException('Program not found');

    const oldImageUrl = program.image;

    const categoryId =
      updateProgramInput.category || program.category.toString();
    const category = await this.categoryService.findOne(categoryId);

    // awardedQualification
    if (category.type === CategoryType.PROFESSIONAL_RETRAINING) {
      const candidate =
        updateProgramInput.awardedQualification !== undefined
          ? updateProgramInput.awardedQualification
          : program.awardedQualification;

      const aq = normalizeAwardedQualification(candidate);
      if (!aq) {
        throw new BadRequestException(
          'Awarded qualification is required for professional retraining programs',
        );
      }
      program.awardedQualification = aq;
    } else {
      if (updateProgramInput.awardedQualification != null) {
        throw new BadRequestException(
          'Awarded qualification is allowed only for professional retraining programs',
        );
      }
      program.awardedQualification = undefined;
    }

    // awardedRankFrom/To
    if (category.type === CategoryType.PROFESSIONAL_EDUCATION) {
      const candidateFrom =
        updateProgramInput.awardedRankFrom !== undefined
          ? updateProgramInput.awardedRankFrom
          : program.awardedRankFrom;

      const candidateTo =
        updateProgramInput.awardedRankTo !== undefined
          ? updateProgramInput.awardedRankTo
          : program.awardedRankTo;

      const { from, to } = validateAwardedRankRange(candidateFrom, candidateTo);
      program.awardedRankFrom = from;
      program.awardedRankTo = to;
    } else {
      if (
        updateProgramInput.awardedRankFrom != null ||
        updateProgramInput.awardedRankTo != null
      ) {
        throw new BadRequestException(
          'Awarded rank range is allowed only for professional education programs',
        );
      }
      program.awardedRankFrom = undefined;
      program.awardedRankTo = undefined;
    }

    if (updateProgramInput.pricing !== undefined) {
      validatePricing(updateProgramInput.pricing);
      program.pricing = updateProgramInput.pricing;
    }

    if (
      updateProgramInput.title &&
      updateProgramInput.title !== program.title
    ) {
      const exists = await this.programModel
        .findOne({
          title: updateProgramInput.title,
          _id: { $ne: new Types.ObjectId(id) },
        })
        .select('_id')
        .lean();

      if (exists) {
        throw new ConflictException('Program with this title already exists');
      }

      program.title = updateProgramInput.title;
      program.slug = slugify(updateProgramInput.title, {
        lower: true,
        strict: true,
        locale: 'ru',
      });
    }

    if (updateProgramInput.category) {
      await this.categoryService.findOne(updateProgramInput.category);
      program.category = new Types.ObjectId(updateProgramInput.category);
    }

    if (updateProgramInput.educationDocumentId !== undefined) {
      if (updateProgramInput.educationDocumentId) {
        const ed = await this.educationDocumentService.findById(
          updateProgramInput.educationDocumentId,
        );
        if (!ed) {
          throw new NotFoundException('Education document not found');
        }
        program.educationDocument = new Types.ObjectId(
          updateProgramInput.educationDocumentId,
        );
      } else {
        program.educationDocument = undefined;
      }
    }

    if (updateProgramInput.description !== undefined) {
      program.description = updateProgramInput.description;
    }

    if (updateProgramInput.baseHours !== undefined) {
      program.baseHours = updateProgramInput.baseHours;
    }

    if (updateProgramInput.image !== undefined) {
      if (oldImageUrl && oldImageUrl !== updateProgramInput.image) {
        await this.fileCleanupService.safeDeleteFile(
          oldImageUrl,
          'program old image',
        );
      }
      program.image = updateProgramInput.image;
    }

    if (updateProgramInput.shortTitle !== undefined) {
      program.shortTitle = normalizeShortTitle(updateProgramInput.shortTitle);
    }

    // If title is updated and shortTitle is not set, keep existing shortTitle.
    // If you want auto-sync, pass shortTitle explicitly.

    if (updateProgramInput.studentCategory !== undefined) {
      program.studentCategory = updateProgramInput.studentCategory;
    }

    if (updateProgramInput.subPrograms !== undefined) {
      program.subPrograms =
        normalizeSubPrograms(updateProgramInput.subPrograms) ?? [];
    }

    const updatedProgram = await program.save();

    await this.cacheService.del(this.CACHE_KEYS.BY_ID(id));
    await this.cacheService.del(this.CACHE_KEYS.ALL);
    await invalidateProgramsFilters(this.cacheService);

    return updatedProgram;
  }

  async remove(id: string): Promise<ProgramDocument> {
    const program = await this.programModel.findById(id);
    if (!program) throw new NotFoundException('Program not found');

    if (program.image) {
      await this.fileCleanupService.safeDeleteFile(
        program.image,
        'program image',
      );
    }

    await this.programModel.findByIdAndDelete(id);

    await this.cacheService.del(this.CACHE_KEYS.BY_ID(id));
    await this.cacheService.del(this.CACHE_KEYS.ALL);
    await invalidateProgramsFilters(this.cacheService);

    return program;
  }

  async findWithFilters(
    filterInput?: ProgramFilterInput,
  ): Promise<ProgramDocument[]> {
    const search =
      typeof filterInput?.search === 'string' ? filterInput.search.trim() : '';

    const category = filterInput?.category;

    const categoryIds = Array.isArray(filterInput?.categoryIds)
      ? filterInput?.categoryIds
          .filter(
            (v): v is string => typeof v === 'string' && v.trim().length > 0,
          )
          .map((v) => v.trim())
          .sort()
      : undefined;

    const { sortBy, sortOrder } = computeSort(
      filterInput?.sortBy,
      filterInput?.sortOrder,
    );

    const cacheKey = buildProgramsFilterCacheKey({
      search: search || undefined,
      category: categoryIds?.length ? undefined : (category ?? undefined),
      categoryIds: categoryIds?.length ? categoryIds : undefined,
      sortBy,
      sortOrder,
      limit: filterInput?.limit ?? undefined,
      offset: filterInput?.offset ?? undefined,
    });

    const cached = await getProgramsFilterCached(
      this.cacheService,
      this.programModel,
      cacheKey,
    );
    if (cached) return cached;

    const query = buildProgramsQuery({ search, category, categoryIds });

    let q = this.programModel.find(query).select(PROGRAM_SELECT);
    q = applySort(q, sortBy, sortOrder);
    q = applyPagination(q, filterInput?.limit, filterInput?.offset);

    const result = await q.exec();
    await setProgramsFilterCache(this.cacheService, cacheKey, result, 60);

    return result;
  }

  async countWithFilters(filterInput?: ProgramFilterInput): Promise<number> {
    const search =
      typeof filterInput?.search === 'string' ? filterInput.search.trim() : '';

    const category = filterInput?.category;

    const categoryIds = Array.isArray(filterInput?.categoryIds)
      ? filterInput?.categoryIds
          .filter(
            (v): v is string => typeof v === 'string' && v.trim().length > 0,
          )
          .map((v) => v.trim())
          .sort()
      : undefined;

    const query = buildProgramsQuery({ search, category, categoryIds });
    return this.programModel.countDocuments(query);
  }

  async findPage(
    filterInput?: ProgramFilterInput,
  ): Promise<{ items: ProgramDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.findWithFilters(filterInput),
      this.countWithFilters(filterInput),
    ] as const);

    return { items, total };
  }

  async incrementViews(id: string): Promise<ProgramDocument> {
    const program = await this.programModel.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true },
    );

    if (!program) throw new NotFoundException('Program not found');

    await this.cacheService.del(this.CACHE_KEYS.BY_ID(id));
    await this.cacheService.del(this.CACHE_KEYS.ALL);
    await invalidateProgramsFilters(this.cacheService);

    return program;
  }

  async countByCategory(categoryId: string): Promise<number> {
    return this.programModel.countDocuments({
      category: new Types.ObjectId(categoryId),
    });
  }
}
