import net from "net";
import { parseRedisCommand, RespSerializer } from "./resp";
import { globalStore } from "./store";
import { AofPersistence } from "./persistence";

const DEFAULT_PORT = 6379;
const HOST = "127.0.0.1";

export function startRedisServer(port: number = DEFAULT_PORT) {
  // 1. Replay existing AOF logs on server startup
  AofPersistence.load();
  AofPersistence.init();

  const server = net.createServer((socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[+] Client connected: ${clientAddress}`);

    socket.on("data", (data: Buffer) => {
      const rawText = data.toString();
      const args = parseRedisCommand(rawText);
      if (args.length === 0) return;

      const command = args[0].toUpperCase();
      console.log(`[⚡] ${command}`, args.slice(1));

      switch (command) {
        // ==================== Basic & Connection ====================
        case "PING": {
          if (args.length > 1) {
            socket.write(RespSerializer.bulkString(args[1]));
          } else {
            socket.write(RespSerializer.simpleString("PONG"));
          }
          break;
        }

        case "ECHO": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'echo' command"));
          } else {
            socket.write(RespSerializer.bulkString(args[1]));
          }
          break;
        }

        // ==================== String & Key-Value ====================
        case "SET": {
          if (args.length < 3) {
            socket.write(RespSerializer.error("wrong number of arguments for 'set' command"));
            break;
          }

          const key = args[1];
          const value = args[2];
          let ttlMs: number | undefined = undefined;

          for (let i = 3; i < args.length; i++) {
            const flag = args[i].toUpperCase();
            if (flag === "PX" && i + 1 < args.length) {
              ttlMs = parseInt(args[i + 1], 10);
              i++;
            } else if (flag === "EX" && i + 1 < args.length) {
              ttlMs = parseInt(args[i + 1], 10) * 1000;
              i++;
            }
          }

          globalStore.set(key, value, ttlMs);
          AofPersistence.log(rawText);
          socket.write(RespSerializer.simpleString("OK"));
          break;
        }

        case "GET": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'get' command"));
            break;
          }
          const val = globalStore.get(args[1]);
          socket.write(RespSerializer.bulkString(val));
          break;
        }

        case "DEL": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'del' command"));
            break;
          }
          const deleted = globalStore.del(args.slice(1));
          AofPersistence.log(rawText);
          socket.write(RespSerializer.integer(deleted));
          break;
        }

        case "EXISTS": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'exists' command"));
            break;
          }
          const count = globalStore.exists(args.slice(1));
          socket.write(RespSerializer.integer(count));
          break;
        }

        case "TTL": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'ttl' command"));
            break;
          }
          const remainingSec = globalStore.ttl(args[1]);
          socket.write(RespSerializer.integer(remainingSec));
          break;
        }

        case "INCR": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'incr' command"));
            break;
          }
          const newVal = globalStore.incr(args[1], 1);
          if (newVal === null) {
            socket.write(RespSerializer.error("value is not an integer or out of range"));
          } else {
            AofPersistence.log(rawText);
            socket.write(RespSerializer.integer(newVal));
          }
          break;
        }

        case "DECR": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'decr' command"));
            break;
          }
          const newVal = globalStore.incr(args[1], -1);
          if (newVal === null) {
            socket.write(RespSerializer.error("value is not an integer or out of range"));
          } else {
            AofPersistence.log(rawText);
            socket.write(RespSerializer.integer(newVal));
          }
          break;
        }

        // ==================== Lists ====================
        case "LPUSH": {
          if (args.length < 3) {
            socket.write(RespSerializer.error("wrong number of arguments for 'lpush' command"));
            break;
          }
          const len = globalStore.lpush(args[1], ...args.slice(2));
          AofPersistence.log(rawText);
          socket.write(RespSerializer.integer(len));
          break;
        }

        case "RPUSH": {
          if (args.length < 3) {
            socket.write(RespSerializer.error("wrong number of arguments for 'rpush' command"));
            break;
          }
          const len = globalStore.rpush(args[1], ...args.slice(2));
          AofPersistence.log(rawText);
          socket.write(RespSerializer.integer(len));
          break;
        }

        case "LPOP": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'lpop' command"));
            break;
          }
          const val = globalStore.lpop(args[1]);
          if (val !== null) AofPersistence.log(rawText);
          socket.write(RespSerializer.bulkString(val));
          break;
        }

        case "RPOP": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'rpop' command"));
            break;
          }
          const val = globalStore.rpop(args[1]);
          if (val !== null) AofPersistence.log(rawText);
          socket.write(RespSerializer.bulkString(val));
          break;
        }

        case "LRANGE": {
          if (args.length < 4) {
            socket.write(RespSerializer.error("wrong number of arguments for 'lrange' command"));
            break;
          }
          const start = parseInt(args[2], 10);
          const stop = parseInt(args[3], 10);
          const items = globalStore.lrange(args[1], start, stop);
          socket.write(RespSerializer.array(items));
          break;
        }

        case "LLEN": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'llen' command"));
            break;
          }
          const len = globalStore.llen(args[1]);
          socket.write(RespSerializer.integer(len));
          break;
        }

        // ==================== Hashes ====================
        case "HSET": {
          if (args.length < 4 || (args.length - 2) % 2 !== 0) {
            socket.write(RespSerializer.error("wrong number of arguments for 'hset' command"));
            break;
          }
          const key = args[1];
          const pairs: [string, string][] = [];
          for (let i = 2; i < args.length; i += 2) {
            pairs.push([args[i], args[i + 1]]);
          }
          const added = globalStore.hset(key, pairs);
          AofPersistence.log(rawText);
          socket.write(RespSerializer.integer(added));
          break;
        }

        case "HGET": {
          if (args.length < 3) {
            socket.write(RespSerializer.error("wrong number of arguments for 'hget' command"));
            break;
          }
          const val = globalStore.hget(args[1], args[2]);
          socket.write(RespSerializer.bulkString(val));
          break;
        }

        case "HGETALL": {
          if (args.length < 2) {
            socket.write(RespSerializer.error("wrong number of arguments for 'hgetall' command"));
            break;
          }
          const entries = globalStore.hgetall(args[1]);
          const flattened: string[] = [];
          for (const [f, v] of entries) {
            flattened.push(f, v);
          }
          socket.write(RespSerializer.array(flattened));
          break;
        }

        case "HDEL": {
          if (args.length < 3) {
            socket.write(RespSerializer.error("wrong number of arguments for 'hdel' command"));
            break;
          }
          const count = globalStore.hdel(args[1], args.slice(2));
          AofPersistence.log(rawText);
          socket.write(RespSerializer.integer(count));
          break;
        }

        case "FLUSHALL":
        case "FLUSHDB": {
          globalStore.flush();
          AofPersistence.log(rawText);
          socket.write(RespSerializer.simpleString("OK"));
          break;
        }

        default: {
          socket.write(RespSerializer.error(`unknown command '${command}'`));
          break;
        }
      }
    });

    socket.on("end", () => {
      console.log(`[-] Client disconnected: ${clientAddress}`);
    });

    socket.on("error", (err) => {
      console.error(`[!] Socket error (${clientAddress}):`, err.message);
    });
  });

  server.listen(port, HOST, () => {
    console.log(`=========================================`);
    console.log(`🚀 Custom Redis Server is running!`);
    console.log(`📡 Listening on: ${HOST}:${port}`);
    console.log(`=========================================`);
  });

  return server;
}
