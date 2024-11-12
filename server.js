const http = require("http");
const url = require("url");
const net = require("net");
const HttpProxy = require("http-proxy");

// Create a new proxy server instance
const proxy = HttpProxy.createProxyServer({});

// List of URLs to block
const blockedUrls = ["youtube.com", "blockedsite.com"];

// Function to check if a URL is blocked
function isBlockedUrl(targetUrl) {
  return blockedUrls.some((blockedUrl) => targetUrl.includes(blockedUrl));
}

// Function to intercept and modify requests
function interceptRequest(req, res) {
  // Hide client IP by removing headers that reveal it
  delete req.headers["x-forwarded-for"];
  delete req.headers["x-real-ip"];

  // Log requests
  console.log(`Proxying request to: ${req.url}`);

  // Custom header for tracking (optional)
  req.headers["x-proxy-server"] = "IT4263-Proxy";
}

// Create HTTP server to handle HTTP requests
const server = http.createServer((req, res) => {
  const target = req.url;

  // Check if the URL is blocked
  if (isBlockedUrl(target)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Access to this site is blocked by the proxy server.");
    return;
  }

  // Intercept and modify request
  interceptRequest(req, res);

  // Determine the protocol (HTTP or HTTPS) and proxy the request
  const targetUrl = url.parse(target);

  // Forward the request using the proxy
  proxy.web(
    req,
    res,
    { target: `${targetUrl.protocol}//${targetUrl.host}` },
    (err) => {
      if (err) {
        console.error(`Proxy error: ${err.message}`);
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Bad Gateway: Unable to process the request");
      }
    }
  );
});

// Handle HTTPS tunneling with the CONNECT method
server.on("connect", (req, clientSocket, head) => {
  const { port, hostname } = new URL(`http://${req.url}`);

  // Check if the URL is blocked
  if (isBlockedUrl(hostname)) {
    clientSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    clientSocket.end();
    return;
  }

  // Create a TCP connection to the target server
  const serverSocket = net.connect(port || 443, hostname, () => {
    // Notify the client that the connection is established
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    // Pipe the data between the client and the server
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  // Handle errors on the server and client sockets
  serverSocket.on("error", (err) => {
    console.error("Server socket error:", err);
    clientSocket.end();
  });

  clientSocket.on("error", (err) => {
    console.error("Client socket error:", err);
    serverSocket.end();
  });
});

// Start the server
const port = 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Proxy server listening on port ${port}`);
});
