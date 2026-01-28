import { extractId } from '../mappers/base.mapper';

export abstract class BaseResolver {
  protected getId(entity: { id?: unknown; _id?: unknown }): string {
    return extractId(entity);
  }
}
