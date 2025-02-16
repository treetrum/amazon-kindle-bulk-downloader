import logUpdate from "log-update";

const createProgressBarString = (
  progress: number,
  barLength: number = 30
): string => {
  const completedLength = Math.floor(progress * barLength);
  const remainingLength = barLength - completedLength;
  return `${"█".repeat(completedLength)}${"░".repeat(remainingLength)}`;
};

export class ProgressBars {
  items: ProgressBar[] = [];

  render() {
    logUpdate(this.items.map(this.renderProgressBar).join("\n"));
  }

  complete() {
    logUpdate.done();
  }

  create(content: string) {
    const item = new ProgressBar(this, content);
    this.items.push(item);
    return item;
  }

  renderProgressBar(bar: ProgressBar) {
    const pct = bar.progress / bar.total;
    const progressStr = `${bar.progress}/${bar.total}`;
    return `${createProgressBarString(pct)} | ${bar.content} | ${progressStr}`;
  }
}

class ProgressBar {
  log: ProgressBars;
  content: string;
  total: number = 1;
  progress: number = 0;

  constructor(log: ProgressBars, text: string) {
    this.log = log;
    this.content = text;
  }

  update(total: number, progress: number) {
    this.total = total;
    this.progress = progress;
    this.log.render();
  }
}
