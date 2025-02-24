import { expect, test, describe, beforeEach, mock } from "bun:test";
import logUpdate from "log-update";
import { createProgressBarString, ProgressBars } from "./ProgressBars";

mock.module("log-update", () => ({ default: mock() }));

describe("ProgressBars", () => {
  beforeEach(() => {
    mock(logUpdate).mockClear();
  });

  test("Creates a new ProgressBar", () => {
    const log = new ProgressBars();
    const bar = log.create("Test");

    expect(log.items).toContain(bar);
  });

  test("Renders a single progress bar", () => {
    const log = new ProgressBars();
    const bar = log.create("Test");

    bar.update(10, 5);
    expect(bar.total).toBe(10);
    expect(bar.progress).toBe(5);
    expect(logUpdate).toBeCalledWith("██████████░░░░░░░░░░ | Test | 5/10");
  });

  test("Renders multiple progress bars", () => {
    const log = new ProgressBars();
    const bar1 = log.create("First Bar");
    const bar2 = log.create("Second Bar");

    bar1.update(10, 5);
    bar2.update(20, 14);

    expect(logUpdate).toHaveBeenLastCalledWith(
      [
        "██████████░░░░░░░░░░ | First Bar | 5/10",
        "██████████████░░░░░░ | Second Bar | 14/20",
      ].join("\n")
    );
  });

  test("Clamps to a min of zero progress", () => {
    const log = new ProgressBars();
    const bar = log.create("Test");

    bar.update(10, -5);
    expect(bar.total).toBe(10);
    expect(bar.progress).toBe(0);
    expect(logUpdate).toBeCalledWith("░░░░░░░░░░░░░░░░░░░░ | Test | 0/10");
  });

  test("Clamps to a max of total progress", () => {
    const log = new ProgressBars();
    const bar = log.create("Test");

    bar.update(10, 15);

    expect(bar.total).toBe(10);
    expect(bar.progress).toBe(10);
    expect(logUpdate).toBeCalledWith("████████████████████ | Test | 10/10");
  });
});

describe("createProgressBarString", () => {
  test("Works with valid progress", () => {
    const barString = createProgressBarString(0.5, 10, "=", "-");
    expect(barString).toBe("=====-----");
  });
  test("Clamps progress to a minimum of 0", () => {
    const barString = createProgressBarString(-1, 10, "=", "-");
    expect(barString).toBe("----------");
  });
  test("Clamps progress to a max of 1", () => {
    const barString = createProgressBarString(2, 10, "=", "-");
    expect(barString).toBe("==========");
  });
});
