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

app.get('/api/pedidos/hoje', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM pedidos WHERE DATE(data_pedido) = CURDATE()"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM pedidos ORDER BY data_pedido DESC LIMIT 100");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('API rodando na porta ' + PORT));
