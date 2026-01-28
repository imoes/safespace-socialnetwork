const PROXY_CONFIG = {
  "/api": {
    target: "http://backend:8000",
    secure: false,
    changeOrigin: true,
    logLevel: "debug",
    headers: {
      Connection: "keep-alive"
    },
    onProxyReq: (proxyReq, req, res) => {
      // Stelle sicher, dass Authorization-Header weitergeleitet wird
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Required for Cross-Origin-Embedder-Policy: require-corp (needed by FFmpeg WASM)
      proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
    },
    onError: (err, req, res) => {
      console.error('[PROXY] Error:', err.message);
    }
  }
};

module.exports = PROXY_CONFIG;
