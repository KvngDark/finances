import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

loadEnvFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "transactions.json");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const allowedKinds = new Set(["income", "expense"]);
const allowedCategories = new Set([
  "combustivel",
  "dudas",
  "acertos",
  "comissao",
  "salario",
  "taxas",
  "manutencao",
  "outros"
]);

let poolPromise;
let schemaReady = false;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStaticFile(res, url.pathname);
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Erro interno no servidor." : error.message;
    if (status === 500) {
      console.error(error);
    }
    sendJson(res, status, { error: message });
  }
});

server.listen(port, host, () => {
  const storage = hasDatabaseConfig() ? "TiDB" : "arquivo local";
  console.log(`Financeiro do despachante em http://${host}:${port} usando ${storage}.`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      storage: hasDatabaseConfig() ? "tidb" : "local-json"
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, {
      storage: hasDatabaseConfig() ? "tidb" : "local-json",
      databaseConfigured: hasDatabaseConfig()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/transactions") {
    const transactions = await listTransactions();
    sendJson(res, 200, { transactions });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/transactions") {
    const body = await readJsonBody(req);
    const transaction = normalizeTransaction(body);
    await createTransaction(transaction);
    sendJson(res, 201, { transaction });
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/transactions\/([a-zA-Z0-9-]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const removed = await deleteTransaction(deleteMatch[1]);
    sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: "Lançamento não encontrado." });
    return;
  }

  sendJson(res, 404, { error: "Rota não encontrada." });
}

function normalizeTransaction(input) {
  const kind = String(input.kind || "").trim();
  const category = kind === "expense" ? String(input.category || "").trim() : null;
  const amount = Number(String(input.amount || "").replace(",", "."));
  const occurredAt = String(input.occurredAt || input.occurred_at || "").trim();
  const description = String(input.description || "").trim().replace(/\s+/g, " ");

  if (!allowedKinds.has(kind)) {
    throw new HttpError(400, "Escolha se o lançamento é entrada ou saída.");
  }

  if (kind === "expense" && !allowedCategories.has(category)) {
    throw new HttpError(400, "Categoria invalida.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Informe um valor maior que zero.");
  }

  if (!isValidDateOnly(occurredAt)) {
    throw new HttpError(400, "Informe uma data valida.");
  }

  if (description.length < 3) {
    const descriptionTarget = kind === "income" ? "a origem da entrada" : "o gasto";
    throw new HttpError(400, `Descreva ${descriptionTarget} com pelo menos 3 caracteres.`);
  }

  return {
    id: crypto.randomUUID(),
    kind,
    category,
    amount: Math.round(amount * 100) / 100,
    occurredAt,
    description: description.slice(0, 280),
    createdAt: new Date().toISOString()
  };
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

async function listTransactions() {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [rows] = await pool.query(`
      SELECT
        id, kind, category, amount, occurredAt, description, createdAt
      FROM (
        SELECT
          id,
          'income' AS kind,
          NULL AS category,
          amount,
          DATE_FORMAT(occurred_at, '%Y-%m-%d') AS occurredAt,
          source AS description,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
        FROM finance_incomes
        UNION ALL
        SELECT
          id,
          'expense' AS kind,
          category,
          amount,
          DATE_FORMAT(occurred_at, '%Y-%m-%d') AS occurredAt,
          description,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
        FROM finance_expenses
      ) AS movements
      ORDER BY occurredAt DESC, createdAt DESC
    `);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      category: row.category,
      amount: Number(row.amount),
      occurredAt: row.occurredAt,
      description: row.description,
      createdAt: row.createdAt
    }));
  }

  return readLocalTransactions();
}

async function createTransaction(transaction) {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    if (transaction.kind === "income") {
      await pool.execute(
        `
          INSERT INTO finance_incomes
            (id, amount, occurred_at, source, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          transaction.id,
          transaction.amount,
          transaction.occurredAt,
          transaction.description,
          new Date(transaction.createdAt)
        ]
      );
      return;
    }

    await pool.execute(
      `
        INSERT INTO finance_expenses
          (id, category, amount, occurred_at, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        transaction.id,
        transaction.category,
        transaction.amount,
        transaction.occurredAt,
        transaction.description,
        new Date(transaction.createdAt)
      ]
    );
    return;
  }

  const transactions = await readLocalTransactions();
  transactions.unshift(transaction);
  await writeLocalTransactions(transactions);
}

