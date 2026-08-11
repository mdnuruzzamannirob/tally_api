export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function getPagination({
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE,
}: PaginationInput = {}): Pagination {
  if (!Number.isInteger(page) || page < 1) throw new RangeError("page must be a positive integer.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
