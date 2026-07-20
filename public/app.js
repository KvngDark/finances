const fallbackCategories = [
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

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];
const shortMonthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const statusLabels = {
  novo: "Novo",
  andamento: "Em andamento",
  pendente: "Pendente",
  concluido: "Concluído"
};
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const state = {
  accounts: [],
  categories: fallbackCategories,
  stores: [],
  documents: [],
  transactions: [],
  selectedMonth: new Date().getMonth(),
  selectedYear: new Date().getFullYear(),
  activeView: "dashboardView",
  categoryFilter: "all",
  editingTransactionId: null,
  isSaving: false
};

const els = {
  storageBadge: document.querySelector("#storageBadge"),
  refreshButton: document.querySelector("#refreshButton"),
  viewTabs: document.querySelectorAll(".view-tab"),
  views: document.querySelectorAll(".view"),
  periodTitle: document.querySelector("#periodTitle"),
  yearSelect: document.querySelector("#yearSelect"),
  monthRail: document.querySelector("#monthRail"),
  netMonth: document.querySelector("#netMonth"),
  netMonthHint: document.querySelector("#netMonthHint"),
  incomeMonth: document.querySelector("#incomeMonth"),
  incomeCount: document.querySelector("#incomeCount"),
  expenseMonth: document.querySelector("#expenseMonth"),
  expenseCount: document.querySelector("#expenseCount"),
  yearNet: document.querySelector("#yearNet"),
  yearHint: document.querySelector("#yearHint"),
  bestMonthBadge: document.querySelector("#bestMonthBadge"),
  flowChart: document.querySelector("#flowChart"),
  balanceDonut: document.querySelector("#balanceDonut"),
  donutValue: document.querySelector("#donutValue"),
  transactionForm: document.querySelector("#transactionForm"),
  accountSelect: document.querySelector("#accountSelect"),
  amountInput: document.querySelector("#amountInput"),
  dateInput: document.querySelector("#dateInput"),
  transactionDocumentSelect: document.querySelector("#transactionDocumentSelect"),
  categoryField: document.querySelector("#categoryField"),
  categorySelect: document.querySelector("#categorySelect"),
  descriptionLabel: document.querySelector("#descriptionLabel"),
  descriptionInput: document.querySelector("#descriptionInput"),
  transactionSubmitButton: document.querySelector("#transactionSubmitButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  formMessage: document.querySelector("#formMessage"),
  categoryBars: document.querySelector("#categoryBars"),
  categoryFilterSelect: document.querySelector("#categoryFilterSelect"),
  incomeTransactionsList: document.querySelector("#incomeTransactionsList"),
  expenseTransactionsList: document.querySelector("#expenseTransactionsList"),
  incomeTableCount: document.querySelector("#incomeTableCount"),
  expenseTableCount: document.querySelector("#expenseTableCount"),
  transactionCount: document.querySelector("#transactionCount"),
  accountForm: document.querySelector("#accountForm"),
  accountLimitBadge: document.querySelector("#accountLimitBadge"),
  accountNameInput: document.querySelector("#accountNameInput"),
  accountBalanceInput: document.querySelector("#accountBalanceInput"),
  accountMessage: document.querySelector("#accountMessage"),
  accountsList: document.querySelector("#accountsList"),
  accountMonthlyBalances: document.querySelector("#accountMonthlyBalances"),
  documentForm: document.querySelector("#documentForm"),
  documentTitleInput: document.querySelector("#documentTitleInput"),
  documentStoreSelect: document.querySelector("#documentStoreSelect"),
  documentDateInput: document.querySelector("#documentDateInput"),
  documentStatusSelect: document.querySelector("#documentStatusSelect"),
  documentNotesInput: document.querySelector("#documentNotesInput"),
  documentMessage: document.querySelector("#documentMessage"),
  documentMovementForm: document.querySelector("#documentMovementForm"),
  movementDocumentSelect: document.querySelector("#movementDocumentSelect"),
  movementKindSelect: document.querySelector("#movementKindSelect"),
  movementAccountSelect: document.querySelector("#movementAccountSelect"),
  movementAmountInput: document.querySelector("#movementAmountInput"),
  movementDateInput: document.querySelector("#movementDateInput"),
  movementCategoryField: document.querySelector("#movementCategoryField"),
  movementCategorySelect: document.querySelector("#movementCategorySelect"),
  movementDescriptionLabel: document.querySelector("#movementDescriptionLabel"),
  movementDescriptionInput: document.querySelector("#movementDescriptionInput"),
  movementMessage: document.querySelector("#movementMessage"),
  documentsList: document.querySelector("#documentsList"),
  storeForm: document.querySelector("#storeForm"),
  storeNameInput: document.querySelector("#storeNameInput"),
  storeArrivalDateInput: document.querySelector("#storeArrivalDateInput"),
  storeMessage: document.querySelector("#storeMessage"),
  storesList: document.querySelector("#storesList"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryNameInput: document.querySelector("#categoryNameInput"),
  categoryColorInput: document.querySelector("#categoryColorInput"),
  categoryMessage: document.querySelector("#categoryMessage"),
  categoriesList: document.querySelector("#categoriesList")
};

bootstrap();

async function bootstrap() {
  buildMonthRail();
  setDefaultDates();
  bindEvents();
  await refreshAll();
}

function bindEvents() {
  els.refreshButton.addEventListener("click", refreshAll);
  els.yearSelect.addEventListener("change", () => {
    state.selectedYear = Number(els.yearSelect.value);
    renderDashboard();
  });

  els.viewTabs.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  els.categorySelect.addEventListener("change", updateKindFields);
  els.categoryFilterSelect.addEventListener("change", () => {
    state.categoryFilter = els.categoryFilterSelect.value;
    renderDashboard();
  });
  els.movementKindSelect.addEventListener("change", updateMovementKindFields);
  els.transactionForm.addEventListener("submit", handleTransactionSubmit);
  els.cancelEditButton.addEventListener("click", resetTransactionForm);
  els.accountForm.addEventListener("submit", handleAccountSubmit);
  els.documentForm.addEventListener("submit", handleDocumentSubmit);
  els.documentMovementForm.addEventListener("submit", handleDocumentMovementSubmit);
  els.storeForm.addEventListener("submit", handleStoreSubmit);
  els.categoryForm.addEventListener("submit", handleCategorySubmit);
  window.addEventListener("resize", debounce(drawCharts, 150));

  document.querySelectorAll('input[name="kind"]').forEach((radio) => {
    radio.addEventListener("change", updateKindFields);
  });
}

async function refreshAll() {
  setMessage(els.formMessage, "Atualizando...");
  try {
    const payload = await fetchJson("/api/bootstrap");
    state.accounts = payload.accounts || [];
    state.categories = payload.categories?.length ? payload.categories : fallbackCategories;
    state.stores = payload.stores || [];
    state.documents = payload.documents || [];
    state.transactions = payload.transactions || [];
    els.storageBadge.textContent = payload.config?.databaseConfigured ? "TiDB conectado" : "Modo local";
    els.storageBadge.title = payload.config?.databaseConfigured
      ? "Os lançamentos estão sendo gravados no TiDB."
      : "Sem credenciais do TiDB, os lançamentos ficam em arquivo local.";
    setMessage(els.formMessage, "");
    syncYearOptions();
    renderAll();
  } catch (error) {
    els.storageBadge.textContent = "Sem conexão";
    setMessage(els.formMessage, error.message || "Não foi possível carregar os dados.", true);
  }
}

function renderAll() {
  renderSelects();
  updateKindFields();
  updateMovementKindFields();
  renderDashboard();
  renderAccounts();
  renderStores();
  renderCategories();
  renderDocuments();
}

function showView(viewId) {
  state.activeView = viewId;
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.viewTabs.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  drawCharts();
}

function buildMonthRail() {
  els.monthRail.innerHTML = "";
  shortMonthNames.forEach((month, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "month-button";
    button.textContent = month;
    button.addEventListener("click", () => {
      state.selectedMonth = index;
      renderDashboard();
    });
    els.monthRail.append(button);
  });
}

function setDefaultDates() {
  const today = toDateInputValue(new Date());
  els.dateInput.value = today;
  els.documentDateInput.value = today;
  els.movementDateInput.value = today;
  els.storeArrivalDateInput.value = today;
}

function syncYearOptions() {
  const years = new Set([state.selectedYear, new Date().getFullYear()]);
  state.transactions.forEach((transaction) => years.add(Number(transaction.occurredAt.slice(0, 4))));
  els.yearSelect.innerHTML = [...years]
    .filter(Boolean)
    .sort((a, b) => b - a)
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
  els.yearSelect.value = String(state.selectedYear);
}

function renderSelects() {
  const accountOptions = state.accounts.length
    ? state.accounts.map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`).join("")
    : '<option value="">Cadastre uma conta</option>';
  els.accountSelect.innerHTML = accountOptions;
  els.movementAccountSelect.innerHTML = accountOptions;

  const categoryOptions = state.categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("");
  els.categorySelect.innerHTML = categoryOptions;
  els.movementCategorySelect.innerHTML = categoryOptions;
  els.categoryFilterSelect.innerHTML = `<option value="all">Todas as categorias</option>${categoryOptions}`;
  els.categoryFilterSelect.value = state.categoryFilter;
  if (els.categoryFilterSelect.value !== state.categoryFilter) {
    state.categoryFilter = "all";
    els.categoryFilterSelect.value = "all";
  }

  const documentOptions = state.documents
    .map((document) => `<option value="${document.id}">${escapeHtml(document.title)}</option>`)
    .join("");
  els.transactionDocumentSelect.innerHTML = `<option value="">Sem documento</option>${documentOptions}`;
  els.movementDocumentSelect.innerHTML = documentOptions || '<option value="">Cadastre um documento</option>';

  const storeOptions = state.stores
    .map((store) => `<option value="${store.id}">${escapeHtml(store.name)}</option>`)
    .join("");
  els.documentStoreSelect.innerHTML = `<option value="">Sem loja</option>${storeOptions}`;
}

function updateKindFields() {
  const kind = getSelectedKind();
  if (kind === "income") {
    els.categoryField.hidden = true;
    els.categorySelect.required = false;
    els.categorySelect.disabled = true;
    els.descriptionLabel.textContent = "Origem da entrada";
    els.descriptionInput.placeholder = "Ex.: Primeira licença Jeep Recreio";
    return;
  }

  const selected = findCategory(els.categorySelect.value);
  els.categoryField.hidden = false;
  els.categorySelect.required = true;
  els.categorySelect.disabled = false;
  els.descriptionLabel.textContent = "Descrição do gasto";
  els.descriptionInput.placeholder = `Ex.: ${selected ? selected.name : "Cartório do processo"}`;
}

function updateMovementKindFields() {
  const kind = els.movementKindSelect.value;
  if (kind === "income") {
    els.movementCategoryField.hidden = true;
    els.movementCategorySelect.required = false;
    els.movementCategorySelect.disabled = true;
    els.movementDescriptionLabel.textContent = "Origem da entrada";
    els.movementDescriptionInput.placeholder = "Ex.: Pagamento do cliente";
    return;
  }

  els.movementCategoryField.hidden = false;
  els.movementCategorySelect.required = true;
  els.movementCategorySelect.disabled = false;
  els.movementDescriptionLabel.textContent = "Descrição do gasto";
  els.movementDescriptionInput.placeholder = "Ex.: Cartório do processo";
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  if (state.isSaving) return;
  const kind = getSelectedKind();
  const payload = {
    kind,
    accountId: els.accountSelect.value,
    amount: els.amountInput.value.trim(),
    occurredAt: els.dateInput.value,
    documentId: els.transactionDocumentSelect.value,
    description: els.descriptionInput.value.trim()
  };
  if (kind === "expense") payload.category = els.categorySelect.value;
  await saveTransaction(payload, els.formMessage, () => {
    els.amountInput.value = "";
    els.descriptionInput.value = "";
  }, { allowEdit: true, resetMainForm: true });
}

async function handleDocumentMovementSubmit(event) {
  event.preventDefault();
  const kind = els.movementKindSelect.value;
  const payload = {
    kind,
    accountId: els.movementAccountSelect.value,
    amount: els.movementAmountInput.value.trim(),
    occurredAt: els.movementDateInput.value,
    documentId: els.movementDocumentSelect.value,
    description: els.movementDescriptionInput.value.trim()
  };
  if (kind === "expense") payload.category = els.movementCategorySelect.value;
  await saveTransaction(payload, els.movementMessage, () => {
    els.movementAmountInput.value = "";
    els.movementDescriptionInput.value = "";
  });
}

async function saveTransaction(payload, messageElement, onSuccess, options = {}) {
  state.isSaving = true;
  setMessage(messageElement, "Salvando...");
  try {
    const isEditing = Boolean(options.allowEdit && state.editingTransactionId);
    const response = await fetchJson(isEditing ? `/api/transactions/${state.editingTransactionId}` : "/api/transactions", {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.selectedMonth = Number(payload.occurredAt.slice(5, 7)) - 1;
    state.selectedYear = Number(payload.occurredAt.slice(0, 4));
    onSuccess();
    if (options.resetMainForm) resetTransactionForm();
    await refreshAll();
    setMessage(messageElement, isEditing ? "Lançamento atualizado." : "Lançamento adicionado.");
  } catch (error) {
    setMessage(messageElement, error.message || "Não foi possível salvar.", true);
  } finally {
    state.isSaving = false;
  }
}

function startEditTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  state.editingTransactionId = id;
  document.querySelector(`#kind${transaction.kind === "income" ? "Income" : "Expense"}`).checked = true;
  els.accountSelect.value = transaction.accountId || "";
  els.amountInput.value = String(transaction.amount).replace(".", ",");
  els.dateInput.value = transaction.occurredAt;
  els.transactionDocumentSelect.value = transaction.documentId || "";
  els.descriptionInput.value = transaction.description;
  if (transaction.kind === "expense") {
    els.categorySelect.value = transaction.category || "";
  }
  updateKindFields();
  els.transactionSubmitButton.textContent = "Salvar edição";
  els.cancelEditButton.hidden = false;
  showView("dashboardView");
  els.transactionForm.scrollIntoView({ behavior: "smooth", block: "center" });
  setMessage(els.formMessage, "Editando lançamento.");
}

function resetTransactionForm() {
  state.editingTransactionId = null;
  els.transactionForm.reset();
  document.querySelector("#kindIncome").checked = true;
  els.dateInput.value = toDateInputValue(new Date());
  els.transactionSubmitButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14"></path>
      <path d="M5 12h14"></path>
    </svg>
    Adicionar
  `;
  els.cancelEditButton.hidden = true;
  renderSelects();
  updateKindFields();
}

async function handleAccountSubmit(event) {
  event.preventDefault();
  setMessage(els.accountMessage, "Salvando...");
  try {
    await fetchJson("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: els.accountNameInput.value,
        balance: els.accountBalanceInput.value
      })
    });
    els.accountForm.reset();
    await refreshAll();
    setMessage(els.accountMessage, "Conta salva.");
  } catch (error) {
    setMessage(els.accountMessage, error.message || "Não foi possível salvar a conta.", true);
  }
}

async function handleDocumentSubmit(event) {
  event.preventDefault();
  setMessage(els.documentMessage, "Salvando...");
  try {
    await fetchJson("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: els.documentTitleInput.value,
        storeId: els.documentStoreSelect.value,
        openedAt: els.documentDateInput.value,
        status: els.documentStatusSelect.value,
        notes: els.documentNotesInput.value
      })
    });
    els.documentTitleInput.value = "";
    els.documentNotesInput.value = "";
    await refreshAll();
    setMessage(els.documentMessage, "Documento salvo.");
  } catch (error) {
    setMessage(els.documentMessage, error.message || "Não foi possível salvar o documento.", true);
  }
}

async function handleStoreSubmit(event) {
  event.preventDefault();
  setMessage(els.storeMessage, "Salvando...");
  try {
    await fetchJson("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: els.storeNameInput.value,
        arrivalDate: els.storeArrivalDateInput.value
      })
    });
    els.storeNameInput.value = "";
    await refreshAll();
    setMessage(els.storeMessage, "Loja salva.");
  } catch (error) {
    setMessage(els.storeMessage, error.message || "Não foi possível salvar a loja.", true);
  }
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  setMessage(els.categoryMessage, "Salvando...");
  try {
    await fetchJson("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: els.categoryNameInput.value,
        color: els.categoryColorInput.value
      })
    });
    els.categoryNameInput.value = "";
    await refreshAll();
    setMessage(els.categoryMessage, "Categoria adicionada.");
  } catch (error) {
    setMessage(els.categoryMessage, error.message || "Não foi possível adicionar a categoria.", true);
  }
}

async function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  if (!window.confirm(`Remover "${transaction.description}"?`)) return;

  try {
    await fetchJson(`/api/transactions/${id}`, { method: "DELETE" });
    await refreshAll();
    setMessage(els.formMessage, "Lançamento removido.");
  } catch (error) {
    setMessage(els.formMessage, error.message || "Não foi possível remover.", true);
  }
}

async function updateDocumentStatus(id, status) {
  const document = state.documents.find((item) => item.id === id);
  if (!document) return;
  try {
    await fetchJson(`/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...document, status })
    });
    await refreshAll();
  } catch (error) {
    setMessage(els.documentMessage, error.message || "Não foi possível atualizar o documento.", true);
  }
}

