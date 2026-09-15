const path = require("node:path");

function readRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  // Render supplies this URL itself. Never derive the allowlist from request headers.
  const renderOrigin = production && env.RENDER === "true" ? env.RENDER_EXTERNAL_URL : "";
  const rawOrigins = env.CLIENT_ORIGIN || renderOrigin || (production ? "" : "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000");
  const origins = rawOrigins.split(",").map(value => value.trim()).filter(Boolean);
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error("CLIENT_ORIGIN must contain complete web origins."); }
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) || (production && url.protocol !== "https:")) {
      throw new Error("CLIENT_ORIGIN must contain exact origins without paths; production requires HTTPS.");
    }
  }
  if (production && !origins.length) throw new Error("CLIENT_ORIGIN is required in production.");
  const proxy = env.TRUST_PROXY || "false";
  let trustProxy;
  if (proxy === "false") trustProxy = false;
  else if (/^[1-9]\d?$/.test(proxy)) trustProxy = Number(proxy);
  else if (proxy === "loopback") trustProxy = "loopback";
  else throw new Error("TRUST_PROXY must be false, loopback, or an explicitly verified proxy hop count.");
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  return { production, origins, trustProxy, port,
    clientDir: path.resolve(__dirname, "../../client/dist"),
    mediaDir: path.resolve(env.QUESTION_MEDIA_DIR || path.join(__dirname, "../data/question-media")),
  };
}

function validateStartup(env = process.env) {
  const config = readRuntimeConfig(env);
  if (!env.MONGO_URI || !/^mongodb(?:\+srv)?:\/\//.test(env.MONGO_URI)) throw new Error("A valid MONGO_URI is required.");
  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 48 || /replace[-_ ]|change[-_ ]?me|example|isolated-test/i.test(env.JWT_SECRET)) {
    throw new Error("JWT_SECRET must be a newly generated random secret of at least 48 characters.");
  }
  if (config.production) {
    const parameters = new URLSearchParams(env.MONGO_URI.split("?")[1] || "");
    const options = new Map([...parameters].map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]));
    if (options.get("tls") === "false" || options.get("ssl") === "false" ||
        ["tlsinsecure", "tlsallowinvalidcertificates", "tlsallowinvalidhostnames"].some(key => options.get(key) === "true")) {
      throw new Error("Production MongoDB connections must verify TLS certificates.");
    }
    if (!env.MONGO_URI.startsWith("mongodb+srv://") && options.get("tls") !== "true" && options.get("ssl") !== "true") {
      throw new Error("Production MONGO_URI must enable TLS or use mongodb+srv.");
    }
  }
  return config;
}

module.exports = { readRuntimeConfig, validateStartup };
