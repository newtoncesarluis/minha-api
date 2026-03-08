const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: 'dbdatabasic.cf6qs006qmj2.us-east-2.rds.amazonaws.com',
  user: 'root',
  password: 'kzf010557f',
  database: 'bdallyrepresentacoes',
  waitForConnections: true,
  connectionLimit: 10,
});

// === DASHBOARD COMPLETO ===
app.get('/api/dashboard', async (req, res) => {
  try {
    const [resumo] = await pool.query(`
      SELECT COUNT(*) as total_pedidos, 
             COALESCE(SUM(vlrtotalpedido), 0) as valor_total,
             COALESCE(AVG(vlrtotalpedido), 0) as ticket_medio,
             COUNT(DISTINCT cod_cliente) as total_clientes
      FROM pedidos WHERE data_abertura = CURDATE() AND excluido = 'N'
    `);

    const [vendas_mes] = await pool.query(`
      SELECT DATE_FORMAT(data_abertura, '%d/%m') as dia, 
             COALESCE(SUM(vlrtotalpedido), 0) as valor,
             COUNT(*) as quantidade
      FROM pedidos 
      WHERE data_abertura >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND excluido = 'N'
      GROUP BY data_abertura ORDER BY data_abertura
    `);

    const [top_clientes] = await pool.query(`
      SELECT nome_cliente as nome, SUM(vlrtotalpedido) as valor, COUNT(*) as quantidade
      FROM pedidos WHERE MONTH(data_abertura) = MONTH(CURDATE()) AND YEAR(data_abertura) = YEAR(CURDATE()) AND excluido = 'N'
      GROUP BY nome_cliente ORDER BY valor DESC LIMIT 10
    `);

    const [pedidos_status] = await pool.query(`
      SELECT status, COUNT(*) as quantidade, SUM(vlrtotalpedido) as valor
      FROM pedidos WHERE MONTH(data_abertura) = MONTH(CURDATE()) AND excluido = 'N'
      GROUP BY status
    `);

    const [top_produtos] = await pool.query(`
      SELECT ip.desc_prod as nome, SUM(ip.vlrtotal_itens) as valor, SUM(ip.quantidade) as quantidade
      FROM itensped ip
      INNER JOIN pedidos p ON ip.numpedido = p.numero
      WHERE MONTH(p.data_abertura) = MONTH(CURDATE()) AND YEAR(p.data_abertura) = YEAR(CURDATE()) AND p.excluido = 'N' AND ip.excluido = 'N'
      GROUP BY ip.desc_prod ORDER BY valor DESC LIMIT 10
    `);

    const [faturamento] = await pool.query(`
      SELECT DATE_FORMAT(data_abertura, '%b/%Y') as mes, SUM(vlrtotalpedido) as valor
      FROM pedidos WHERE data_abertura >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) AND excluido = 'N'
      GROUP BY YEAR(data_abertura), MONTH(data_abertura)
      ORDER BY YEAR(data_abertura), MONTH(data_abertura)
    `);

    res.json({
      resumo_hoje: resumo[0],
      vendas_mes,
      top_clientes,
      pedidos_status,
      top_produtos,
      faturamento_mensal: faturamento
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === TOP CLIENTES ===
app.get('/api/dashboard/top-clientes', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT nome_cliente as nome, SUM(vlrtotalpedido) as valor, COUNT(*) as quantidade
      FROM pedidos WHERE MONTH(data_abertura) = MONTH(CURDATE()) AND excluido = 'N'
      GROUP BY nome_cliente ORDER BY valor DESC LIMIT 10
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === TOP PRODUTOS ===
app.get('/api/dashboard/top-produtos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ip.desc_prod as nome, SUM(ip.vlrtotal_itens) as valor, SUM(ip.quantidade) as quantidade
      FROM itensped ip
      INNER JOIN pedidos p ON ip.numpedido = p.numero
      WHERE MONTH(p.data_abertura) = MONTH(CURDATE()) AND p.excluido = 'N' AND ip.excluido = 'N'
      GROUP BY ip.desc_prod ORDER BY valor DESC LIMIT 10
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === FATURAMENTO MENSAL ===
app.get('/api/dashboard/faturamento', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(data_abertura, '%b/%Y') as mes, SUM(vlrtotalpedido) as valor
      FROM pedidos WHERE data_abertura >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) AND excluido = 'N'
      GROUP BY YEAR(data_abertura), MONTH(data_abertura)
      ORDER BY YEAR(data_abertura), MONTH(data_abertura)
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === PEDIDOS DE HOJE ===
app.get('/api/pedidos/hoje', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM pedidos WHERE DATE(data_abertura) = CURDATE() AND excluido = 'N'"
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === RESUMO DO DIA ===
app.get('/api/pedidos/resumo', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(*) as total, COALESCE(SUM(vlrtotalpedido),0) as valor_total,
             COALESCE(AVG(vlrtotalpedido),0) as ticket_medio
      FROM pedidos WHERE data_abertura = CURDATE() AND excluido = 'N'
    `);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === BUSCA COM FILTROS ===
app.get('/api/pedidos', async (req, res) => {
  try {
    let query = 'SELECT * FROM pedidos WHERE excluido = "N"';
    const params = [];

    if (req.query.cliente) { query += ' AND nome_cliente LIKE ?'; params.push(`%${req.query.cliente}%`); }
    if (req.query.vendedor) { query += ' AND nome_vendedor LIKE ?'; params.push(`%${req.query.vendedor}%`); }
    if (req.query.fornecedor) { query += ' AND nome_fornecedor LIKE ?'; params.push(`%${req.query.fornecedor}%`); }
    if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.data_inicio) { query += ' AND data_abertura >= ?'; params.push(req.query.data_inicio); }
    if (req.query.data_fim) { query += ' AND data_abertura <= ?'; params.push(req.query.data_fim); }

    query += ' ORDER BY data_abertura DESC LIMIT 100';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === TOP VENDEDORES ===
app.get('/api/dashboard/top-vendedores', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT nome_vendedor as nome, SUM(vlrtotalpedido) as valor, COUNT(*) as quantidade
      FROM pedidos 
      WHERE MONTH(data_abertura) = MONTH(CURDATE()) 
        AND YEAR(data_abertura) = YEAR(CURDATE()) 
        AND excluido = 'N'
      GROUP BY nome_vendedor 
      ORDER BY valor DESC 
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('API rodando na porta ' + PORT));
