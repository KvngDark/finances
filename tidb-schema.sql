CREATE TABLE IF NOT EXISTS finance_incomes (
  id VARCHAR(36) PRIMARY KEY,
  amount DECIMAL(12, 2) NOT NULL,
  occurred_at DATE NOT NULL,
  source VARCHAR(280) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_finance_incomes_occurred_at (occurred_at)
);

CREATE TABLE IF NOT EXISTS finance_expenses (
  id VARCHAR(36) PRIMARY KEY,
  category VARCHAR(40) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  occurred_at DATE NOT NULL,
  description VARCHAR(280) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_finance_expenses_occurred_at (occurred_at),
  INDEX idx_finance_expenses_category (category)
);