async function deleteTransaction(id) {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [incomeResult] = await pool.execute("DELETE FROM finance_incomes WHERE id = ?", [id]);
    if (incomeResult.affectedRows > 0) return true;

    const [expenseResult] = await pool.execute("DELETE FROM finance_expenses WHERE id = ?", [id]);
    return expenseResult.affectedRows > 0;
  }

  const transactions = await readLocalTransactions();
  const next = transactions.filter((transaction) => transaction.id !== id);
  await writeLocalTransactions(next);
  return next.length !== transactions.length;
}

async function readLocalTransactions() {
  await fsp.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fsp.readFile(dataFile, "utf8");
    const transactions = JSON.parse(raw);
    return Array.isArray(transactions) ? transactions : [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeLocalTransactions([]);
    return [];
  }
}

async function writeLocalTransactions(transactions) {
  await fsp.mkdir(dataDir, { recursive: true });
  const ordered = [...transactions].sort((a, b) => {
    const dateOrder = String(b.occurredAt).localeCompare(String(a.occurredAt));
    return dateOrder || String(b.createdAt).localeCompare(String(a.createdAt));
  });
  await fsp.writeFile(dataFile, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      let mysql;
      try {
        mysql = await import("mysql2/promise");
      } catch (error) {
        throw new HttpError(
          500,
          "O pacote mysql2 não está instalado. Rode npm install antes de usar o TiDB."
        );
      }

      const pool = mysql.createPool(await buildMysqlConfig());
      if (!schemaReady) {
        await ensureSchema(pool);
        schemaReady = true;
      }
      return pool;
    })();
  }

  return poolPromise;
}

async function buildMysqlConfig() {
  const base = process.env.DATABASE_URL ? configFromDatabaseUrl() : configFromTidbEnv();
  const ssl = await getSslConfig();

  return {
    ...base,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 8),
    queueLimit: 0,
    decimalNumbers: true,
    dateStrings: true,
    ...(ssl ? { ssl } : {})
  };
}

function configFromDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 4000),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, ""))
  };
}

function configFromTidbEnv() {
  return {
    host: process.env.TIDB_HOST,
    port: Number(process.env.TIDB_PORT || 4000),
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE
  };
}

async function getSslConfig() {
  if (String(process.env.TIDB_SSL || "true").toLowerCase() === "false") {
    return null;
  }

  const ssl = {
    minVersion: "TLSv1.2",
    rejectUnauthorized: String(process.env.TIDB_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false"
  };

  if (process.env.TIDB_CA_CERT) {
    ssl.ca = await fsp.readFile(process.env.TIDB_CA_CERT, "utf8");
  }

  return ssl;
}

async function ensureSchema(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS finance_incomes (
      id VARCHAR(36) PRIMARY KEY,
      amount DECIMAL(12, 2) NOT NULL,
      occurred_at DATE NOT NULL,
      source VARCHAR(280) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_finance_incomes_occurred_at (occurred_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS finance_expenses (
      id VARCHAR(36) PRIMARY KEY,
      category VARCHAR(40) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      occurred_at DATE NOT NULL,
      description VARCHAR(280) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_finance_expenses_occurred_at (occurred_at),
      INDEX idx_finance_expenses_category (category)
    )
  `);

  await migrateLegacyTransactions(pool);
}

async function migrateLegacyTransactions(pool) {
  const [legacyTables] = await pool.query("SHOW TABLES LIKE 'finance_transactions'");
  if (!legacyTables.length) return;

  await pool.execute(`
    INSERT IGNORE INTO finance_incomes
      (id, amount, occurred_at, source, created_at)
    SELECT id, amount, occurred_at, description, created_at
    FROM finance_transactions
    WHERE kind = 'income'
  `);

  await pool.execute(`
    INSERT IGNORE INTO finance_expenses
      (id, category, amount, occurred_at, description, created_at)
    SELECT id, category, amount, occurred_at, description, created_at
    FROM finance_transactions
    WHERE kind = 'expense'
  `);
}

function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL || process.env.TIDB_HOST);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new HttpError(413, "Conteudo muito grande.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "JSON invalido.");
  }
}

async function serveStaticFile(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.normalize(path.join(publicDir, decodedPath));
  const relativePath = path.relative(publicDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendText(res, 403, "Acesso negado.");
    return;
  }

  try {
    const file = await fsp.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store"
    });
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      const index = await fsp.readFile(path.join(publicDir, "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(index);
      return;
    }
    throw error;
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
  };
  return types[ext] || "application/octet-stream";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(text);
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
