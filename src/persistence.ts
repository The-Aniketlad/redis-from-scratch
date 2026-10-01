import fs from "fs";
import path from "path";
import { parseRedisCommand } from "./resp";
import { globalStore } from "./store";

const AOF_FILE = path.resolve(process.cwd(), "appendonly.aof");

/**
 * AOF (Append Only File) Persistence Engine
 * Logs every write/mutating command to disk and replays them on startup.
 */
export class AofPersistence {
  private static writeStream: fs.WriteStream | null = null;

  /**
   * Initialize AOF write stream
   */
  static init(): void {
    AofPersistence.writeStream = fs.createWriteStream(AOF_FILE, { flags: "a" });
  }

  /**
   * Log a mutating command to AOF file
   */
  static log(rawCommand: string): void {
    if (!AofPersistence.writeStream) {
      AofPersistence.init();
    }
    const cleanCmd = rawCommand.trim();
    if (cleanCmd.length > 0) {
      AofPersistence.writeStream?.write(`${cleanCmd}\n`);
    }
  }

  /**
   * Replay existing AOF log file to recover database state into memory
   */
  static load(): void {
    if (!fs.existsSync(AOF_FILE)) {
      return;
    }

    try {
      const content = fs.readFileSync(AOF_FILE, "utf-8");
      const lines = content.split("\n");
      let count = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const args = parseRedisCommand(trimmed);
        if (args.length === 0) continue;

        const command = args[0].toUpperCase();

        switch (command) {
          case "SET": {
            if (args.length >= 3) {
              let ttlMs: number | undefined = undefined;
              for (let i = 3; i < args.length; i++) {
                const flag = args[i].toUpperCase();
                if (flag === "PX" && i + 1 < args.length) {
                  ttlMs = parseInt(args[i + 1], 10);
                } else if (flag === "EX" && i + 1 < args.length) {
                  ttlMs = parseInt(args[i + 1], 10) * 1000;
                }
              }
              globalStore.set(args[1], args[2], ttlMs);
            }
            break;
          }
          case "DEL": {
            globalStore.del(args.slice(1));
            break;
          }
          case "INCR": {
            globalStore.incr(args[1], 1);
            break;
          }
          case "DECR": {
            globalStore.incr(args[1], -1);
            break;
          }
          case "LPUSH": {
            globalStore.lpush(args[1], ...args.slice(2));
            break;
          }
          case "RPUSH": {
            globalStore.rpush(args[1], ...args.slice(2));
            break;
          }
          case "LPOP": {
            globalStore.lpop(args[1]);
            break;
          }
          case "RPOP": {
            globalStore.rpop(args[1]);
            break;
          }
          case "HSET": {
            const pairs: [string, string][] = [];
            for (let i = 2; i < args.length; i += 2) {
              pairs.push([args[i], args[i + 1]]);
            }
            globalStore.hset(args[1], pairs);
            break;
          }
          case "HDEL": {
            globalStore.hdel(args[1], args.slice(2));
            break;
          }
          case "FLUSHALL":
          case "FLUSHDB": {
            globalStore.flush();
            break;
          }
        }
        count++;
      }

      console.log(`[💾 Persistence] Successfully loaded and replayed ${count} commands from AOF!`);
    } catch (err: any) {
      console.error(`[!] Error loading AOF:`, err.message);
    }
  }
}
