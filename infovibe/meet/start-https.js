const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const certPath = path.join(__dirname, "..", "localhost.crt");
const keyPath = path.join(__dirname, "..", "localhost.key");

const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

process.env.PORT = "3199";
const meetApp = require("./server.js");

const httpsServer = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    { hostname: "127.0.0.1", port: 3199, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  req.pipe(proxyReq);
  proxyReq.on("error", () => res.statusCode = 502 && res.end());
});

httpsServer.on("upgrade", (req, socket, head) => {
  const proxyReq = http.request({
    hostname: "127.0.0.1", port: 3199, path: req.url, method: req.method,
    headers: { ...req.headers, connection: "upgrade", upgrade: req.headers.upgrade },
  });
  proxyReq.on("upgrade", (proxyRes, proxySocket) => {
    socket.write("HTTP/1.1 101 Switching Protocols\r\n" + Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n");
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });
  proxyReq.end(head);
});

httpsServer.listen(3100, "0.0.0.0", () => {
  console.log("Meet server HTTPS running on https://0.0.0.0:3100");
});