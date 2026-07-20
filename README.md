# Controle financeiro

Dashboard responsivo para acompanhar entradas, saídas, saldos de contas, documentos/processos, lojas de origem e lucro por serviço.

## Rodar no computador

```bash
npm start
```

Abra `http://localhost:3000`.

Sem credenciais do TiDB, o app usa um arquivo local em `data/transactions.json`. Isso serve para testar a tela. Para usar em vários dispositivos, configure o TiDB.

## Recursos

- Cadastro de até 3 contas da empresa, com saldo inicial e saldo atual.
- Tela de saldos mensais por conta, carregando o saldo final de um mês para o próximo.
- Lançamentos de entrada e saída vinculados a uma conta.
- Saídas com categoria obrigatória e filtro por categoria no histórico.
- Categorias abertas: já inclui Cartório e permite criar novas categorias além de Outros.
- Tela de lojas, com nome e data de chegada.
- Tela de serviços/documentos/processos, com status, acompanhamento, gastos, entradas e lucro por documento.
- Edição e remoção de lançamentos.

## Ligar ao TiDB

1. Rode `npm install` para instalar o driver MySQL usado pelo TiDB.
2. Copie `.env.example` para `.env`.
3. Preencha `TIDB_HOST`, `TIDB_USER`, `TIDB_PASSWORD` e `TIDB_DATABASE`.
4. Rode `npm start`.

O servidor cria as tabelas automaticamente. Se preferir criar manualmente, use `sql/tidb-schema.sql`.

Tabelas usadas:

- `finance_accounts`: contas e saldo inicial.
- `finance_categories`: categorias de saída.
- `finance_stores`: lojas de origem.
- `finance_documents`: documentos/processos/serviços.
- `finance_incomes`: entradas.
- `finance_expenses`: saídas.

Se aparecer erro como `CREATE command denied`, confira primeiro se `TIDB_DATABASE` não está como `sys`. O schema `sys` é interno do TiDB. Use um banco próprio, por exemplo `financeiro_despachante`, ou o banco `test` se sua conta TiDB já tiver esse banco liberado.

Se você criar as tabelas manualmente pelo console do TiDB usando `sql/tidb-schema.sql`, pode desligar a criação automática no Render:

```env
TIDB_AUTO_SCHEMA=false
```

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