function renderDashboard() {
  const monthly = getMonthlySeries(state.selectedYear);
  const current = monthly[state.selectedMonth];
  const previous = getPreviousMonthSummary();
  const yearIncome = monthly.reduce((total, month) => total + month.income, 0);
  const yearExpense = monthly.reduce((total, month) => total + month.expense, 0);
  const yearNet = yearIncome - yearExpense;
  const incomeItems = current.items.filter((item) => item.kind === "income").length;
  const expenseItems = current.items.filter((item) => item.kind === "expense").length;

  els.periodTitle.textContent = `${monthNames[state.selectedMonth]} ${state.selectedYear}`;
  els.netMonth.textContent = money.format(current.net);
  els.netMonth.className = current.net >= 0 ? "positive" : "negative";
  els.netMonthHint.textContent = buildComparisonText(current.net, previous.net);
  els.incomeMonth.textContent = money.format(current.income);
  els.incomeCount.textContent = `${incomeItems} ${incomeItems === 1 ? "lançamento" : "lançamentos"}`;
  els.expenseMonth.textContent = money.format(current.expense);
  els.expenseCount.textContent = `${expenseItems} ${expenseItems === 1 ? "lançamento" : "lançamentos"}`;
  els.yearNet.textContent = money.format(yearNet);
  els.yearNet.className = yearNet >= 0 ? "positive" : "negative";
  els.yearHint.textContent = `${money.format(yearIncome)} em entradas`;

  const best = monthly.reduce((winner, month) => (month.net > winner.net ? month : winner), monthly[0]);
  els.bestMonthBadge.textContent = best.net ? `${shortMonthNames[best.month]} ${money.format(best.net)}` : "Sem saldo";

  document.querySelectorAll(".month-button").forEach((button, index) => {
    button.classList.toggle("active", index === state.selectedMonth);
  });

  renderDonut(current);
  renderCategoryBars(current);
  renderTransactions(current.items);
  drawCharts();
}

