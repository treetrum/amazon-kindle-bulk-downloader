import { describe, test, expect } from "bun:test";
import path from "path";
import { DuplicateHandling, type Options } from "./types";
import { getDownloadsDir } from "./utils";

const allOptions: Options = {
  baseUrl: "https://example.com",
  totalDownloads: 10,
  maxConcurrency: 5,
  startFromOffset: 0,
  manualAuth: false,
  duplicateHandling: DuplicateHandling.skip,
  searchPhraseDirs: false,
};

describe("getDownloadsDir", () => {
  test("Returns the default downloads directory when no downloadsDir is provided", () => {
    const options: Options = { ...allOptions, downloadsDir: undefined };
    const expectedDir = path.join(__dirname, "../downloads");
    expect(getDownloadsDir(options)).toBe(expectedDir);
  });

  test("Returns the specified downloads directory when provided", () => {
    const dir = getDownloadsDir({
      ...allOptions,
      downloadsDir: "/custom/downloads",
    });
    expect(dir).toBe("/custom/downloads");
  });

  test("Appends the search phrase to the downloads directory when searchPhraseDirs is true", () => {
    const dir = getDownloadsDir({
      ...allOptions,
      searchPhraseDirs: true,
      searchPhrase: "test-phrase",
    });
    expect(dir).toBe(path.join(__dirname, "../downloads/test-phrase"));
  });

  test("Appends the search phrase to the specified directory when searchPhraseDirs is true", () => {
    const dir = getDownloadsDir({
      ...allOptions,
      downloadsDir: "/custom/downloads",
      searchPhraseDirs: true,
      searchPhrase: "test-phrase",
    });
    expect(dir).toBe("/custom/downloads/test-phrase");
  });

  test("Does not append the search phrase to the downloads directory when searchPhraseDirs is false", () => {
    const dir = getDownloadsDir({
      ...allOptions,
      searchPhraseDirs: false,
      searchPhrase: "test-phrase",
    });
    expect(dir).toBe(path.join(__dirname, "../downloads"));
  });

  test("Returns default download dir to true and leaving searchPhrase undefined", () => {
    const dir = getDownloadsDir({
      ...allOptions,
      searchPhraseDirs: true,
      searchPhrase: undefined,
    });
    expect(dir).toBe(path.join(__dirname, "../downloads"));
  });

  test("Returns specified download dir to true and leaving searchPhrase undefined", () => {
    const dir = getDownloadsDir({
      ...allOptions,
      downloadsDir: "/custom/downloads",
      searchPhraseDirs: true,
      searchPhrase: undefined,
    });
    expect(dir).toBe("/custom/downloads");
  });
});
