/**
 * Tiny zero-dependency ANSI color helper.
 *
 * Honors the NO_COLOR convention (https://no-color.org) and only colorizes when
 * attached to a TTY (or when FORCE_COLOR is set). groundtruth writes its hook
 * report to stderr, so we enable color when *either* stream is a TTY.
 */
const useColor =
  !("NO_COLOR" in process.env) &&
  process.env.TERM !== "dumb" &&
  (process.env.FORCE_COLOR === "1" ||
    Boolean(process.stdout.isTTY) ||
    Boolean(process.stderr.isTTY));

function wrap(open: number, close: number): (s: string) => string {
  return (s: string) => (useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s);
}

export const c = {
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
  dim: wrap(2, 22),
  bold: wrap(1, 22),
};