function renderDonut(summary) {
  const total = summary.income + summary.expense;
  const incomeAngle = total > 0 ? (summary.income / total) * 360 : 0;
  const margin = summary.income > 0 ? (summary.net / summary.income) * 100 : 0;
  els.balanceDonut.style.setProperty("--income-angle", `${incomeAngle}deg`);
  els.donutValue.textContent = `${numberFormat.format(margin)}%`;
  els.donutValue.className = summary.net >= 0 ? "positive" : "negative";
}

function renderCategoryBars(summary) {
  const totals = state.categories
    .map((category) => {
      const total = summary.items
        .filter((item) => item.category === category.id && item.kind === "expense")
        .reduce((sum, item) => sum + item.amount, 0);
      return { ...category, total };
    })
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!totals.length) {
    els.categoryBars.innerHTML = '<div class="empty-state">Sem saídas neste mês.</div>';
    return;
  }

  const max = totals[0].total;
  els.categoryBars.innerHTML = totals
    .map((category) => {
      const width = Math.max(6, (category.total / max) * 100);
      return `
        <div class="category-row">
          <span class="category-name">${escapeHtml(category.name)}</span>
          <div class="category-track">
            <div class="category-fill" style="width:${width}%; background:${category.color}"></div>
          </div>
          <span class="category-value">${money.format(category.total)}</span>
        </div>
      `;
    })
    .join("");
}

