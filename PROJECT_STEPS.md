# Redis Custom Implementation - Step-by-Step Development Log

> **Project Goal**: Build a fully functional Redis server from scratch, documenting every single step, implementation detail, command, and design decision for easy GitHub migration and clear understanding.

---

## 📌 Index of Steps

- [Step 0: Prerequisites & Environment Setup](#step-0-prerequisites--environment-setup)
- [Step 1: Starter Repository & GitHub Setup](#step-1-starter-repository--github-setup)
- [Step 2: Project Architecture & TCP Server](#step-2-project-architecture--tcp-server)
- [Step 3: RESP Protocol Parser & Multi-Command Handling](#step-3-resp-protocol-parser--multi-command-handling) _(Next)_

---

## 🛠️ Step 0: Prerequisites & Environment Setup

### 1. Requirements

- **Runtime / Package Manager**: [Bun](https://bun.sh/) (v1.4.2+)
- **Language**: TypeScript / JavaScript
- **OS**: Windows

### 2. Manual Commands Executed

- **Bun Installation**:
  ```powershell
  powershell -c "irm bun.sh/install.ps1|iex"
  ```
- **Installation Verification**:
  - Binary installed at: `C:\Users\Aniket Lad\.bun\bin\bun.exe`
  - Version: `Bun 1.4.2`

---

## 📂 Step 1: Starter Repository & GitHub Setup

### 1. Strategy & Commands

- **Case A: Fresh Local Folder (Current Setup)**:
  1. Initialize Git locally:
     ```bash
     git init
     ```
  2. Add your GitHub remote as `origin`:
     ```bash
     git remote add origin https://github.com/The-Aniketlad/redis-from-scratch.git
     ```
  3. Rename branch to `main` (optional, recommended):
     ```bash
     git branch -M main
     ```
  4. Configure `.gitignore` to exclude `.md` files and external folders:
     ```gitignore
     *.md
     build-your-own-git/
     node_modules/
     ```
  5. Commit and Push:
     ```bash
     git add .
     git commit -m "feat: initialize custom redis server project"
     git push -u origin main
     ```

- **Case B: If updating an already linked cloned repo**:
  ```bash
  git remote set-url origin https://github.com/The-Aniketlad/redis-from-scratch.git
  ```

---

## 🌐 Step 2: Project Architecture & TCP Server

### 1. Core Concepts

- **What is Redis?**: An in-memory, network-accessible data structure store communicating over TCP sockets (default port: `6379`).
- **What is RESP?**: Redis Serialization Protocol.
  - Simple String format: `+<string>\r\n` (e.g., `+PONG\r\n` or `+OK\r\n`).
  - Redis clients terminate all messages with CRLF (`\r\n`).

### 2. File Layout Implemented

```text
redis-from-scratch/
├── src/
│   ├── types.ts       # Shared TypeScript types for RESP & Store
│   ├── server.ts      # TCP Server listener & Socket connection handling
│   └── index.ts       # Server entry point
├── package.json       # Project scripts and metadata
├── tsconfig.json      # TypeScript compiler configuration
└── .gitignore         # Ignored files
```

### 3. How to Run the Server Manually

Run the following in your terminal:

```bash
bun run src/index.ts
```

_(Or in dev watch mode)_:

```bash
bun dev
```

### 4. How to Test Manually

Open a second terminal window and test connection:

- **Method 1: Using our Built-in Custom CLI Client (Recommended for Windows)**:

  ```bash
  bun run src/client.ts
  ```

  Or via package script:

  ```bash
  bun run client
  ```

  Type `PING` and press enter $\rightarrow$ Output: `+PONG`!

- **Method 2: Using `redis-cli`** (if installed on Linux/WSL/Mac):

  ```bash
  redis-cli ping
  # Expected output: PONG
  ```

- **Method 3: Using PowerShell TCP Socket**:
  ```powershell
  $client = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 6379)
  $stream = $client.GetStream()
  $writer = New-Object System.IO.StreamWriter($stream)
  $reader = New-Object System.IO.StreamReader($stream)
  $writer.WriteLine("*1`r`n`$4`r`nPING`r`n")
  $writer.Flush()
  $reader.ReadLine()
  # Expected output: +PONG
  $client.Close()
  ```

---

## ⚡ Step 3: RESP Protocol Parser & Serializer (`ECHO` & `PING` with Args)

### 1. Concept: How RESP Handles Commands & Arguments

- In Redis, commands are sent as arrays of Bulk Strings:
  - Example `ECHO "hello world"` is transmitted as:
    ```text
    *2\r\n
    $4\r\n
    ECHO\r\n
    $11\r\n
    hello world\r\n
    ```
- **Response Format**:
  - `PING` (without args) $\rightarrow$ Simple string: `+PONG\r\n`
  - `PING "hey"` $\rightarrow$ Bulk string: `$3\r\nhey\r\n`
  - `ECHO "hello world"` $\rightarrow$ Bulk string: `$11\r\nhello world\r\n`
  - Errors $\rightarrow$ `-ERR <message>\r\n`

### 2. Implementation Files

- [`src/resp.ts`](./src/resp.ts):
  - `RespSerializer`: Serializes simple strings, bulk strings, integers, arrays, and errors.
  - `parseRedisCommand`: Parses both standard RESP arrays and inline terminal inputs.
- [`src/server.ts`](./src/server.ts):
  - Added command dispatcher supporting `PING` and `ECHO`.

### 3. How to Test

1. Restart the server (`bun run src/index.ts` or `bun dev`).
2. In your CLI client terminal (`bun run client`):
   - Type: `PING` $\rightarrow$ Returns: `+PONG`
   - Type: `PING "hey"` $\rightarrow$ Returns: `$3\r\nhey`
   - Type: `ECHO "hello world"` $\rightarrow$ Returns: `$11\r\nhello world`
   - Type: `ECHO hey` $\rightarrow$ Returns: `$3\r\nhey`
   - Type: `UNKNOWN` $\rightarrow$ Returns: `-ERR unknown command 'UNKNOWN'`

---

---

## 💾 Step 4: In-Memory Key-Value Store with TTL & Expiration (`SET`, `GET`, `DEL`, `EXISTS`)

### 1. Concepts & Architecture

- **In-Memory Store (`src/store.ts`)**:
  - Uses `Map<string, { value: string; expiresAt?: number }>` to store data in RAM.
- **Passive Expiration (Lazy Deletion)**:
  - When `GET key` is invoked, the server checks if `Date.now() > item.expiresAt`.
  - If expired, it silently deletes the key from memory and returns `null` (`$-1\r\n` Null Bulk String).
- **Supported Commands**:
  - `SET <key> <value>` $\rightarrow$ Stores pair, returns `+OK\r\n`
  - `SET <key> <value> PX <ms>` $\rightarrow$ Stores pair with millisecond TTL expiry
  - `SET <key> <value> EX <sec>` $\rightarrow$ Stores pair with second TTL expiry
  - `GET <key>` $\rightarrow$ Returns bulk string `$len\r\nval\r\n` or `$-1\r\n` if key doesn't exist/expired
  - `DEL <key1> [<key2> ...]` $\rightarrow$ Returns integer `:<count>\r\n`
  - `EXISTS <key1> [<key2> ...]` $\rightarrow$ Returns integer `:<count>\r\n`

### 2. Implementation Files

- [`src/store.ts`](./src/store.ts): Core memory store with `set`, `get`, `del`, `exists`, `flush`.
- [`src/server.ts`](./src/server.ts): Integrated command handlers for `SET`, `GET`, `DEL`, `EXISTS`, `FLUSHALL`.

### 3. How to Test

1. Restart the server (`bun run src/index.ts` or `bun dev`).
2. In the CLI client (`bun run client`):

   ```text
   # Basic SET & GET
   SET name "Aniket"
   GET name
   # Output: Aniket

   # Check EXISTS
   EXISTS name
   # Output: :1

   # Test Expiration (PX in milliseconds)
   SET temp "Disappearing Data" PX 2000
   GET temp
   # Output: Disappearing Data (immediately)
   # Wait 2 seconds...
   GET temp
   # Output: (null) / $-1

   # Delete key
   DEL name
   GET name
   # Output: (null) / $-1
   ```

---

---

## 📚 Step 5: Advanced Data Structures (Lists, Hashes, Counters & TTL Checking)

### 1. New Features Implemented

- **Counters**:
  - `INCR <key>`: Atomically increments number by 1 (creates with 1 if key doesn't exist).
  - `DECR <key>`: Atomically decrements number by 1.
- **TTL Checking**:
  - `TTL <key>`: Returns remaining time in seconds (`-2` if doesn't exist/expired, `-1` if key has no TTL).
- **Lists**:
  - `LPUSH <key> <val1> ...`: Prepend to list head, returns new list length.
  - `RPUSH <key> <val1> ...`: Append to list tail, returns new list length.
  - `LPOP <key>`: Remove and return head element.
  - `RPOP <key>`: Remove and return tail element.
  - `LRANGE <key> <start> <stop>`: Get slice of elements (supports negative indices like `0 -1` for all elements).
  - `LLEN <key>`: Get length of list.
- **Hashes**:
  - `HSET <key> <field> <value> [<field> <value> ...]`: Set key fields.
  - `HGET <key> <field>`: Retrieve field value.
  - `HGETALL <key>`: Retrieve all field-value pairs as a flat RESP array.
  - `HDEL <key> <field1> ...`: Delete fields.

### 2. Implementation Files

- [`src/store.ts`](./src/store.ts): Multi-store architecture managing `strings`, `lists`, and `hashes` Maps.
- [`src/server.ts`](./src/server.ts): Command handlers for all data structure operations.

### 3. How to Test

1. Restart the server (`bun run src/index.ts` or `bun dev`).
2. In the CLI client (`bun run client`):

   ```text
   # 1. Test Counters & TTL
   INCR visitors
   INCR visitors
   # Output: :2
   SET session "abc" EX 60
   TTL session
   # Output: :60 (or remaining seconds)

   # 2. Test Lists
   RPUSH mylist "apple" "banana" "cherry"
   # Output: :3
   LRANGE mylist 0 -1
   # Output: [apple, banana, cherry]
   LPOP mylist
   # Output: apple

   # 3. Test Hashes
   HSET user:101 name "Aniket" role "Developer"
   # Output: :2
   HGET user:101 name
   # Output: Aniket
   HGETALL user:101
   # Output: [name, Aniket, role, Developer]
   ```

---

## 💾 Step 6: Persistence Engine (AOF - Append Only File)

### 1. Concepts & Why Persistence Matters

- In-memory data is volatile; if the server restarts or crashes, all RAM state is lost.
- **AOF (Append Only File)**:
  - Every write/mutating command (`SET`, `DEL`, `INCR`, `DECR`, `LPUSH`, `RPUSH`, `LPOP`, `RPOP`, `HSET`, `HDEL`, `FLUSHALL`) is sequentially written to an `appendonly.aof` file on disk.
  - On server startup, the engine reads and **replays** the log file line-by-line, perfectly restoring the database in-memory state.

### 2. Implementation Files

- [`src/persistence.ts`](./src/persistence.ts):
  - `AofPersistence.init()`: Opens writable append stream to `appendonly.aof`.
  - `AofPersistence.log(rawCommand)`: Appends mutating command to disk.
  - `AofPersistence.load()`: Replays existing AOF logs into memory store on boot.
- [`src/server.ts`](./src/server.ts): Invokes `AofPersistence.load()` on startup and logs all write commands.

### 3. How to Test Persistence

1. Start server: `bun run src/index.ts` (or `bun dev`).
2. In client (`bun run client`), write some data:
   ```text
   SET hero "IronMan"
   RPUSH avengers "Thor" "Cap" "Hulk"
   HSET db:meta version "1.0" engine "Bun"
   ```
3. **Kill the server!** (Press `Ctrl + C` in server terminal).
4. **Start the server again**: `bun run src/index.ts`.
   - Server logs will show: `[💾 Persistence] Successfully loaded and replayed 3 commands from AOF!`
5. In client (`bun run client`), check if data persisted:
   ```text
   GET hero
   # Output: IronMan
   LRANGE avengers 0 -1
   # Output: [Thor, Cap, Hulk]
   HGETALL db:meta
   # Output: [version, 1.0, engine, Bun]
   ```

---

## 🔒 Step 7: Redis Transactions (`MULTI`, `EXEC`, `DISCARD`)

### 1. Concepts & Architecture

- **What is a Redis Transaction?**:
  - Allows the execution of a group of commands in a single atomic, isolated step.
- **Protocol Flow**:
  1. `MULTI`: Enters transaction block $\rightarrow$ returns `+OK\r\n`.
  2. Subsequent commands (`SET`, `INCR`, `GET`, etc.) are **not executed immediately** $\rightarrow$ they are stored in a socket-specific FIFO `commandQueue`, and the server returns `+QUEUED\r\n`.
  3. `EXEC`: Executes all queued commands in order $\rightarrow$ returns a RESP Array with the result of every command `*N\r\n...`.
  4. `DISCARD`: Clears the queue and exits transaction mode without executing anything $\rightarrow$ returns `+OK\r\n`.
- **Edge Case Protections**:
  - Calling `EXEC` or `DISCARD` without `MULTI` returns `-ERR EXEC without MULTI` / `-ERR DISCARD without MULTI`.
  - Nested `MULTI` calls return `-ERR MULTI calls can not be nested`.

### 2. Implementation Files

- [`src/server.ts`](./src/server.ts):
  - Added per-connection state `inTransaction` and `commandQueue`.
  - Added `executeCommand()` helper function to process queued and immediate commands cleanly.

### 3. How to Test

1. Restart the server (`bun run src/index.ts` or `bun dev`).
2. In the CLI client (`bun run client`):

   ```text
   # Test 1: Successful Atomic Transaction
   MULTI
   # Output: +OK
   SET balance 1000
   # Output: +QUEUED
   INCR balance
   # Output: +QUEUED
   INCR balance
   # Output: +QUEUED
   EXEC
   # Output:
   # *3
   # +OK
   # :1001
   # :1002

   # Test 2: DISCARD Transaction (Abort)
   MULTI
   # Output: +OK
   SET balance 9999
   # Output: +QUEUED
   DISCARD
   # Output: +OK
   GET balance
   # Output: 1002 (Unchanged!)
   ```

---

## 📡 Step 8: Pub/Sub Messaging Pattern (`SUBSCRIBE`, `PUBLISH`, `UNSUBSCRIBE`)

### 1. Concepts & Architecture
- **What is Pub/Sub?**:
  - A decoupled real-time messaging pattern where senders (Publishers) broadcast messages to named channels without knowing who the receivers (Subscribers) are.
- **Protocol Flow**:
  1. `SUBSCRIBE <channel1> [<channel2> ...]`:
     - Client subscribes to channels $\rightarrow$ returns RESP 3-element array: `["subscribe", channel, total_subscriptions]`.
  2. `PUBLISH <channel> <message>`:
     - Publisher pushes a message to a channel $\rightarrow$ server delivers the message to all active subscriber sockets $\rightarrow$ returns integer count of subscribers who received it: `:<count>\r\n`.
  3. **Delivered Message Format**:
     - Subscribers receive: `*3\r\n$7\r\nmessage\r\n$<channel_len>\r\n<channel>\r\n$<msg_len>\r\n<msg>\r\n`.
  4. `UNSUBSCRIBE [<channel1> ...]`:
     - Unsubscribes client from channels $\rightarrow$ returns `["unsubscribe", channel, remaining_subscriptions]`.
  5. **Auto Socket Cleanup**:
     - When any client socket disconnects, the server automatically cleans up its subscriptions to prevent memory leaks.

### 2. Implementation Files
- [`src/pubsub.ts`](./src/pubsub.ts): `PubSubManager` broker managing channel sets and socket broadcasting.
- [`src/server.ts`](./src/server.ts): Integrated `SUBSCRIBE`, `PUBLISH`, `UNSUBSCRIBE` command handlers and socket disconnect cleanup.

### 3. How to Test Pub/Sub Across 2 Clients
1. Start the server in Terminal 1: `bun run src/index.ts`.
2. Open **Terminal 2 (Subscriber Client)**:
   ```bash
   bun run client
   ```
   Subscribe to a channel:
   ```text
   SUBSCRIBE news
   # Output:
   # *3
   # $9
   # subscribe
   # $4
   # news
   # :1
   ```
3. Open **Terminal 3 (Publisher Client)**:
   ```bash
   bun run client
   ```
   Publish a message:
   ```text
   PUBLISH news "Breaking: Custom Redis PubSub is Live!"
   # Output: :1 (Delivered to 1 subscriber)
   ```
4. Check **Terminal 2 (Subscriber)**:
   - Notice that the message automatically popped up in real time!
     ```text
     *3
     $7
     message
     $4
     news
     $40
     Breaking: Custom Redis PubSub is Live!
     ```

---

## 🐳 Step 9: Production Containerization (Docker & Docker-Compose)

### 1. Concepts & Why Containerization Matters
- Enables running the custom Redis server on any Linux/Mac/Windows server or cloud VM without needing Bun or Node.js pre-installed.
- Binds port `6379` directly to the host machine.
- Mounts `appendonly.aof` volume for crash-resilient disk persistence across container restarts.

### 2. Implementation Files
- [`Dockerfile`](./Dockerfile): Multi-stage lightweight Bun container image exposing port `6379`.
- [`docker-compose.yml`](./docker-compose.yml): Production-ready single-command container orchestrator.

### 3. How to Run with Docker
```bash
# Build & start container
docker-compose up -d

# Check running status
docker ps

# Stop container
docker-compose down
```

---

## 🏆 Project Completion & GitHub Readiness
- **Core Protocol**: Native TCP socket listener on port 6379, complete RESP serialization/parsing.
- **In-Memory Store**: Strings, Counters (`INCR`/`DECR`), Lists (`LPUSH`/`RPUSH`/`LPOP`/`RPOP`/`LRANGE`), Hashes (`HSET`/`HGET`/`HGETALL`/`HDEL`).
- **TTL & Expiry**: Millisecond (`PX`) and Second (`EX`) lazy passive expiration with live `TTL` countdown.
- **Persistence**: Crash-proof Write-Ahead AOF (`appendonly.aof`) log streaming and boot recovery.
- **Transactions**: Atomic transaction blocks (`MULTI`, `EXEC`, `DISCARD`) with `QUEUED` state.
- **Real-Time Pub/Sub**: Decoupled multi-client message broker (`SUBSCRIBE`, `PUBLISH`, `UNSUBSCRIBE`).
- **DevOps**: Docker & Docker-Compose ready for cloud deployment.


