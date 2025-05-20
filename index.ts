// TYPES
interface ServiceConfig {
  prefix?: string;
  path?: string;
  method?: string;
  host: string;
  port: number;
}

interface Config {
  host: string;
  port: number;
  services: ServiceConfig[];
  debug?: boolean;
}

// GLOBALS
const config: Config = await Bun.file("config.json").json();
const DEBUG = config.debug ?? false;

// LOGGING
function logDebug(message: string) {
  if (DEBUG) console.log(`🐛 [DEBUG] ${message}`);
}

function logInfo(message: string) {
  console.log(`📡 [INFO] ${message}`);
}

function logError(message: string) {
  console.error(`❌ [ERROR] ${message}`);
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
  logDebug(`Forwarding request to: ${targetUrl}`);

  try {
    const forwardedReq = prepareForwardedRequest(req, svc, targetUrl);
    const response = await fetch(forwardedReq);
    logDebug(`Received response: ${response.status} ${response.statusText}`);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    logError(`Gateway error while forwarding to ${targetUrl}: ${error}`);
    return new Response("Bad Gateway", { status: 502 });
  }
}

function matchService(req: Request): ServiceConfig | undefined {
  const reqUrl = new URL(req.url);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  const exactMatch = config.services.find(
    (svc) => svc.path === pathname && svc.method === method
  );
  if (exactMatch) {
    logDebug(`Matched exact route: ${method} ${pathname}`);
    return exactMatch;
  }

  const prefixMatch = config.services.find(
    (svc) => svc.prefix && pathname.startsWith(svc.prefix)
  );
  if (prefixMatch) {
    logDebug(`Matched prefix route: ${pathname} starts with ${prefixMatch.prefix}`);
    return prefixMatch;
  }

  logDebug(`No matching service found for: ${method} ${pathname}`);
  return undefined;
}

// INIT
logInfo(`Loaded config with ${config.services.length} services`);
logInfo(`Gateway starting on http://${config.host}:${config.port}`);

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  async fetch(req: Request) {
    logDebug(`Incoming request: ${req.method} ${new URL(req.url).pathname}`);
    const svc = matchService(req);

    if (svc) return forwardRequest(req, svc);

    return new Response("Not Found", { status: 404 });
  },
});
