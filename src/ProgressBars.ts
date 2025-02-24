import logUpdate from "log-update";

export const createProgressBarString = (
  progress: number,
  barLength: number = 20,
  completedCharacter: string = "█",
  remainingCharacter: string = "░"
): string => {
  // Ensure progress is between 0 and 1
  const normalizedProgress = Math.max(0, Math.min(1, progress));

  // Calculate lengths with validation
  const completedLength = Math.max(
    0,
    Math.floor(normalizedProgress * barLength)
  );
  const remainingLength = Math.max(0, barLength - completedLength);

  // Create the progress bar string with validated lengths
  return `${completedCharacter.repeat(completedLength)}${remainingCharacter.repeat(remainingLength)}`;
};

export class ProgressBars {
  items: ProgressBar[] = [];

  render() {
    logUpdate(this.items.map((b) => b.createString()).join("\n"));
  }

  complete() {
    logUpdate.done();
  }

  create(content: string) {
    const item = new ProgressBar(this, content);
    this.items.push(item);
    this.render();
    return item;
  }
}

class ProgressBar {
  private log: ProgressBars;
  private content: string = "";
  private _total: number = 1;
  private _progress: number = 0;

  constructor(log: ProgressBars, text: string) {
    this.log = log;
    this.content = text;
  }

  setContent(content: string) {
    this.content = content;
    this.log.render();
  }

  set total(total: number) {
    this._total = Math.max(1, total);
  }

  get total() {
    return this._total;
  }

  set progress(progress: number) {
    this._progress = Math.max(0, Math.min(this.total, progress));
  }

  get progress() {
    return this._progress;
  }

  update(total: number, progress: number) {
    this.total = total;
    this.progress = progress;
    this.log.render();
  }

  createString() {
    const pct = this.progress / this.total;
    const progressStr = `${this.progress}/${this.total}`;
    return `${createProgressBarString(pct)} | ${this.content} | ${progressStr}`;
  }
}
