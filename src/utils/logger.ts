/**
 * Color-coded terminal logger for codeweave.
 * Security: never logs file content, only metadata.
 */

let verboseMode = false;

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

export const logger = {
  setVerbose(enabled: boolean): void {
    verboseMode = enabled;
  },

  isVerbose(): boolean {
    return verboseMode;
  },

  info(message: string): void {
    process.stdout.write(`${BLUE}${BOLD}info${RESET}  ${message}\n`);
  },

  success(message: string): void {
    process.stdout.write(`${GREEN}${BOLD}ok${RESET}    ${message}\n`);
  },

  warn(message: string): void {
    process.stdout.write(`${YELLOW}${BOLD}warn${RESET}  ${message}\n`);
  },

  error(message: string, err?: unknown): void {
    const detail =
      err instanceof Error ? ` — ${err.message}` : err != null ? ` — ${String(err)}` : '';
    process.stderr.write(`${RED}${BOLD}error${RESET} ${message}${detail}\n`);
  },

  verbose(message: string): void {
    if (!verboseMode) return;
    process.stdout.write(`${DIM}${CYAN}debug${RESET} ${DIM}${message}${RESET}\n`);
  },

  /** Print a plain line without a level prefix. */
  log(message: string): void {
    process.stdout.write(`${message}\n`);
  },
};
