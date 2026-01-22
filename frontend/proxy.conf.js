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
        console.log('[PROXY] Forwarding Authorization header:', req.headers.authorization.substring(0, 20) + '...');
        proxyReq.setHeader('Authorization', req.headers.authorization);
      } else {
        console.log('[PROXY] No Authorization header found in request');
      }

      // Log alle Headers für Debugging
      console.log('[PROXY] Request headers:', Object.keys(req.headers));
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log('[PROXY] Response status:', proxyRes.statusCode, 'for', req.url);
    },
    onError: (err, req, res) => {
      console.error('[PROXY] Error:', err.message);
    }
  }
};

module.exports = PROXY_CONFIG;
