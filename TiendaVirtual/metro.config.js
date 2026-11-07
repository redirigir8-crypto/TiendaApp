// Configuración de Metro: necesaria para que expo-sqlite funcione en web
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SQLite en web usa un archivo .wasm
config.resolver.assetExts.push('wasm');

// Encabezados que pide SQLite en el navegador
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
