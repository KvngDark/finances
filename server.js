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
const accountLimit = 3;
const defaultCategories = [
  { id: "combustivel", name: "Combustível", color: "#d89216" },
  { id: "dudas", name: "DUDAs", color: "#226c8a" },
  { id: "acertos", name: "Acertos", color: "#6658a6" },
  { id: "comissao", name: "Comissão", color: "#168a62" },
  { id: "salario", name: "Salário", color: "#c84b3f" },
  { id: "cartorio", name: "Cartório", color: "#7f5fb2" },
  { id: "taxas", name: "Taxas", color: "#7b6b54" },
  { id: "manutencao", name: "Manutenção", color: "#59656f" },
  { id: "outros", name: "Outros", color: "#8a5b3b" }
];
const allowedDocumentStatuses = new Set(["novo", "andamento", "pendente", "concluido"]);

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
  console.log(`Controle financeiro em http://${host}:${port} usando ${storage}.`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, storage: hasDatabaseConfig() ? "tidb" : "local-json" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, {
      storage: hasDatabaseConfig() ? "tidb" : "local-json",
      databaseConfigured: hasDatabaseConfig()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    sendJson(res, 200, {
      config: {
        storage: hasDatabaseConfig() ? "tidb" : "local-json",
        databaseConfigured: hasDatabaseConfig()
      },
      accounts: await listAccounts(),
      categories: await listCategories(),
      stores: await listStores(),
      documents: await listDocuments(),
      transactions: await listTransactions()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/accounts") {
    sendJson(res, 200, { accounts: await listAccounts() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/accounts") {
    const account = await createAccount(normalizeAccount(await readJsonBody(req)));
    sendJson(res, 201, { account });
    return;
  }

  const accountMatch = url.pathname.match(/^\/api\/accounts\/([a-zA-Z0-9-]+)$/);
  if (req.method === "PUT" && accountMatch) {
    const account = await updateAccount(accountMatch[1], normalizeAccount(await readJsonBody(req), true));
    sendJson(res, 200, { account });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/categories") {
    sendJson(res, 200, { categories: await listCategories() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/categories") {
    const category = await createCategory(normalizeCategory(await readJsonBody(req)));
    sendJson(res, 201, { category });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/stores") {
    sendJson(res, 200, { stores: await listStores() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/stores") {
    const store = await createStore(normalizeStore(await readJsonBody(req)));
    sendJson(res, 201, { store });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/documents") {
    sendJson(res, 200, { documents: await listDocuments() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/documents") {
    const document = await createDocument(normalizeDocument(await readJsonBody(req)));
    sendJson(res, 201, { document });
    return;
  }

  const documentMatch = url.pathname.match(/^\/api\/documents\/([a-zA-Z0-9-]+)$/);
  if (req.method === "PUT" && documentMatch) {
    const document = await updateDocument(documentMatch[1], normalizeDocument(await readJsonBody(req), true));
    sendJson(res, 200, { document });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/transactions") {
    sendJson(res, 200, { transactions: await listTransactions() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/transactions") {
    const transaction = await normalizeTransaction(await readJsonBody(req));
    await createTransaction(transaction);
    sendJson(res, 201, { transaction });
    return;
  }

  const transactionMatch = url.pathname.match(/^\/api\/transactions\/([a-zA-Z0-9-]+)$/);
  if (req.method === "PUT" && transactionMatch) {
    const transaction = await normalizeTransaction(await readJsonBody(req));
    const updated = await updateTransaction(transactionMatch[1], transaction);
    sendJson(res, 200, { transaction: updated });
    return;
  }

  if (req.method === "DELETE" && transactionMatch) {
    const removed = await deleteTransaction(transactionMatch[1]);
    sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: "Lançamento não encontrado." });
    return;
  }

  sendJson(res, 404, { error: "Rota não encontrada." });
}

function normalizeAccount(input, partial = false) {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  const initialBalance = Number(String(input.initialBalance ?? input.balance ?? "0").replace(",", "."));

  if (!partial || name) {
    if (name.length < 2) throw new HttpError(400, "Informe o nome da conta.");
  }

  if (!Number.isFinite(initialBalance)) {
    throw new HttpError(400, "Informe um saldo válido.");
  }

  return {
    name: name.slice(0, 80),
    initialBalance: Math.round(initialBalance * 100) / 100
  };
}

function normalizeCategory(input) {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new HttpError(400, "Informe o nome da categoria.");
  return {
    id: slugify(name),
    name: name.slice(0, 80),
    color: String(input.color || "#226c8a").trim().slice(0, 16)
  };
}

function normalizeStore(input) {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  const arrivalDate = String(input.arrivalDate || input.arrival_date || "").trim();
  if (name.length < 2) throw new HttpError(400, "Informe o nome da loja.");
  if (!isValidDateOnly(arrivalDate)) throw new HttpError(400, "Informe a data de chegada.");
  return { name: name.slice(0, 120), arrivalDate };
}

function normalizeDocument(input, partial = false) {
  const title = String(input.title || "").trim().replace(/\s+/g, " ");
  const storeId = String(input.storeId || input.store_id || "").trim() || null;
  const status = String(input.status || "novo").trim();
  const openedAt = String(input.openedAt || input.opened_at || "").trim() || toDateOnly(new Date());
  const notes = String(input.notes || "").trim().replace(/\s+/g, " ");

  if (!partial || title) {
    if (title.length < 2) throw new HttpError(400, "Informe o nome do documento.");
  }
  if (!allowedDocumentStatuses.has(status)) throw new HttpError(400, "Status inválido.");
  if (!isValidDateOnly(openedAt)) throw new HttpError(400, "Informe uma data válida para o documento.");

  return {
    title: title.slice(0, 160),
    storeId,
    status,
    openedAt,
    notes: notes.slice(0, 500)
  };
}

async function normalizeTransaction(input) {
  const kind = String(input.kind || "").trim();
  const category = kind === "expense" ? String(input.category || "").trim() : null;
  const accountId = String(input.accountId || input.account_id || "").trim();
  const documentId = String(input.documentId || input.document_id || "").trim() || null;
  const amount = Number(String(input.amount || "").replace(",", "."));
  const occurredAt = String(input.occurredAt || input.occurred_at || "").trim();
  const description = String(input.description || "").trim().replace(/\s+/g, " ");

  if (!allowedKinds.has(kind)) throw new HttpError(400, "Escolha se o lançamento é entrada ou saída.");
  if (!accountId) throw new HttpError(400, "Escolha a conta do lançamento.");
  if (!(await accountExists(accountId))) throw new HttpError(400, "Conta não encontrada.");

  if (kind === "expense") {
    const categories = await listCategories();
    if (!categories.some((item) => item.id === category)) throw new HttpError(400, "Categoria inválida.");
  }

  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Informe um valor maior que zero.");
  if (!isValidDateOnly(occurredAt)) throw new HttpError(400, "Informe uma data válida.");
  if (description.length < 3) {
    const target = kind === "income" ? "a origem da entrada" : "o gasto";
    throw new HttpError(400, `Descreva ${target} com pelo menos 3 caracteres.`);
  }

  return {
    id: crypto.randomUUID(),
    kind,
    category,
    accountId,
    documentId,
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
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toDateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function listAccounts() {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [rows] = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.initial_balance AS initialBalance,
        DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
        a.initial_balance + COALESCE(i.total, 0) - COALESCE(e.total, 0) AS currentBalance
      FROM finance_accounts a
      LEFT JOIN (
        SELECT account_id, SUM(amount) AS total FROM finance_incomes WHERE account_id IS NOT NULL GROUP BY account_id
      ) i ON i.account_id = a.id
      LEFT JOIN (
        SELECT account_id, SUM(amount) AS total FROM finance_expenses WHERE account_id IS NOT NULL GROUP BY account_id
      ) e ON e.account_id = a.id
      ORDER BY a.created_at ASC
    `);
    return rows.map(mapAccountRow);
  }

  const store = await readLocalStore();
  return computeLocalAccounts(store);
}

async function createAccount(account) {
  const accounts = await listAccounts();
  if (accounts.length >= accountLimit) throw new HttpError(400, "O limite é de 3 contas.");
  const created = { id: crypto.randomUUID(), ...account, createdAt: new Date().toISOString() };

  if (hasDatabaseConfig()) {
    const pool = await getPool();
    await pool.execute(
      "INSERT INTO finance_accounts (id, name, initial_balance, created_at) VALUES (?, ?, ?, ?)",
      [created.id, created.name, created.initialBalance, new Date(created.createdAt)]
    );
    return { ...created, currentBalance: created.initialBalance };
  }

  const store = await readLocalStore();
  store.accounts.push(created);
  await writeLocalStore(store);
  return { ...created, currentBalance: created.initialBalance };
}

async function updateAccount(id, account) {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    await pool.execute("UPDATE finance_accounts SET name = ?, initial_balance = ? WHERE id = ?", [
      account.name,
      account.initialBalance,
      id
    ]);
    const updated = (await listAccounts()).find((item) => item.id === id);
    if (!updated) throw new HttpError(404, "Conta não encontrada.");
    return updated;
  }

  const store = await readLocalStore();
  const target = store.accounts.find((item) => item.id === id);
  if (!target) throw new HttpError(404, "Conta não encontrada.");
  target.name = account.name;
  target.initialBalance = account.initialBalance;
  await writeLocalStore(store);
  return computeLocalAccounts(store).find((item) => item.id === id);
}

async function accountExists(id) {
  return (await listAccounts()).some((account) => account.id === id);
}

async function listCategories() {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT id, name, color FROM finance_categories ORDER BY created_at ASC");
    return rows;
  }

  const store = await readLocalStore();
  return store.categories;
}

async function createCategory(category) {
  const categories = await listCategories();
  if (categories.some((item) => item.id === category.id)) throw new HttpError(400, "Categoria já existe.");

  if (hasDatabaseConfig()) {
    const pool = await getPool();
    await pool.execute("INSERT INTO finance_categories (id, name, color) VALUES (?, ?, ?)", [
      category.id,
      category.name,
      category.color
    ]);
    return category;
  }

  const store = await readLocalStore();
  store.categories.push(category);
  await writeLocalStore(store);
  return category;
}

async function listStores() {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [rows] = await pool.query(`
      SELECT id, name, DATE_FORMAT(arrival_date, '%Y-%m-%d') AS arrivalDate,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
      FROM finance_stores
      ORDER BY arrival_date DESC, created_at DESC
    `);
    return rows;
  }

  const store = await readLocalStore();
  return [...store.stores].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
}

async function createStore(storeInput) {
  const store = { id: crypto.randomUUID(), ...storeInput, createdAt: new Date().toISOString() };

  if (hasDatabaseConfig()) {
    const pool = await getPool();
    await pool.execute("INSERT INTO finance_stores (id, name, arrival_date, created_at) VALUES (?, ?, ?, ?)", [
      store.id,
      store.name,
      store.arrivalDate,
      new Date(store.createdAt)
    ]);
    return store;
  }

  const local = await readLocalStore();
  local.stores.push(store);
  await writeLocalStore(local);
  return store;
}

async function listDocuments() {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [rows] = await pool.query(`
      SELECT
        d.id,
        d.title,
        d.store_id AS storeId,
        s.name AS storeName,
        d.status,
        DATE_FORMAT(d.opened_at, '%Y-%m-%d') AS openedAt,
        d.notes,
        DATE_FORMAT(d.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
        COALESCE(i.total, 0) AS incomeTotal,
        COALESCE(e.total, 0) AS expenseTotal,
        COALESCE(i.total, 0) - COALESCE(e.total, 0) AS profit
      FROM finance_documents d
      LEFT JOIN finance_stores s ON s.id = d.store_id
      LEFT JOIN (
        SELECT document_id, SUM(amount) AS total FROM finance_incomes WHERE document_id IS NOT NULL GROUP BY document_id
      ) i ON i.document_id = d.id
      LEFT JOIN (
        SELECT document_id, SUM(amount) AS total FROM finance_expenses WHERE document_id IS NOT NULL GROUP BY document_id
      ) e ON e.document_id = d.id
      ORDER BY d.opened_at DESC, d.created_at DESC
    `);
    return rows.map(mapDocumentRow);
  }

  const store = await readLocalStore();
  return computeLocalDocuments(store);
}

async function createDocument(documentInput) {
  const document = { id: crypto.randomUUID(), ...documentInput, createdAt: new Date().toISOString() };

  if (hasDatabaseConfig()) {
    const pool = await getPool();
    await pool.execute(
      "INSERT INTO finance_documents (id, title, store_id, status, opened_at, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [document.id, document.title, document.storeId, document.status, document.openedAt, document.notes, new Date(document.createdAt)]
    );
    return { ...document, incomeTotal: 0, expenseTotal: 0, profit: 0 };
  }

  const store = await readLocalStore();
  store.documents.push(document);
  await writeLocalStore(store);
  return computeLocalDocuments(store).find((item) => item.id === document.id);
}

async function updateDocument(id, documentInput) {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    await pool.execute(
      "UPDATE finance_documents SET title = ?, store_id = ?, status = ?, opened_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [documentInput.title, documentInput.storeId, documentInput.status, documentInput.openedAt, documentInput.notes, id]
    );
    const updated = (await listDocuments()).find((item) => item.id === id);
    if (!updated) throw new HttpError(404, "Documento não encontrado.");
    return updated;
  }

  const store = await readLocalStore();
  const target = store.documents.find((item) => item.id === id);
  if (!target) throw new HttpError(404, "Documento não encontrado.");
  Object.assign(target, documentInput, { updatedAt: new Date().toISOString() });
  await writeLocalStore(store);
  return computeLocalDocuments(store).find((item) => item.id === id);
}

async function listTransactions() {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [rows] = await pool.query(`
      SELECT id, kind, category, accountId, documentId, amount, occurredAt, description, createdAt
      FROM (
        SELECT
          id,
          'income' AS kind,
          NULL AS category,
          account_id AS accountId,
          document_id AS documentId,
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
          account_id AS accountId,
          document_id AS documentId,
          amount,
          DATE_FORMAT(occurred_at, '%Y-%m-%d') AS occurredAt,
          description,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
        FROM finance_expenses
      ) AS movements
      ORDER BY occurredAt DESC, createdAt DESC
    `);
    return rows.map(mapTransactionRow);
  }

  const store = await readLocalStore();
  return store.transactions;
}

async function createTransaction(transaction) {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    if (transaction.kind === "income") {
      await pool.execute(
        "INSERT INTO finance_incomes (id, account_id, document_id, amount, occurred_at, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          transaction.id,
          transaction.accountId,
          transaction.documentId,
          transaction.amount,
          transaction.occurredAt,
          transaction.description,
          new Date(transaction.createdAt)
        ]
      );
      return;
    }

    await pool.execute(
      "INSERT INTO finance_expenses (id, account_id, document_id, category, amount, occurred_at, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        transaction.id,
        transaction.accountId,
        transaction.documentId,
        transaction.category,
        transaction.amount,
        transaction.occurredAt,
        transaction.description,
        new Date(transaction.createdAt)
      ]
    );
    return;
  }

  const store = await readLocalStore();
  store.transactions.unshift(transaction);
  await writeLocalStore(store);
}

async function updateTransaction(id, transaction) {
  const existing = (await listTransactions()).find((item) => item.id === id);
  if (!existing) throw new HttpError(404, "Lançamento não encontrado.");

  const updated = {
    ...transaction,
    id,
    createdAt: existing.createdAt || new Date().toISOString()
  };

  if (hasDatabaseConfig()) {
    const removed = await deleteTransaction(id);
    if (!removed) throw new HttpError(404, "Lançamento não encontrado.");
    await createTransaction(updated);
    return updated;
  }

  const store = await readLocalStore();
  store.transactions = store.transactions.map((item) => (item.id === id ? updated : item));
  await writeLocalStore(store);
  return updated;
}

async function deleteTransaction(id) {
  if (hasDatabaseConfig()) {
    const pool = await getPool();
    const [incomeResult] = await pool.execute("DELETE FROM finance_incomes WHERE id = ?", [id]);
    if (incomeResult.affectedRows > 0) return true;
    const [expenseResult] = await pool.execute("DELETE FROM finance_expenses WHERE id = ?", [id]);
    return expenseResult.affectedRows > 0;
  }

  const store = await readLocalStore();
  const next = store.transactions.filter((transaction) => transaction.id !== id);
  const removed = next.length !== store.transactions.length;
  store.transactions = next;
  await writeLocalStore(store);
  return removed;
}

async function readLocalStore() {
  await fsp.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fsp.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    const store = Array.isArray(parsed) ? { ...emptyStore(), transactions: parsed } : { ...emptyStore(), ...parsed };
    store.accounts = Array.isArray(store.accounts) ? store.accounts : [];
    store.categories = mergeDefaultCategories(store.categories);
    store.stores = Array.isArray(store.stores) ? store.stores : [];
    store.documents = Array.isArray(store.documents) ? store.documents : [];
    store.transactions = Array.isArray(store.transactions) ? store.transactions.map(normalizeStoredTransaction) : [];
    return store;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const store = emptyStore();
    await writeLocalStore(store);
    return store;
  }
}

async function writeLocalStore(store) {
  await fsp.mkdir(dataDir, { recursive: true });
  const ordered = {
    accounts: store.accounts,
    categories: store.categories,
    stores: store.stores,
    documents: store.documents,
    transactions: [...store.transactions].sort((a, b) => {
      const dateOrder = String(b.occurredAt).localeCompare(String(a.occurredAt));
      return dateOrder || String(b.createdAt).localeCompare(String(a.createdAt));
    })
  };
  await fsp.writeFile(dataFile, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
}

function emptyStore() {
  return {
    accounts: [],
    categories: defaultCategories,
    stores: [],
    documents: [],
    transactions: []
  };
}

function mergeDefaultCategories(categories = []) {
  const byId = new Map(defaultCategories.map((category) => [category.id, category]));
  categories.forEach((category) => {
    if (category && category.id) byId.set(category.id, category);
  });
  return [...byId.values()];
}

function normalizeStoredTransaction(transaction) {
  return {
    ...transaction,
    accountId: transaction.accountId || transaction.account_id || "",
    documentId: transaction.documentId || transaction.document_id || null,
    category: transaction.kind === "expense" ? transaction.category : null
  };
}

function computeLocalAccounts(store) {
  return store.accounts.map((account) => {
    const income = store.transactions
      .filter((transaction) => transaction.accountId === account.id && transaction.kind === "income")
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const expense = store.transactions
      .filter((transaction) => transaction.accountId === account.id && transaction.kind === "expense")
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    return {
      ...account,
      initialBalance: Number(account.initialBalance || 0),
      currentBalance: Number(account.initialBalance || 0) + income - expense
    };
  });
}

function computeLocalDocuments(store) {
  return store.documents.map((document) => {
    const storeInfo = store.stores.find((item) => item.id === document.storeId);
    const incomeTotal = store.transactions
      .filter((transaction) => transaction.documentId === document.id && transaction.kind === "income")
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const expenseTotal = store.transactions
      .filter((transaction) => transaction.documentId === document.id && transaction.kind === "expense")
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    return {
      ...document,
      storeName: storeInfo ? storeInfo.name : "",
      incomeTotal,
      expenseTotal,
      profit: incomeTotal - expenseTotal
    };
  });
}

function mapAccountRow(row) {
  return {
    id: row.id,
    name: row.name,
    initialBalance: Number(row.initialBalance),
    currentBalance: Number(row.currentBalance),
    createdAt: row.createdAt
  };
}

function mapDocumentRow(row) {
  return {
    id: row.id,
    title: row.title,
    storeId: row.storeId,
    storeName: row.storeName || "",
    status: row.status,
    openedAt: row.openedAt,
    notes: row.notes || "",
    createdAt: row.createdAt,
    incomeTotal: Number(row.incomeTotal),
    expenseTotal: Number(row.expenseTotal),
    profit: Number(row.profit)
  };
}

function mapTransactionRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    accountId: row.accountId || "",
    documentId: row.documentId || null,
    amount: Number(row.amount),
    occurredAt: row.occurredAt,
    description: row.description,
    createdAt: row.createdAt
  };
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      let mysql;
      try {
        mysql = await import("mysql2/promise");
      } catch {
        throw new HttpError(500, "O pacote mysql2 não está instalado. Rode npm install antes de usar o TiDB.");
      }

      const pool = mysql.createPool(await buildMysqlConfig());
      if (!schemaReady && shouldAutoCreateSchema()) {
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
  if (String(process.env.TIDB_SSL || "true").toLowerCase() === "false") return null;

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
    CREATE TABLE IF NOT EXISTS finance_accounts (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      initial_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      color VARCHAR(16) NOT NULL DEFAULT '#226c8a',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS finance_stores (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      arrival_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS finance_documents (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      store_id VARCHAR(36) NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'novo',
      opened_at DATE NOT NULL,
      notes VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS finance_incomes (
      id VARCHAR(36) PRIMARY KEY,
      account_id VARCHAR(36) NULL,
      document_id VARCHAR(36) NULL,
      amount DECIMAL(12, 2) NOT NULL,
      occurred_at DATE NOT NULL,
      source VARCHAR(280) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_finance_incomes_account (account_id),
      INDEX idx_finance_incomes_document (document_id),
      INDEX idx_finance_incomes_occurred_at (occurred_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS finance_expenses (
      id VARCHAR(36) PRIMARY KEY,
      account_id VARCHAR(36) NULL,
      document_id VARCHAR(36) NULL,
      category VARCHAR(40) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      occurred_at DATE NOT NULL,
      description VARCHAR(280) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_finance_expenses_account (account_id),
      INDEX idx_finance_expenses_document (document_id),
      INDEX idx_finance_expenses_occurred_at (occurred_at),
      INDEX idx_finance_expenses_category (category)
    )
  `);

  await addColumnIfMissing(pool, "finance_incomes", "account_id", "VARCHAR(36) NULL");
  await addColumnIfMissing(pool, "finance_incomes", "document_id", "VARCHAR(36) NULL");
  await addColumnIfMissing(pool, "finance_expenses", "account_id", "VARCHAR(36) NULL");
  await addColumnIfMissing(pool, "finance_expenses", "document_id", "VARCHAR(36) NULL");
  await seedDefaultCategories(pool);
  await migrateLegacyTransactions(pool);
}

async function addColumnIfMissing(pool, table, column, definition) {
  const [columns] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (columns.length) return;
  await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function seedDefaultCategories(pool) {
  for (const category of defaultCategories) {
    await pool.execute("INSERT IGNORE INTO finance_categories (id, name, color) VALUES (?, ?, ?)", [
      category.id,
      category.name,
      category.color
    ]);
  }
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

function shouldAutoCreateSchema() {
  return String(process.env.TIDB_AUTO_SCHEMA || "true").toLowerCase() !== "false";
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new HttpError(413, "Conteúdo muito grande.");
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "JSON inválido.");
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

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
