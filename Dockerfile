# Use official lightweight Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json tsconfig.json ./
RUN bun install

# Copy source files and documentation
COPY src/ ./src/
COPY README.md PROJECT_STEPS.md ./

# Expose default Redis port
EXPOSE 6379

# Start Redis Server
CMD ["bun", "run", "src/index.ts"]