function renderTransactions(items) {
  const ordered = [...items].sort((a, b) => {
    const dateOrder = b.occurredAt.localeCompare(a.occurredAt);
    return dateOrder || b.createdAt.localeCompare(a.createdAt);
  });
  const hasCategoryFilter = state.categoryFilter !== "all";
  const filtered = hasCategoryFilter
    ? ordered.filter((transaction) => transaction.kind === "expense" && transaction.category === state.categoryFilter)
    : ordered;
  const incomeItems = filtered.filter((transaction) => transaction.kind === "income");
  const expenseItems = filtered.filter((transaction) => transaction.kind === "expense");

  els.transactionCount.textContent = `${filtered.length} ${filtered.length === 1 ? "item" : "itens"}`;
  els.incomeTableCount.textContent = `${incomeItems.length} ${incomeItems.length === 1 ? "item" : "itens"}`;
  els.expenseTableCount.textContent = `${expenseItems.length} ${expenseItems.length === 1 ? "item" : "itens"}`;

  renderTransactionGroup(
    els.incomeTransactionsList,
    incomeItems,
    hasCategoryFilter ? "Filtro de categoria mostra apenas saídas." : "Nenhuma entrada neste mês."
  );
  renderTransactionGroup(els.expenseTransactionsList, expenseItems, "Nenhuma saída neste mês.");
}

