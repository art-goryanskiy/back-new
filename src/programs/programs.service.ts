import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Program, type ProgramDocument } from './program.schema';
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
  normalizeProgramFilter,
  applySort,
  applyPagination,
} from './programs.query';
import {
  type ProgramPlain,
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

    // awardedRankFrom/To (разряд с/по — необязателен, может быть один или диапазон)
    if (category.type === CategoryType.PROFESSIONAL_EDUCATION) {
      const range = validateAwardedRankRange(
        createProgramInput.awardedRankFrom,
        createProgramInput.awardedRankTo,
      );
      createProgramInput.awardedRankFrom = range?.from;
      createProgramInput.awardedRankTo = range?.to;
    } else {
      if (
        createProgramInput.awardedRankFrom != null ||
        createProgramInput.awardedRankTo != null
      ) {
        throw new BadRequestException(
          'Разряд (с/по) разрешён только для программ профессионального обучения',
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

    await Promise.all([
      this.cacheService.del(this.CACHE_KEYS.ALL),
      invalidateProgramsFilters(this.cacheService),
    ]);

    return program;
  }

  async findAll(): Promise<ProgramDocument[]> {
    const cached = await this.cacheService.get<ProgramPlain[]>(
      this.CACHE_KEYS.ALL,
    );
    if (cached) {
      return cached.map((item) =>
        this.programModel.hydrate(item),
      ) as ProgramDocument[];
    }

    const programs = await this.programModel.find().lean<ProgramPlain[]>();
    await this.cacheService.set(this.CACHE_KEYS.ALL, programs);

    return programs.map((p) => this.programModel.hydrate(p)) as ProgramDocument[];
  }

  async findOne(id: string): Promise<ProgramDocument> {
    const cached = await this.cacheService.get<ProgramPlain>(
      this.CACHE_KEYS.BY_ID(id),
    );
    if (cached) {
      return this.programModel.hydrate(cached) as ProgramDocument;
    }

    const plain = await this.programModel.findById(id).lean<ProgramPlain>();
    if (!plain) throw new NotFoundException('Program not found');

    await this.cacheService.set(this.CACHE_KEYS.BY_ID(id), plain);

    return this.programModel.hydrate(plain) as ProgramDocument;
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

    // awardedRankFrom/To (разряд с/по — необязателен, может быть один или диапазон)
    if (category.type === CategoryType.PROFESSIONAL_EDUCATION) {
      const candidateFrom =
        updateProgramInput.awardedRankFrom !== undefined
          ? updateProgramInput.awardedRankFrom
          : program.awardedRankFrom;

      const candidateTo =
        updateProgramInput.awardedRankTo !== undefined
          ? updateProgramInput.awardedRankTo
          : program.awardedRankTo;

      const range = validateAwardedRankRange(candidateFrom, candidateTo);
      program.awardedRankFrom = range?.from;
      program.awardedRankTo = range?.to;
    } else {
      if (
        updateProgramInput.awardedRankFrom != null ||
        updateProgramInput.awardedRankTo != null
      ) {
        throw new BadRequestException(
          'Разряд (с/по) разрешён только для программ профессионального обучения',
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

    await Promise.all([
      this.cacheService.del(this.CACHE_KEYS.BY_ID(id)),
      this.cacheService.del(this.CACHE_KEYS.ALL),
      invalidateProgramsFilters(this.cacheService),
    ]);

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

    await Promise.all([
      this.cacheService.del(this.CACHE_KEYS.BY_ID(id)),
      this.cacheService.del(this.CACHE_KEYS.ALL),
      invalidateProgramsFilters(this.cacheService),
    ]);

    return program;
  }

  async findWithFilters(
    filterInput?: ProgramFilterInput,
  ): Promise<ProgramDocument[]> {
    const normalized = normalizeProgramFilter(filterInput);
    const { search, category, categoryIds, sortBy, sortOrder, limit, offset } =
      normalized;

    const cacheKey = buildProgramsFilterCacheKey({
      search: search || undefined,
      category: categoryIds?.length ? undefined : (category ?? undefined),
      categoryIds: categoryIds?.length ? categoryIds : undefined,
      sortBy,
      sortOrder,
      limit: limit ?? undefined,
      offset: offset ?? undefined,
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
    q = applyPagination(q, limit, offset);

    const result = await q.exec();
    await setProgramsFilterCache(this.cacheService, cacheKey, result, 60);

    return result;
  }

  async countWithFilters(filterInput?: ProgramFilterInput): Promise<number> {
    const normalized = normalizeProgramFilter(filterInput);
    const cacheKey =
      buildProgramsFilterCacheKey({
        search: normalized.search || undefined,
        category: normalized.categoryIds?.length
          ? undefined
          : (normalized.category ?? undefined),
        categoryIds: normalized.categoryIds?.length
          ? normalized.categoryIds
          : undefined,
      }) + ':count';

    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    const query = buildProgramsQuery({
      search: normalized.search,
      category: normalized.category,
      categoryIds: normalized.categoryIds,
    });
    const count = await this.programModel.countDocuments(query);
    await this.cacheService.set(cacheKey, count, 60);
    return count;
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

    // Инвалидируем только кэш конкретной программы — счётчик просмотров
    // не влияет на результаты фильтрации, поэтому сбрасывать program:filter:* не нужно
    await Promise.all([
      this.cacheService.del(this.CACHE_KEYS.BY_ID(id)),
      this.cacheService.del(this.CACHE_KEYS.ALL),
    ]);

    return program;
  }

  async countByCategory(categoryId: string): Promise<number> {
    return this.programModel.countDocuments({
      category: new Types.ObjectId(categoryId),
    });
  }
}
