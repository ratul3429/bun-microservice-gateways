// --- TYPES ---
interface ServiceConfig {
  prefix?: string;
  path?: string;
  method?: string;
  host: string;
  port: number;
  active?: boolean;
}

interface Config {
  host: string;
  port: number;
  services: ServiceConfig[];
  debug?: boolean;
}

// --- LOGGING ---
function formatLog(level: string, emoji: string, message: string) {
  return `${emoji} [${level} ${new Date().toISOString()}] ${message}`;
}

function logDebug(message: string) {
  if (DEBUG) console.log(formatLog("DEBUG", "🐛", message));
}

function logInfo(message: string) {
  console.log(formatLog("INFO", "📡", message));
}

function logError(message: string) {
  console.error(formatLog("ERROR", "❌", message));
}

// --- CONFIG LOADING ---
let config: Config;
let DEBUG = false;

async function loadConfig(): Promise<Config> {
  const cfg = await Bun.file("config.json").json();

  cfg.services = cfg.services.map((svc: ServiceConfig) => ({
    ...svc,
    method: svc.method?.toUpperCase(),
    active: svc.active !== false,
  }));

  DEBUG = cfg.debug ?? false;

  console.clear();
  logInfo("🔁 Configuration loaded");

  logInfo(`🚀 Starting Gateway on http://${cfg.host}:${cfg.port}`);
  logInfo(`🔧 Debug mode: ${DEBUG ? "ON" : "OFF"}`);
  logInfo(`📦 Loaded ${cfg.services.length} services:`);

  cfg.services.forEach((svc: ServiceConfig, i: number) => {
    const label = svc.path
      ? `path: ${svc.method} ${svc.path}`
      : svc.prefix
      ? `prefix: ${svc.prefix}`
      : "<no path or prefix>";
    logInfo(`  ${i + 1}. ${label} => ${svc.host}:${svc.port}`);
  });

  return cfg;
}

// --- UTILITIES ---
function sanitizeHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers);
  const hopByHopHeaders = [
    "connection", "keep-alive", "proxy-authenticate",
    "proxy-authorization", "te", "trailers",
    "transfer-encoding", "upgrade"
  ];
  hopByHopHeaders.forEach(h => sanitized.delete(h));
  return sanitized;
}

function buildTargetUrl(req: Request, svc: ServiceConfig): string {
  const reqUrl = new URL(req.url);
  return `http://${svc.host}:${svc.port}${reqUrl.pathname}${reqUrl.search}`;
}

function prepareForwardedRequest(req: Request, svc: ServiceConfig, targetUrl: string): Request {
  const headers = sanitizeHeaders(req.headers);

  if (!headers.has("host")) {
    headers.set("host", `${svc.host}:${svc.port}`);
  }

  headers.set("origin", `http://${svc.host}:${svc.port}`);

  const originalXFF = req.headers.get("x-forwarded-for");
  const clientIp = req.headers.get("cf-connecting-ip") || "unknown";
  const xff = originalXFF ? `${originalXFF}, ${clientIp}` : clientIp;
  headers.set("x-forwarded-for", xff);

  return new Request(targetUrl, {
    method: req.method,
    headers,
    body: req.body,
    redirect: "manual",
  });
}

async function forwardRequest(req: Request, svc: ServiceConfig): Promise<Response> {
  const targetUrl = buildTargetUrl(req, svc);
  logDebug(`➡️ Forwarding request to: ${targetUrl}`);

  try {
    const forwardedReq = prepareForwardedRequest(req, svc, targetUrl);
    const response = await fetch(forwardedReq);
    logDebug(`⬅️ Received ${response.status} from ${svc.host}:${svc.port}`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.stack || error.message : String(error);
    logError(`💥 Failed to forward to ${targetUrl}: ${errMsg}`);
    return new Response("Bad Gateway", { status: 502 });
  }
}

function matchService(req: Request): ServiceConfig | undefined {
  const reqUrl = new URL(req.url);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  const exactMatch = config.services.find(
    svc => svc.active && svc.path === pathname && svc.method === method
  );
  if (exactMatch) {
    logDebug(`✅ Exact match: ${method} ${pathname}`);
    return exactMatch;
  }

  const prefixMatch = config.services.find(
    svc => svc.active && svc.prefix && pathname.startsWith(svc.prefix)
  );
  if (prefixMatch) {
    logDebug(`🔎 Prefix match: ${pathname} starts with ${prefixMatch.prefix}`);
    return prefixMatch;
  }

  logDebug(`❓ No match found for ${method} ${pathname}`);
  return undefined;
}

// --- SERVER SETUP ---
async function startServer() {
  config = await loadConfig();

  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    async fetch(req: Request) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      logDebug(`📥 Incoming: ${req.method} ${pathname}`);

      if (pathname === "/__health") {
        return new Response("✅ Gateway is healthy", { status: 200 });
      }

      const svc = matchService(req);
      if (svc) return forwardRequest(req, svc);

      return new Response("❌ Not Found", { status: 404 });
    },
  });

  logInfo(`🚀 Gateway listening on http://${config.host}:${config.port}`);

  process.on("SIGINT", () => {
    logInfo("🛑 Received SIGINT. Shutting down...");
    server.stop();
    process.exit(0);
  });

  readStdin();
}

// --- STDIN COMMAND HANDLER ---
const reader = Bun.stdin.stream().getReader();
async function readStdin() {
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const command = new TextDecoder().decode(value).trim();

    logInfo(`📥 [STDIN] Received command: ${command}`);
    if (command === "r") {
      logInfo("🔄 Reloading configuration on command...");
      config = await loadConfig();
      logInfo("🔁 Configuration reloaded");
    } else {
      logError(`❌ Unknown command: ${command}`);
    }
  }
}

// --- START ---
startServer().catch(err => {
  logError(`Failed to start server: ${(err as Error).stack || err}`);
  process.exit(1);
});
