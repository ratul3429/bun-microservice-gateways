// TYPES
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

// CONFIG LOADING
let config: Config = await loadConfig();
let DEBUG = config.debug ?? false;

async function loadConfig(): Promise<Config> {
  const cfg = await Bun.file("config.json").json();
  console.clear();
  logInfo("🔁 Configuration loaded");

  logInfo(`🚀 Starting Gateway on http://${cfg.host}:${cfg.port}`);
  logInfo(`🔧 Debug mode: ${(cfg.debug ?? false) ? "ON" : "OFF"}`);
  logInfo(`📦 Loaded ${cfg.services.length} services:`);

  cfg.services.forEach((svc: ServiceConfig, i: number) => {
    const label = svc.path ? `path: ${svc.method} ${svc.path}` : `prefix: ${svc.prefix}`;
    logInfo(`  ${i + 1}. ${label} => ${svc.host}:${svc.port}`);
  });

  return cfg;
}

// LOGGING
function logDebug(message: string) {
  if (DEBUG) console.log(`🐛 [DEBUG ${new Date().toISOString()}] ${message}`);
}

function logInfo(message: string) {
  console.log(`📡 [INFO ${new Date().toISOString()}] ${message}`);
}

function logError(message: string) {
  console.error(`❌ [ERROR ${new Date().toISOString()}] ${message}`);
}

// UTILITIES
function sanitizeHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers);
  const hopByHopHeaders = [
    "host", "connection", "keep-alive", "proxy-authenticate",
    "proxy-authorization", "te", "trailers",
    "transfer-encoding", "upgrade"
  ];
  hopByHopHeaders.forEach((h) => sanitized.delete(h));
  return sanitized;
}

function buildTargetUrl(req: Request, svc: ServiceConfig): string {
  const reqUrl = new URL(req.url);
  return `http://${svc.host}:${svc.port}${reqUrl.pathname}${reqUrl.search}`;
}

function prepareForwardedRequest(req: Request, svc: ServiceConfig, targetUrl: string): Request {
  const headers = sanitizeHeaders(req.headers);
  headers.set("host", `${svc.host}:${svc.port}`);
  headers.set("origin", `http://${svc.host}:${svc.port}`);
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  headers.set("x-forwarded-for", clientIp);

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
  } catch (error) {
    logError(`💥 Failed to forward to ${targetUrl}: ${error}`);
    return new Response("Bad Gateway", { status: 502 });
  }
}

function matchService(req: Request): ServiceConfig | undefined {
  const reqUrl = new URL(req.url);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  const exactMatch = config.services.find(
    (svc) => svc.active !== false && svc.path === pathname && svc.method === method
  );
  if (exactMatch) {
    logDebug(`✅ Exact match: ${method} ${pathname}`);
    return exactMatch;
  }

  const prefixMatch = config.services.find(
    (svc) => svc.active !== false && svc.prefix && pathname.startsWith(svc.prefix)
  );
  if (prefixMatch) {
    logDebug(`🔎 Prefix match: ${pathname} starts with ${prefixMatch.prefix}`);
    return prefixMatch;
  }

  logDebug(`❓ No match found for ${method} ${pathname}`);
  return undefined;
}

// Server
Bun.serve({
  hostname: config.host,
  port: config.port,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    logDebug(`📥 Incoming: ${req.method} ${pathname}`);

    // Health check route
    if (pathname === "/__health") {
      return new Response("✅ Gateway is healthy", { status: 200 });
    }

    const svc = matchService(req);
    if (svc) return forwardRequest(req, svc);

    return new Response("❌ Not Found", { status: 404 });
  }
});

// Reload config with 'r' key
const reader = Bun.stdin.stream().getReader();
async function readStdin() {
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const command = new TextDecoder().decode(value).trim();

    console.log(`📥 [STDIN] Received chunk: ${command}`);
    if (command === "r") {
      logInfo("🔄 Reloading configuration...");
      config = await loadConfig();
      logInfo("🔁 Configuration reloaded");
    } else {
      logError(`❌ Unknown command: ${command}`);
    }
  }
}
readStdin();
