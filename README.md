# Despachante Financeiro

Dashboard financeiro responsivo para acompanhar entradas, saídas, resultado do mês e histórico anual do escritório. Toda entrada pede a origem do dinheiro, e todo gasto pede uma categoria e uma descrição do motivo.

## Rodar no computador

```bash
npm start
```

Abra `http://localhost:3000`.

Sem credenciais do TiDB, o app usa um arquivo local em `data/transactions.json`. Isso serve para testar a tela. Para usar em vários dispositivos, configure o TiDB.

## Ligar ao TiDB

1. Rode `npm install` para instalar o driver MySQL usado pelo TiDB.
2. Copie `.env.example` para `.env`.
3. Preencha `TIDB_HOST`, `TIDB_USER`, `TIDB_PASSWORD` e `TIDB_DATABASE`.
4. Rode `npm start`.

O servidor cria as tabelas `finance_incomes` e `finance_expenses` automaticamente. Se preferir criar manualmente, use `sql/tidb-schema.sql`.

Entradas e saídas ficam separadas no banco para facilitar o entendimento:

- `finance_incomes`: valor, data e origem da entrada.
- `finance_expenses`: valor, data, categoria e descrição do gasto.

Também é possível usar uma URL única:

```env
DATABASE_URL=mysql://usuario:senha@host:4000/financeiro_despachante
```

## Acesso em celulares e outros PCs

Com `HOST=0.0.0.0`, outros aparelhos na mesma rede podem abrir:

```text
http://IP_DO_COMPUTADOR:3000
```

Como o sistema não tem login, qualquer pessoa com acesso ao endereço consegue inserir ou remover lançamentos. Para uso fora da rede interna, vale colocar o site atrás de uma proteção do provedor ou adicionar login depois.
