# Custom Redis Server from Scratch 🚀

A high-performance, in-memory key-value database and cache server built from the ground up using **TypeScript** and **Bun**. Implements native TCP socket networking, the **RESP (REdis Serialization Protocol)** wire format, multiple data structures (Strings, Lists, Hashes, Counters), lazy TTL key expiration, and crash-resilient **AOF (Append Only File)** disk persistence.

---

## 📑 Table of Contents
- [Features](#-features)
- [Architecture & Protocol Overview](#-architecture--protocol-overview)
- [Project Structure](#-project-structure)
- [Prerequisites & Installation](#-prerequisites--installation)
- [Quick Start](#-quick-start)
- [Supported Commands Reference](#-supported-commands-reference)
- [Persistence & Crash Recovery](#-persistence--crash-recovery)
- [Development Log](#-development-log)

---

## ⚡ Features

- 🌐 **Native TCP Socket Server**: Built on low-overhead socket streams listening on port `6379`.
- 📜 **Complete RESP Protocol Parser & Serializer**: Supports Simple Strings (`+`), Errors (`-`), Integers (`:`), Bulk Strings (`$`), and Arrays (`*`).
- ⏱️ **TTL & Key Expiration**: Supports `SET key val EX <sec>` and `PX <ms>` with active/passive lazy deletion and `TTL` inspection.
- 🧱 **Rich Data Structures**:
  - **Strings & Counters**: `SET`, `GET`, `DEL`, `EXISTS`, `INCR`, `DECR`
  - **Lists (Queues & Stacks)**: `LPUSH`, `RPUSH`, `LPOP`, `RPOP`, `LRANGE`, `LLEN`
  - **Hashes (Objects / Dictionaries)**: `HSET`, `HGET`, `HGETALL`, `HDEL`
- 💾 **AOF (Append Only File) Persistence**: Automatically streams write-ahead operations to disk and replays logs on reboot for zero data loss.
- 💻 **Cross-Platform Interactive CLI Client**: Built-in interactive REPL client for instant testing without external Redis installations.

---

## 🧠 Architecture & Protocol Overview

```text
+-------------------+             +---------------------------------------+
|   Redis Client    |  TCP Socket |           Custom Redis Server         |
| (Interactive CLI) | ----------> |   - Port 6379 Listener                |
+-------------------+             |   - RESP Parser (Tokens & Arrays)     |
                                  +---------------------------------------+
                                                     |
                                   +-----------------+-----------------+
                                   |                                   |
                                   v                                   v
                    +-----------------------------+     +-----------------------------+
                    |       In-Memory Store       |     |       AOF Persistence       |
                    | - Strings & TTL Map         |     | - Write-Ahead Stream Log    |
                    | - Lists (Array Deques)      |     | - Database Replay on Boot   |
                    | - Hashes (Nested Maps)      |     +-----------------------------+
                    +-----------------------------+
```

---

## 📂 Project Structure

```text
redis-from-scratch/
├── src/
│   ├── types.ts           # Shared TypeScript interfaces for RESP & Memory store
│   ├── resp.ts            # RESP Protocol Parser and Serializer
│   ├── store.ts           # In-memory store (Strings, Lists, Hashes, Counters, TTL)
│   ├── persistence.ts     # AOF write-ahead logger and log replayer
│   ├── server.ts          # TCP Socket Server & Command Dispatcher
│   ├── client.ts          # Interactive CLI REPL client
│   └── index.ts           # Server startup entry point
├── package.json           # Scripts and dependencies
├── tsconfig.json          # TypeScript compiler configuration
├── PROJECT_STEPS.md       # Detailed step-by-step development log
├── README.md              # Project overview & manual
└── .gitignore             # Git ignored files
```

---

## 🛠️ Prerequisites & Installation

### 1. Install Bun
If Bun is not yet installed on your system:
```powershell
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"
```

### 2. Clone & Setup
```bash
git clone https://github.com/The-Aniketlad/redis-from-scratch.git
cd redis-from-scratch
bun install
```

---

## 🚀 Quick Start

### 1. Start the Redis Server
- **Option A: Using Bun (Local)**:
  ```bash
  bun run src/index.ts
  # or in auto-reloading dev mode:
  bun dev
  ```

- **Option B: Using Docker (Containerized)**:
  ```bash
  docker-compose up -d
  ```

### 2. Connect via Built-in CLI Client
In a second terminal window, launch the interactive client:
```bash
bun run client
```

---

## 📖 Supported Commands Reference

| Category | Command | Example | Description |
| :--- | :--- | :--- | :--- |
| **System** | `PING` | `PING "hello"` | Health check; returns `+PONG` or echoed string |
| **System** | `ECHO` | `ECHO "hello world"` | Echoes the input bulk string |
| **System** | `FLUSHALL` | `FLUSHALL` | Clears all data across the server |
| **Strings** | `SET` | `SET user "Aniket" EX 60` | Sets key with optional `EX` (sec) or `PX` (ms) TTL |
| **Strings** | `GET` | `GET user` | Retrieves string value (or `$-1` if expired/missing) |
| **Strings** | `DEL` | `DEL user temp` | Deletes one or more keys |
| **Strings** | `EXISTS` | `EXISTS user` | Returns count of keys that exist |
| **Strings** | `TTL` | `TTL user` | Returns remaining seconds (`-2` if absent, `-1` if no TTL) |
| **Counters**| `INCR` | `INCR hits` | Atomically increments integer by 1 |
| **Counters**| `DECR` | `DECR hits` | Atomically decrements integer by 1 |
| **Lists** | `LPUSH` | `LPUSH queue "task1"` | Prepends element(s) to head of list |
| **Lists** | `RPUSH` | `RPUSH queue "task2"` | Appends element(s) to tail of list |
| **Lists** | `LPOP` | `LPOP queue` | Removes and returns element from head |
| **Lists** | `RPOP` | `RPOP queue` | Removes and returns element from tail |
| **Lists** | `LRANGE` | `LRANGE queue 0 -1` | Returns range of elements |
| **Lists** | `LLEN` | `LLEN queue` | Returns count of elements in list |
| **Hashes** | `HSET` | `HSET user:1 name "Aniket"` | Sets hash field(s) |
| **Hashes** | `HGET` | `HGET user:1 name` | Gets hash field value |
| **Hashes** | `HGETALL`| `HGETALL user:1` | Returns all field-value pairs in hash |
| **Hashes** | `HDEL` | `HDEL user:1 name` | Deletes specified hash field(s) |
| **Transactions** | `MULTI` | `MULTI` | Starts a transaction block; commands are queued |
| **Transactions** | `EXEC` | `EXEC` | Executes all queued commands atomically in order |
| **Transactions** | `DISCARD`| `DISCARD` | Cancels the transaction and clears the command queue |
| **Pub/Sub** | `SUBSCRIBE`| `SUBSCRIBE news chat` | Subscribes client to specified channel(s) |
| **Pub/Sub** | `PUBLISH` | `PUBLISH news "msg"` | Broadcasts message to all channel subscribers |
| **Pub/Sub** | `UNSUBSCRIBE`| `UNSUBSCRIBE news` | Unsubscribes client from channel(s) |

---

## 💾 Persistence & Crash Recovery

This Redis implementation features **AOF (Append Only File)** durability:
1. Every write operation is committed to `appendonly.aof` on disk.
2. If the server is stopped or restarted, the engine reads and replays `appendonly.aof` upon boot.
3. Your database state is 100% recovered with zero data loss.

---

## 📝 Development Log
For the complete step-by-step implementation walkthrough and manual logs, see [`PROJECT_STEPS.md`](./PROJECT_STEPS.md).
