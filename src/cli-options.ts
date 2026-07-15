export interface CliOptions {
  out?: string;
  limit?: number;
  course?: string;
  url?: string;
  profile?: string;
}

type StringOption = Exclude<keyof CliOptions, "limit">;

const stringOptions = new Set<StringOption>(["out", "course", "url", "profile"]);

export class CliInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliInputError";
  }
}

export function parseCliOptions(args: string[]): CliOptions {
  const result: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      throw new CliInputError(`未知参数：${argument}`);
    }

    const separator = argument.indexOf("=");
    const name = argument.slice(2, separator >= 0 ? separator : undefined);
    const inlineValue = separator >= 0 ? argument.slice(separator + 1) : undefined;

    if (name !== "limit" && !stringOptions.has(name as StringOption)) {
      throw new CliInputError(`未知参数：--${name}`);
    }

    const nextValue = inlineValue ?? args[index + 1];
    if (nextValue === undefined || nextValue.startsWith("--") || !nextValue.trim()) {
      throw new CliInputError(`参数 --${name} 缺少值。`);
    }
    if (inlineValue === undefined) index += 1;

    const value = nextValue.trim();
    if (name === "limit") {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new CliInputError("参数 --limit 必须是正整数。");
      }
      result.limit = limit;
    } else {
      result[name as StringOption] = value;
    }
  }

  return result;
}