function renderTransactionGroup(container, items, emptyMessage) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = items
    .map((transaction) => {
      const category = findCategory(transaction.category);
      const account = findAccount(transaction.accountId);
      const document = findDocument(transaction.documentId);
      const sign = transaction.kind === "income" ? "+" : "-";
      const amountClass = transaction.kind === "income" ? "positive" : "negative";
      const iconText = transaction.kind === "income" ? "E" : "S";
      const detail = [
        account ? account.name : "Conta não informada",
        document ? document.title : null,
        transaction.kind === "expense" && category ? category.name : null
      ].filter(Boolean).join(" • ");
      return `
        <article class="transaction-row">
          <span class="transaction-icon ${transaction.kind}" aria-hidden="true">${iconText}</span>
          <div class="transaction-main">
            <p class="transaction-description">${escapeHtml(transaction.description)}</p>
            <div class="transaction-meta">
              <span>${formatDate(transaction.occurredAt)}</span>
              <span>${escapeHtml(detail)}</span>
            </div>
          </div>
          <strong class="transaction-amount ${amountClass}">${sign}${money.format(transaction.amount)}</strong>
          <button class="edit-button" type="button" data-id="${transaction.id}" aria-label="Editar lançamento">Editar</button>
          <button class="delete-button" type="button" data-id="${transaction.id}" aria-label="Remover lançamento">x</button>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.id));
  });
  container.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", () => startEditTransaction(button.dataset.id));
  });
}

function renderAccounts() {
  els.accountLimitBadge.textContent = `${state.accounts.length}/3`;
  if (!state.accounts.length) {
    els.accountsList.innerHTML = '<div class="empty-state">Cadastre as 3 contas da empresa.</div>';
    els.accountMonthlyBalances.innerHTML = '<div class="empty-state">Os saldos mensais aparecem depois que uma conta for cadastrada.</div>';
    return;
  }

  els.accountsList.innerHTML = state.accounts
    .map((account) => `
      <article class="account-card">
        <span class="metric-label">Conta</span>
        <h3>${escapeHtml(account.name)}</h3>
        <strong class="${account.currentBalance >= 0 ? "positive" : "negative"}">${money.format(account.currentBalance)}</strong>
        <small>Saldo inicial: ${money.format(account.initialBalance)}</small>
      </article>
    `)
    .join("");
  renderAccountMonthlyBalances();
}

function renderAccountMonthlyBalances() {
  els.accountMonthlyBalances.innerHTML = state.accounts
    .map((account) => {
      const rows = getAccountMonthlyBalances(account);
      return `
        <article class="balance-table-card">
          <div class="ledger-heading">
            <div>
              <p class="eyebrow">${state.selectedYear}</p>
              <h3>${escapeHtml(account.name)}</h3>
            </div>
            <strong class="${rows[rows.length - 1].endBalance >= 0 ? "positive" : "negative"}">
              ${money.format(rows[rows.length - 1].endBalance)}
            </strong>
          </div>
          <div class="balance-table">
            <div class="balance-table-header">
              <span>Mês</span>
              <span>Entrou</span>
              <span>Saiu</span>
              <span>Saldo final</span>
            </div>
            ${rows.map((row) => `
              <div class="balance-table-row ${row.month === state.selectedMonth ? "active" : ""}">
                <span>${shortMonthNames[row.month]}</span>
                <span class="positive">${money.format(row.income)}</span>
                <span class="negative">${money.format(row.expense)}</span>
                <strong class="${row.endBalance >= 0 ? "positive" : "negative"}">${money.format(row.endBalance)}</strong>
              </div>
            `).join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function getAccountMonthlyBalances(account) {
  let runningBalance = Number(account.initialBalance || 0);
  const yearStart = `${state.selectedYear}-01-01`;

  state.transactions
    .filter((transaction) => transaction.accountId === account.id && transaction.occurredAt < yearStart)
    .forEach((transaction) => {
      runningBalance += transaction.kind === "income" ? transaction.amount : -transaction.amount;
    });

  return Array.from({ length: 12 }, (_, month) => {
    const monthKey = `${state.selectedYear}-${String(month + 1).padStart(2, "0")}`;
    const movements = state.transactions.filter(
      (transaction) => transaction.accountId === account.id && transaction.occurredAt.startsWith(monthKey)
    );
    const income = movements
      .filter((transaction) => transaction.kind === "income")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const expense = movements
      .filter((transaction) => transaction.kind === "expense")
      .reduce((total, transaction) => total + transaction.amount, 0);
    runningBalance += income - expense;
    return { month, income, expense, endBalance: runningBalance };
  });
}

function renderStores() {
  if (!state.stores.length) {
    els.storesList.innerHTML = '<div class="empty-state">Nenhuma loja cadastrada.</div>';
    return;
  }
  els.storesList.innerHTML = state.stores
    .map((store) => `
      <article class="simple-row">
        <div>
          <strong>${escapeHtml(store.name)}</strong>
          <span>Chegada em ${formatDate(store.arrivalDate)}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderCategories() {
  els.categoriesList.innerHTML = state.categories
    .map((category) => `
      <article class="simple-row">
        <div>
          <strong>${escapeHtml(category.name)}</strong>
          <span>${category.id === "outros" ? "Use só quando não houver categoria melhor" : "Categoria de saída"}</span>
        </div>
        <i class="color-swatch" style="background:${category.color}"></i>
      </article>
    `)
    .join("");
}

function renderDocuments() {
  if (!state.documents.length) {
    els.documentsList.innerHTML = '<div class="empty-state">Nenhum documento lançado ainda.</div>';
    return;
  }

  els.documentsList.innerHTML = state.documents
    .map((document) => `
      <article class="document-card">
        <div class="document-card-top">
          <div>
            <p class="eyebrow">${escapeHtml(document.storeName || "Sem loja")}</p>
            <h3>${escapeHtml(document.title)}</h3>
          </div>
          <strong class="${document.profit >= 0 ? "positive" : "negative"}">${money.format(document.profit)}</strong>
        </div>
        <div class="document-stats">
          <span>Entradas: ${money.format(document.incomeTotal || 0)}</span>
          <span>Saídas: ${money.format(document.expenseTotal || 0)}</span>
          <span>Data: ${formatDate(document.openedAt)}</span>
        </div>
        <div class="document-actions">
          <select class="document-status-control" data-id="${document.id}">
            ${Object.entries(statusLabels).map(([value, label]) => `
              <option value="${value}" ${document.status === value ? "selected" : ""}>${label}</option>
            `).join("")}
          </select>
        </div>
        ${document.notes ? `<p class="document-notes">${escapeHtml(document.notes)}</p>` : ""}
      </article>
    `)
    .join("");

  els.documentsList.querySelectorAll(".document-status-control").forEach((select) => {
    select.addEventListener("change", () => updateDocumentStatus(select.dataset.id, select.value));
  });
}

function drawCharts() {
  const canvas = els.flowChart;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const series = getMonthlySeries(state.selectedYear);
  const padding = { top: 18, right: 22, bottom: 34, left: 58 };
  const chartWidth = rect.width - padding.left - padding.right;
  const chartHeight = rect.height - padding.top - padding.bottom;
  const maxValue = Math.max(100, ...series.flatMap((month) => [month.income, month.expense, Math.abs(month.net)]));

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#d9e3df";
  ctx.fillStyle = "#66706d";
  ctx.font = "12px system-ui, sans-serif";

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    const value = maxValue - (maxValue / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
    ctx.fillText(shortMoney(value), 8, y + 4);
  }

  const step = chartWidth / 12;
  const barWidth = Math.min(16, step * 0.24);
  const baseY = padding.top + chartHeight;
  const valueToY = (value) => baseY - (Math.max(0, value) / maxValue) * chartHeight;

  series.forEach((month, index) => {
    const centerX = padding.left + step * index + step / 2;
    const incomeHeight = (month.income / maxValue) * chartHeight;
    const expenseHeight = (month.expense / maxValue) * chartHeight;
    const hasIncome = month.income > 0;
    const hasExpense = month.expense > 0;

    if (hasIncome && hasExpense) {
      roundedBar(ctx, centerX - barWidth - 2, baseY - incomeHeight, barWidth, incomeHeight, "#168a62");
      roundedBar(ctx, centerX + 2, baseY - expenseHeight, barWidth, expenseHeight, "#c84b3f");
    } else if (hasIncome) {
      roundedBar(ctx, centerX - barWidth / 2, baseY - incomeHeight, barWidth, incomeHeight, "#168a62");
    } else if (hasExpense) {
      roundedBar(ctx, centerX - barWidth / 2, baseY - expenseHeight, barWidth, expenseHeight, "#c84b3f");
    }

    ctx.fillStyle = index === state.selectedMonth ? "#16201f" : "#66706d";
    ctx.font = `${index === state.selectedMonth ? 800 : 650} 12px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(shortMonthNames[index], centerX, rect.height - 10);
  });

  const points = series
    .map((month, index) => {
      if (!month.items.length) return null;
      return { x: padding.left + step * index + step / 2, y: valueToY(month.net), monthIndex: index };
    })
    .filter(Boolean);

  if (!points.length) return;

  ctx.strokeStyle = "#226c8a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (points.length > 1) drawSmoothLine(ctx, points);

  points.forEach((point) => {
    const index = point.monthIndex;
    ctx.beginPath();
    ctx.fillStyle = index === state.selectedMonth ? "#17443e" : "#ffffff";
    ctx.strokeStyle = "#226c8a";
    ctx.lineWidth = 2;
    ctx.arc(point.x, point.y, index === state.selectedMonth ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function drawSmoothLine(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleX = (previous.x + current.x) / 2;
    const middleY = (previous.y + current.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, middleX, middleY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function roundedBar(ctx, x, y, width, height, color) {
  if (height <= 0) return;
  const radius = Math.min(5, width / 2, height / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.fill();
}

function getMonthlySeries(year) {
  const months = Array.from({ length: 12 }, (_, month) => ({
    month,
    income: 0,
    expense: 0,
    net: 0,
    items: []
  }));

  state.transactions.forEach((transaction) => {
    const transactionYear = Number(transaction.occurredAt.slice(0, 4));
    if (transactionYear !== year) return;
    const monthIndex = Number(transaction.occurredAt.slice(5, 7)) - 1;
    const summary = months[monthIndex];
    if (!summary) return;
    summary.items.push(transaction);
    if (transaction.kind === "income") summary.income += transaction.amount;
    if (transaction.kind === "expense") summary.expense += transaction.amount;
    summary.net = summary.income - summary.expense;
  });

  return months;
}

function getPreviousMonthSummary() {
  const previousMonth = state.selectedMonth === 0 ? 11 : state.selectedMonth - 1;
  const previousYear = state.selectedMonth === 0 ? state.selectedYear - 1 : state.selectedYear;
  return getMonthlySeries(previousYear)[previousMonth] || { net: 0 };
}

function buildComparisonText(current, previous) {
  if (!previous) return "Sem mês anterior";
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return "Estável vs. mês anterior";
  const direction = diff > 0 ? "melhor" : "pior";
  return `${money.format(Math.abs(diff))} ${direction} que o mês anterior`;
}

function findAccount(id) {
  return state.accounts.find((account) => account.id === id);
}

function findCategory(id) {
  return state.categories.find((category) => category.id === id);
}

function findDocument(id) {
  return state.documents.find((document) => document.id === id);
}

function getSelectedKind() {
  return document.querySelector('input[name="kind"]:checked').value;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Erro ao falar com o servidor.");
  return payload;
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("negative", isError);
}

function formatDate(dateText) {
  if (!dateText) return "--";
  const [year, month, day] = dateText.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortMoney(value) {
  if (value >= 1000000) return `R$${numberFormat.format(value / 1000000)}mi`;
  if (value >= 1000) return `R$${numberFormat.format(value / 1000)}k`;
  return `R$${numberFormat.format(value)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(callback, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}
