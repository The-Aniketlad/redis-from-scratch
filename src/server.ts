import net from "net";
import { parseRedisCommand, RespSerializer } from "./resp";
import { globalStore } from "./store";
import { AofPersistence } from "./persistence";

const DEFAULT_PORT = 6379;
const HOST = "127.0.0.1";

/**
 * Execute a single parsed Redis command against the in-memory store
 */
function executeCommand(args: string[]): { response: string; isMutating: boolean } {
  if (args.length === 0) {
    return { response: RespSerializer.error("empty command"), isMutating: false };
  }

  const command = args[0].toUpperCase();

  switch (command) {
    // ==================== Basic & Connection ====================
    case "PING": {
      if (args.length > 1) {
        return { response: RespSerializer.bulkString(args[1]), isMutating: false };
      }
      return { response: RespSerializer.simpleString("PONG"), isMutating: false };
    }

    case "ECHO": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'echo' command"), isMutating: false };
      }
      return { response: RespSerializer.bulkString(args[1]), isMutating: false };
    }

    // ==================== String & Key-Value ====================
    case "SET": {
      if (args.length < 3) {
        return { response: RespSerializer.error("wrong number of arguments for 'set' command"), isMutating: false };
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
      return { response: RespSerializer.simpleString("OK"), isMutating: true };
    }

    case "GET": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'get' command"), isMutating: false };
      }
      const val = globalStore.get(args[1]);
      return { response: RespSerializer.bulkString(val), isMutating: false };
    }

    case "DEL": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'del' command"), isMutating: false };
      }
      const deleted = globalStore.del(args.slice(1));
      return { response: RespSerializer.integer(deleted), isMutating: true };
    }

    case "EXISTS": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'exists' command"), isMutating: false };
      }
      const count = globalStore.exists(args.slice(1));
      return { response: RespSerializer.integer(count), isMutating: false };
    }

    case "TTL": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'ttl' command"), isMutating: false };
      }
      const remainingSec = globalStore.ttl(args[1]);
      return { response: RespSerializer.integer(remainingSec), isMutating: false };
    }

    case "INCR": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'incr' command"), isMutating: false };
      }
      const newVal = globalStore.incr(args[1], 1);
      if (newVal === null) {
        return { response: RespSerializer.error("value is not an integer or out of range"), isMutating: false };
      }
      return { response: RespSerializer.integer(newVal), isMutating: true };
    }

    case "DECR": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'decr' command"), isMutating: false };
      }
      const newVal = globalStore.incr(args[1], -1);
      if (newVal === null) {
        return { response: RespSerializer.error("value is not an integer or out of range"), isMutating: false };
      }
      return { response: RespSerializer.integer(newVal), isMutating: true };
    }

    // ==================== Lists ====================
    case "LPUSH": {
      if (args.length < 3) {
        return { response: RespSerializer.error("wrong number of arguments for 'lpush' command"), isMutating: false };
      }
      const len = globalStore.lpush(args[1], ...args.slice(2));
      return { response: RespSerializer.integer(len), isMutating: true };
    }

    case "RPUSH": {
      if (args.length < 3) {
        return { response: RespSerializer.error("wrong number of arguments for 'rpush' command"), isMutating: false };
      }
      const len = globalStore.rpush(args[1], ...args.slice(2));
      return { response: RespSerializer.integer(len), isMutating: true };
    }

    case "LPOP": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'lpop' command"), isMutating: false };
      }
      const val = globalStore.lpop(args[1]);
      return { response: RespSerializer.bulkString(val), isMutating: val !== null };
    }

    case "RPOP": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'rpop' command"), isMutating: false };
      }
      const val = globalStore.rpop(args[1]);
      return { response: RespSerializer.bulkString(val), isMutating: val !== null };
    }

    case "LRANGE": {
      if (args.length < 4) {
        return { response: RespSerializer.error("wrong number of arguments for 'lrange' command"), isMutating: false };
      }
      const start = parseInt(args[2], 10);
      const stop = parseInt(args[3], 10);
      const items = globalStore.lrange(args[1], start, stop);
      return { response: RespSerializer.array(items), isMutating: false };
    }

    case "LLEN": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'llen' command"), isMutating: false };
      }
      const len = globalStore.llen(args[1]);
      return { response: RespSerializer.integer(len), isMutating: false };
    }

    // ==================== Hashes ====================
    case "HSET": {
      if (args.length < 4 || (args.length - 2) % 2 !== 0) {
        return { response: RespSerializer.error("wrong number of arguments for 'hset' command"), isMutating: false };
      }
      const key = args[1];
      const pairs: [string, string][] = [];
      for (let i = 2; i < args.length; i += 2) {
        pairs.push([args[i], args[i + 1]]);
      }
      const added = globalStore.hset(key, pairs);
      return { response: RespSerializer.integer(added), isMutating: true };
    }

    case "HGET": {
      if (args.length < 3) {
        return { response: RespSerializer.error("wrong number of arguments for 'hget' command"), isMutating: false };
      }
      const val = globalStore.hget(args[1], args[2]);
      return { response: RespSerializer.bulkString(val), isMutating: false };
    }

    case "HGETALL": {
      if (args.length < 2) {
        return { response: RespSerializer.error("wrong number of arguments for 'hgetall' command"), isMutating: false };
      }
      const entries = globalStore.hgetall(args[1]);
      const flattened: string[] = [];
      for (const [f, v] of entries) {
        flattened.push(f, v);
      }
      return { response: RespSerializer.array(flattened), isMutating: false };
    }

    case "HDEL": {
      if (args.length < 3) {
        return { response: RespSerializer.error("wrong number of arguments for 'hdel' command"), isMutating: false };
      }
      const count = globalStore.hdel(args[1], args.slice(2));
      return { response: RespSerializer.integer(count), isMutating: true };
    }

    case "FLUSHALL":
    case "FLUSHDB": {
      globalStore.flush();
      return { response: RespSerializer.simpleString("OK"), isMutating: true };
    }

    default: {
      return { response: RespSerializer.error(`unknown command '${command}'`), isMutating: false };
    }
  }
}

