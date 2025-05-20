// TYPES
type ServiceConfig = {
  prefix?: string;
  path?: string;
  method?: string;
  host: string;
  port: number;
};

type Config = {
  host: string;
  port: number;
  services: ServiceConfig[];
};

// VARIABLES
const config: Config = await Bun.file("config.json").json();

// FUNCTIONS
async function forwardRequest(req: Request, svc: ServiceConfig): Promise<Response> {
  const reqUrl = new URL(req.url);
  const targetUrl = `http://${svc.host}:${svc.port}${reqUrl.pathname}${reqUrl.search}`;

  try {
    const originalHeaders = req.headers;
    const headers = new Headers(originalHeaders);

    headers.delete("host");
    headers.delete("connection");
    headers.delete("keep-alive");
    headers.delete("proxy-authenticate");
    headers.delete("proxy-authorization");
    headers.delete("te");
    headers.delete("trailers");
    headers.delete("transfer-encoding");
    headers.delete("upgrade");

    headers.set("host", `${svc.host}:${svc.port}`);
    headers.set("origin", `http://${svc.host}:${svc.port}`);

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    headers.set("x-forwarded-for", clientIp);

    const forwardedReq = new Request(targetUrl, {
      method: req.method,
      headers,
      body: req.body,
      redirect: "manual",
    });

    const response = await fetch(forwardedReq);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error(`Gateway error while forwarding to ${targetUrl}:`, error);
    return new Response("Bad Gateway", { status: 502 });
  }
}

// INIT
console.log(`Loaded config with ${config.services.length} services`);

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  async fetch(req: Request) {
    const reqUrl = new URL(req.url);
    const pathname = reqUrl.pathname;
    const method = req.method.toUpperCase();

    const exactMatch = config.services.find(
      (svc) => svc.path === pathname && svc.method === method
    );

    if (exactMatch) {
      return forwardRequest(req, exactMatch);
    }

    const prefixMatch = config.services.find(
      (svc) => svc.prefix && pathname.startsWith(svc.prefix)
    );

    if (prefixMatch) {
      return forwardRequest(req, prefixMatch);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Gateway is running on http://${config.host}:${config.port}`);
