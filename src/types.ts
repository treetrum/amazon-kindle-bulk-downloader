export enum DuplicateHandling {
  skip = "skip",
  overwrite = "overwrite",
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
};
