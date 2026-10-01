/**
 * RESP (REdis Serialization Protocol) Parser & Serializer
 * Supports:
 * - Simple Strings (+<str>\r\n)
 * - Errors (-ERR <msg>\r\n)
 * - Integers (:<int>\r\n)
 * - Bulk Strings ($<len>\r\n<data>\r\n, $-1\r\n)
 * - Arrays (*<count>\r\n...elements...)
 */

export class RespSerializer {
  static simpleString(str: string): string {
    return `+${str}\r\n`;
  }

  static error(msg: string): string {
    return `-ERR ${msg}\r\n`;
  }

  static integer(num: number): string {
    return `:${num}\r\n`;
  }

  static bulkString(str: string | null): string {
    if (str === null) {
      return `$-1\r\n`;
    }
    return `$${Buffer.byteLength(str, "utf-8")}\r\n${str}\r\n`;
  }

  static array(items: string[]): string {
    let result = `*${items.length}\r\n`;
    for (const item of items) {
      result += RespSerializer.bulkString(item);
    }
    return result;
  }
}

/**
 * Parses raw incoming byte buffers/strings from TCP client into command tokens.
 * Handles both RESP Array format (standard) and Inline commands.
 *
 * Example RESP Array:
 * *2\r\n$4\r\nECHO\r\n$5\r\nhello\r\n  --> ["ECHO", "hello"]
 *
 * Example Inline:
 * ECHO hello\r\n                     --> ["ECHO", "hello"]
 */
export function parseRedisCommand(rawInput: string): string[] {
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  // 1. Standard RESP Array parsing (starts with '*')
  if (trimmed.startsWith("*")) {
    const lines = trimmed.split("\r\n");
    const args: string[] = [];

    // Line 0 is *<num_elements>
    let i = 1;
    while (i < lines.length) {
      if (lines[i].startsWith("$")) {
        // Line i is $<length>, Line i+1 is the actual string
        if (i + 1 < lines.length) {
          args.push(lines[i + 1]);
          i += 2;
        } else {
          i++;
        }
      } else if (lines[i].length > 0) {
        args.push(lines[i]);
        i++;
      } else {
        i++;
      }
    }
    return args;
  }

  // 2. Fallback: Inline Command parsing (e.g. "SET foo bar" or "PING")
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    matches.push(match[1] || match[2] || match[0]);
  }
  return matches;
}
