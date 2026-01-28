export class PageMetaDto {
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;

  constructor(totalCount: number, page: number, limit: number) {
    this.totalCount = totalCount;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(totalCount / limit);
  }
}
