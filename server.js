const express = require('express');
const path = require('path');
const os = require('os');
const db = require('./db');

const APP_VERSION = process.env.APP_VERSION || 'v2';
const APP_COLOR = process.env.APP_COLOR || 'green';
const SIMULATE_FAILURE = process.env.SIMULATE_FAILURE === 'true';

const parsedStartupDelay = Number(
  process.env.STARTUP_DELAY_SECONDS || 0
);

const STARTUP_DELAY_SECONDS =
  Number.isFinite(parsedStartupDelay) && parsedStartupDelay >= 0
    ? parsedStartupDelay
    : 0;

const STARTED_AT = Date.now();

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (req, res) => {
  const elapsedSeconds = (Date.now() - STARTED_AT) / 1000;

  if (elapsedSeconds < STARTUP_DELAY_SECONDS) {
    return res.status(503).json({
      status: 'starting',
      ready: false,
      elapsedSeconds: Math.floor(elapsedSeconds),
      requiredSeconds: STARTUP_DELAY_SECONDS,
    });
  }

  if (SIMULATE_FAILURE || !db.canAccessDb()) {
    return res.status(500).json({
      status: 'error',
      ready: false,
      reason: 'fallo simulado o base de datos no accesible',
    });
  }

  return res.status(200).json({
    status: 'ok',
    ready: true,
  });
});

  app.get('/version', (req, res) => {
    res.status(200).json({
      version: APP_VERSION,
      color: APP_COLOR,
      hostname: os.hostname(),
    });
  });

  app.get('/api/products', (req, res) => {
    res.status(200).json(db.getAll());
  });

  app.get('/api/products/:id', (req, res) => {
    const product = db.getById(req.params.id);
    if (!product) return res.status(404).json({ error: 'producto no encontrado' });
    res.status(200).json(product);
  });

  app.post('/api/products', (req, res) => {
    const { name, sku, stock, price } = req.body || {};
    if (!name || !sku) {
      return res.status(400).json({ error: 'name y sku son obligatorios' });
    }
    const product = db.create({ name, sku, stock, price });
    res.status(201).json(product);
  });

  app.patch('/api/products/:id', (req, res) => {
    const updated = db.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'producto no encontrado' });
    res.status(200).json(updated);
  });

  app.delete('/api/products/:id', (req, res) => {
    const removed = db.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'producto no encontrado' });
    res.status(204).send();
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('Servidor escuchando en puerto ' + PORT + ' (version=' + APP_VERSION + ', color=' + APP_COLOR + ')');
  });
}

module.exports = { createApp };
