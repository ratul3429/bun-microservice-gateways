console.log("Hello via Bun!");

const server = Bun.serve({
  port: 9999,
  fetch(req) {
    console.log(req);
    const url = new URL(req.url);
    console.log(url);
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Gateway running at http://localhost:${server.port}`);
