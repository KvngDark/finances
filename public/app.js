const categories = [
  {
    value: "combustivel",
    label: "Combustível",
    color: "#d89216",
    placeholder: "Combustível de Fulano"
  },
  {
    value: "dudas",
    label: "DUDAs",
    color: "#226c8a",
    placeholder: "Duda para processo Y"
  },
  {
    value: "acertos",
    label: "Acertos",
    color: "#6658a6",
    placeholder: "Acerto Santa Cruz"
  },
  {
    value: "comissao",
    label: "Comissão",
    color: "#168a62",
    placeholder: "Comissão Fulano"
  },
  {
    value: "salario",
    label: "Salário",
    color: "#c84b3f",
    placeholder: "Salário de funcionário X"
  },
  {
    value: "taxas",
    label: "Taxas",
    color: "#7b6b54",
    placeholder: "Taxa do processo Y"
  },
  {
    value: "manutencao",
    label: "Manutenção",
    color: "#59656f",
    placeholder: "Manutenção do veículo"
  },
  {
    value: "outros",
    label: "Outros",
    color: "#8a5b3b",
    placeholder: "Compra de material"
  }
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
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const state = {
  transactions: [],
  selectedMonth: new Date().getMonth(),
  selectedYear: new Date().getFullYear(),
  isSaving: false
};

const els = {
  storageBadge: document.querySelector("#storageBadge"),
  refreshButton: document.querySelector("#refreshButton"),
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
  form: document.querySelector("#transactionForm"),
  amountInput: document.querySelector("#amountInput"),
  dateInput: document.querySelector("#dateInput"),
  categoryField: document.querySelector("#categoryField"),
  categorySelect: document.querySelector("#categorySelect"),
  descriptionLabel: document.querySelector("#descriptionLabel"),
  descriptionInput: document.querySelector("#descriptionInput"),
  formMessage: document.querySelector("#formMessage"),
  categoryBars: document.querySelector("#categoryBars"),
  incomeTransactionsList: document.querySelector("#incomeTransactionsList"),
  expenseTransactionsList: document.querySelector("#expenseTransactionsList"),
  incomeTableCount: document.querySelector("#incomeTableCount"),
  expenseTableCount: document.querySelector("#expenseTableCount"),
  transactionCount: document.querySelector("#transactionCount")
};

bootstrap();

async function bootstrap() {
  buildMonthRail();
  buildCategoryOptions();
  setDefaultDate();
  bindEvents();
  await refreshAll();
}

function bindEvents() {
  els.refreshButton.addEventListener("click", refreshAll);
  els.yearSelect.addEventListener("change", () => {
    state.selectedYear = Number(els.yearSelect.value);
    render();
  });
  els.categorySelect.addEventListener("change", updateDescriptionPlaceholder);
  els.form.addEventListener("submit", handleSubmit);
  window.addEventListener("resize", debounce(drawCharts, 150));

  document.querySelectorAll('input[name="kind"]').forEach((radio) => {
    radio.addEventListener("change", updateDescriptionPlaceholder);
  });
}

async function refreshAll() {
  setFormMessage("Atualizando...");
  try {
    const [config, transactionResponse] = await Promise.all([
      fetchJson("/api/config"),
      fetchJson("/api/transactions")
    ]);
    state.transactions = transactionResponse.transactions || [];
    els.storageBadge.textContent = config.databaseConfigured ? "TiDB conectado" : "Modo local";
    els.storageBadge.title = config.databaseConfigured
      ? "Os lançamentos estão sendo gravados no TiDB."
      : "Sem credenciais do TiDB, os lançamentos ficam em arquivo local.";
    setFormMessage("");
    syncYearOptions();
    render();
  } catch (error) {
    els.storageBadge.textContent = "Sem conexao";
    setFormMessage(error.message || "Não foi possível carregar os dados.", true);
  }
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
      render();
    });
    els.monthRail.append(button);
  });
}

function buildCategoryOptions() {
  els.categorySelect.innerHTML = categories
    .map((category) => `<option value="${category.value}">${category.label}</option>`)
    .join("");
  updateDescriptionPlaceholder();
}

function syncYearOptions() {
  const years = new Set([state.selectedYear, new Date().getFullYear()]);
  state.transactions.forEach((transaction) => {
    years.add(Number(transaction.occurredAt.slice(0, 4)));
  });

  const orderedYears = [...years].filter(Boolean).sort((a, b) => b - a);
  els.yearSelect.innerHTML = orderedYears
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
  els.yearSelect.value = String(state.selectedYear);
}

function setDefaultDate() {
  els.dateInput.value = toDateInputValue(new Date());
}

