CREATE TABLE IF NOT EXISTS finance_accounts (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  initial_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_categories (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#226c8a',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_stores (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  arrival_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_documents (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  store_id VARCHAR(36) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'novo',
  opened_at DATE NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

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
);

INSERT IGNORE INTO finance_categories (id, name, color) VALUES
  ('combustivel', 'Combustível', '#d89216'),
  ('dudas', 'DUDAs', '#226c8a'),
  ('acertos', 'Acertos', '#6658a6'),
  ('comissao', 'Comissão', '#168a62'),
  ('salario', 'Salário', '#c84b3f'),
  ('cartorio', 'Cartório', '#7f5fb2'),
  ('taxas', 'Taxas', '#7b6b54'),
  ('manutencao', 'Manutenção', '#59656f'),
  ('outros', 'Outros', '#8a5b3b');
