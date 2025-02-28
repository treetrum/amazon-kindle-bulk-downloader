export enum DuplicateHandling {
  skip = "skip",
  overwrite = "overwrite",
}

export enum SortBy {
  author = "author",
  date = "date",
  title = "title",
}

export enum SortOrder {
  asc = "asc",
  desc = "desc",
}

export type Options = {
  baseUrl: string;
  totalDownloads: number;
  maxConcurrency: number;
  startFromOffset: number;
  manualAuth: boolean;
  duplicateHandling: DuplicateHandling;
  searchPhrase?: string;
  downloadsDir?: string;
  searchPhraseDirs: boolean;
  skipBooksMatching?: (string | number)[];
  sortBy?: SortBy;
  sortOrder?: SortOrder;
};