function updateDescriptionPlaceholder() {
  const selected = categories.find((category) => category.value === els.categorySelect.value);
  const kind = getSelectedKind();
  if (!selected) return;

  if (kind === "income") {
    els.categoryField.hidden = true;
    els.categorySelect.required = false;
    els.categorySelect.disabled = true;
    els.descriptionLabel.textContent = "Origem da entrada";
    els.descriptionInput.placeholder = "Ex.: Primeira licença Jeep Recreio";
    return;
  }

  els.categoryField.hidden = false;
  els.categorySelect.required = true;
  els.categorySelect.disabled = false;
  els.descriptionLabel.textContent = "Descrição do gasto";
  els.descriptionInput.placeholder = `Ex.: ${selected.placeholder}`;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.isSaving) return;

  const amount = els.amountInput.value.trim();
  const kind = getSelectedKind();
  const payload = {
    kind,
    amount,
    occurredAt: els.dateInput.value,
    description: els.descriptionInput.value.trim()
  };
  if (kind === "expense") {
    payload.category = els.categorySelect.value;
  }

  state.isSaving = true;
  setFormMessage("Salvando...");

  try {
    const response = await fetchJson("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.transactions.unshift(response.transaction);
    els.amountInput.value = "";
    els.descriptionInput.value = "";
    state.selectedMonth = Number(payload.occurredAt.slice(5, 7)) - 1;
    state.selectedYear = Number(payload.occurredAt.slice(0, 4));
    syncYearOptions();
    render();
    setFormMessage("Lançamento adicionado.");
  } catch (error) {
    setFormMessage(error.message || "Não foi possível salvar.", true);
  } finally {
    state.isSaving = false;
  }
}

async function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  const confirmed = window.confirm(`Remover "${transaction.description}"?`);
  if (!confirmed) return;

  try {
    await fetchJson(`/api/transactions/${id}`, { method: "DELETE" });
    state.transactions = state.transactions.filter((item) => item.id !== id);
    render();
    setFormMessage("Lançamento removido.");
  } catch (error) {
    setFormMessage(error.message || "Não foi possível remover.", true);
  }
}

function render() {
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
  const totals = categories
    .map((category) => {
      const total = summary.items
        .filter((item) => item.category === category.value && item.kind === "expense")
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
          <span class="category-name">${category.label}</span>
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
  const incomeItems = ordered.filter((transaction) => transaction.kind === "income");
  const expenseItems = ordered.filter((transaction) => transaction.kind === "expense");

  els.transactionCount.textContent = `${ordered.length} ${ordered.length === 1 ? "item" : "itens"}`;
  els.incomeTableCount.textContent = `${incomeItems.length} ${incomeItems.length === 1 ? "item" : "itens"}`;
  els.expenseTableCount.textContent = `${expenseItems.length} ${expenseItems.length === 1 ? "item" : "itens"}`;

  renderTransactionGroup(els.incomeTransactionsList, incomeItems, "Nenhuma entrada neste mês.");
  renderTransactionGroup(els.expenseTransactionsList, expenseItems, "Nenhuma saída neste mês.");
}

function renderTransactionGroup(container, items, emptyMessage) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = items
    .map((transaction) => {
      const category = categories.find((item) => item.value === transaction.category);
      const sign = transaction.kind === "income" ? "+" : "-";
      const amountClass = transaction.kind === "income" ? "positive" : "negative";
      const iconText = transaction.kind === "income" ? "E" : "S";
      const detail = transaction.kind === "income"
        ? "Origem da entrada"
        : category ? category.label : "Saída";
      return `
        <article class="transaction-row">
          <span class="transaction-icon ${transaction.kind}" aria-hidden="true">${iconText}</span>
          <div class="transaction-main">
            <p class="transaction-description">${escapeHtml(transaction.description)}</p>
            <div class="transaction-meta">
              <span>${formatDate(transaction.occurredAt)}</span>
              <span>${detail}</span>
            </div>
          </div>
          <strong class="transaction-amount ${amountClass}">${sign}${money.format(transaction.amount)}</strong>
          <button class="delete-button" type="button" data-id="${transaction.id}" aria-label="Remover lançamento">x</button>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.id));
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
  const maxValue = Math.max(
    100,
    ...series.flatMap((month) => [month.income, month.expense, Math.abs(month.net)])
  );

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
      return {
        x: padding.left + step * index + step / 2,
        y: valueToY(month.net),
        monthIndex: index
      };
    })
    .filter(Boolean);

  if (!points.length) return;

  ctx.strokeStyle = "#226c8a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length > 1) {
    drawSmoothLine(ctx, points);
  }

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

function getSelectedKind() {
  return document.querySelector('input[name="kind"]:checked').value;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao falar com o servidor.");
  }
  return payload;
}

function setFormMessage(message, isError = false) {
  els.formMessage.textContent = message;
  els.formMessage.classList.toggle("negative", isError);
}

function formatDate(dateText) {
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
  return String(value)
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
