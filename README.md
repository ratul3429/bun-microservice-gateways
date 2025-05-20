# bun-microservice-gateways

## Install

```
$ bun install
```

## Features

- Bun
- Super fast
- Typescript
- many more...


Note: We have a feature to reload routes, feel free to just type `r` and enter in the CLI, to reload the gateway easily without needs to stopping and restarting to decrease the down time...

## Config

`config.json` file:

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

## Running

```
$ bun start
📡 [INFO  2025-05-20T07:58:19.296Z] 🔁 Configuration loaded
📡 [INFO  2025-05-20T07:58:19.297Z] 🚀 Starting Gateway on http://0.0.0.0:9999
📡 [INFO  2025-05-20T07:58:19.297Z] 🔧 Debug mode: ON
📡 [INFO  2025-05-20T07:58:19.297Z] 📦 Loaded 2 services:
📡 [INFO  2025-05-20T07:58:19.298Z]   1. prefix: /user/ => localhost:8888
📡 [INFO  2025-05-20T07:58:19.298Z]   2. path: POST /my/login/ => localhost:6666
📡 [INFO  2025-05-20T07:58:19.305Z] 🚀 Gateway listening on http://0.0.0.0:9999
🐛 [DEBUG 2025-05-20T07:58:39.576Z] 📥 Incoming: GET /
🐛 [DEBUG 2025-05-20T07:58:39.577Z] ❓ No match found for GET /
🐛 [DEBUG 2025-05-20T07:58:41.671Z] 📥 Incoming: GET /__health
🐛 [DEBUG 2025-05-20T07:58:47.029Z] 📥 Incoming: GET /404
🐛 [DEBUG 2025-05-20T07:58:47.029Z] ❓ No match found for GET /404
...
```

4. Run lint and format

```bash
bun x biome check .
bun x biome format . --write
```

## License

Copyright 2025, Max Base

License MIT
