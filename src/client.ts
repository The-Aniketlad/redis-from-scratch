import net from "net";
import readline from "readline";

const HOST = "127.0.0.1";
const PORT = 6379;

// Connect to the local Redis server
const client = net.createConnection({ host: HOST, port: PORT }, () => {
  console.log(`Connected to Redis server at ${HOST}:${PORT}`);
  console.log(`Type commands (e.g. PING, ECHO hello, etc.) or 'exit' to quit.\n`);
  prompt();
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt() {
  rl.question(`127.0.0.1:${PORT}> `, (input) => {
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
      client.end();
      rl.close();
      process.exit(0);
    }

    if (trimmed.length > 0) {
      // Send raw command with CRLF
      client.write(`${trimmed}\r\n`);
    } else {
      prompt();
    }
  });
}

// Receive responses from server
client.on("data", (data) => {
  console.log(data.toString().trimEnd());
  prompt();
});

client.on("error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});

client.on("close", () => {
  console.log("\nConnection closed.");
  process.exit(0);
});
