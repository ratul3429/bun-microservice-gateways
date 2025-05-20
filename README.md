# bun-microservice-gateways

A blazing fast, configurable gateway built with [Bun](https://bun.sh), designed to forward HTTP requests to internal microservices based on path or prefix. Ideal for lightweight setups and local development.

## 🛠 Features

- ⚡ Built with [Bun](https://bun.sh)
- ✅ TypeScript-first
- 🔁 Hot config reload via CLI command (`r`)
- 🧠 Smart routing based on:
  - Exact path and method
  - Prefix matching
- 🩺 Built-in health check (`/__health`)
- 🪵 Structured logging (INFO, DEBUG, ERROR)

---

## 📦 Installation

```bash
bun install
```

## ⚙️ Configuration

Create a `config.json` file in the root directory with the following structure:

```json
{
  "host": "0.0.0.0",
  "port": 9999,
  "debug": true,
  "services": [
    {
      "prefix": "/user/",
      "host": "localhost",
      "port": 8888
    },
    {
      "path": "/my/login/",
      "method": "POST",
      "host": "localhost",
      "port": 6666
    }
  ]
}
```

## 🔍 Matching Logic

- `path + method`: Exact match
- `prefix`: Requests matching the prefix (e.g., /api/user/...) will be routed accordingly.

## 🚀 Running the Gateway

```bash
bun start
```

Example output:

```
📡 [INFO  ] 🔁 Configuration loaded
📡 [INFO  ] 🚀 Starting Gateway on http://0.0.0.0:9999
📡 [INFO  ] 🔧 Debug mode: ON
📡 [INFO  ] 📦 Loaded 2 services:
📡 [INFO  ]   1. prefix: /user/ => localhost:8888
📡 [INFO  ]   2. path: POST /my/login/ => localhost:6666
📡 [INFO  ] 🚀 Gateway listening on http://0.0.0.0:9999
...
```

## 🧪 Health Check

Send a request to:

```bash
GET /__health
```

Response:

```
✅ Gateway is healthy
```

## 🔄 Hot Reload
To reload the configuration without restarting the gateway:

Open the terminal running the gateway.

Type r and press Enter.

This will re-read config.json and apply changes immediately with minimal downtime.

## 🧹 Lint & Format

```bash
bun lint
bun format
```

Or using biome:

```bash
bun x biome check .
bun x biome format . --write
```

## 📄 License

MIT License

© 2025 Max Base
