export enum DuplicateHandling {
  skip = "skip",
  overwrite = "overwrite",
}

//@@WEB - 2025-02-26 - START    
//  Added SortBy and SortOrder for use with the Command Line options
export enum SortBy {
  author = "author",
  date = "date",
  title = "title"
}

export enum SortOrder {
  asc = "asc",
  desc = "desc"
}
//@@WEB - 2025-02-26 - END

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
//@@WEB - 2025-02-26 - START      
//  Added SortBy and SortOrder for use with the Command Line options
  sortBy?: SortBy;
  sortOrder?: SortOrder;
//@@WEB - 2025-02-26 - END
};