export function startRedisServer(port: number = DEFAULT_PORT) {
  // Replay existing AOF logs on server startup
  AofPersistence.load();
  AofPersistence.init();

  const server = net.createServer((socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[+] Client connected: ${clientAddress}`);

    // Per-Connection Transaction State
    let inTransaction = false;
    let commandQueue: string[][] = [];

    socket.on("data", (data: Buffer) => {
      const rawText = data.toString();
      const args = parseRedisCommand(rawText);
      if (args.length === 0) return;

      const command = args[0].toUpperCase();
      console.log(`[⚡] (${inTransaction ? "TX QUEUE" : "DIRECT"}) ${command}`, args.slice(1));

      // ==================== Transaction Control ====================
      if (command === "MULTI") {
        if (inTransaction) {
          socket.write(RespSerializer.error("MULTI calls can not be nested"));
        } else {
          inTransaction = true;
          commandQueue = [];
          socket.write(RespSerializer.simpleString("OK"));
        }
        return;
      }

      if (command === "DISCARD") {
        if (!inTransaction) {
          socket.write(RespSerializer.error("DISCARD without MULTI"));
        } else {
          inTransaction = false;
          commandQueue = [];
          socket.write(RespSerializer.simpleString("OK"));
        }
        return;
      }

      if (command === "EXEC") {
        if (!inTransaction) {
          socket.write(RespSerializer.error("EXEC without MULTI"));
          return;
        }

        inTransaction = false;
        const queued = [...commandQueue];
        commandQueue = [];

        // Atomically execute all queued commands
        let responseArray = `*${queued.length}\r\n`;
        for (const queuedArgs of queued) {
          const { response, isMutating } = executeCommand(queuedArgs);
          responseArray += response;
          if (isMutating) {
            AofPersistence.log(queuedArgs.join(" "));
          }
        }

        socket.write(responseArray);
        return;
      }

      // If client is currently inside a transaction, queue the command
      if (inTransaction) {
        commandQueue.push(args);
        socket.write(RespSerializer.simpleString("QUEUED"));
        return;
      }

      // Normal Immediate Execution
      const { response, isMutating } = executeCommand(args);
      if (isMutating) {
        AofPersistence.log(rawText);
      }
      socket.write(response);
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
