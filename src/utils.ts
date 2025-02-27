import path from "path";
import type { Options } from "./types";

export enum Colors {
  red = "\x1b[31m",
  green = "\x1b[32m",
  yellow = "\x1b[33m",
  blue = "\x1b[34m",
  reset = "\x1b[0m",
}

export const getDownloadsDir = (options: Options) => {
  // Use the passed in downloadsDir option, or default to the "downloads" folder in the project root
  let downloadsDir: string =
    options.downloadsDir ?? path.join(__dirname, "../downloads");

  // If the "searchPhraseDirs" CLI option is true - add the "searchPhrase" CLI option value to the downloadsDir
  if (options.searchPhraseDirs && options.searchPhrase) {
    downloadsDir = path.join(downloadsDir, options.searchPhrase);
  }

  return downloadsDir;
};

const getSortOrderString = (order: SortOrder): string => {
  switch (order) {
    case SortOrder.asc:
      return "ASCENDING";
    case SortOrder.desc:
      return "DESCENDING";
    default:
      return "DESCENDING";
  }
};
