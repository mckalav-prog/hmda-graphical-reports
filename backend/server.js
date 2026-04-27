import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new Database(join(__dirname, 'hmda.db'));

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HMDA API is running' });
});

// Get available years
app.get('/api/years', (req, res) => {
  try {
    const years = db.prepare("SELECT DISTINCT year FROM hmda_data WHERE action_taken = '1' ORDER BY year").all();
    res.json(years.map(y => y.year));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available states
app.get('/api/states', (req, res) => {
  try {
    const states = db.prepare("SELECT DISTINCT state FROM hmda_data WHERE state IS NOT NULL AND action_taken = '1' ORDER BY state").all();
    res.json(states.map(s => s.state));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get loan purposes
app.get('/api/loan-purposes', (req, res) => {
  try {
    const purposes = db.prepare("SELECT DISTINCT loan_purpose FROM hmda_data WHERE loan_purpose IS NOT NULL AND action_taken = '1' ORDER BY loan_purpose").all();
    res.json(purposes.map(p => p.loan_purpose));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get aggregated data by state
app.get('/api/aggregate/by-state', (req, res) => {
  try {
    const { year, limit = 50 } = req.query;

    let query = `
      SELECT
        state,
        COUNT(*) as loan_count,
        AVG(CAST(loan_amount AS REAL)) as avg_loan_amount,
        SUM(CAST(loan_amount AS REAL)) as total_loan_amount
      FROM hmda_data
      WHERE state IS NOT NULL AND loan_amount IS NOT NULL AND action_taken = '1'
    `;

    const params = [];
    if (year) {
      query += ' AND year = ?';
      params.push(year);
    }

    query += ' GROUP BY state ORDER BY loan_count DESC LIMIT ?';
    params.push(parseInt(limit));

    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get aggregated data by loan purpose
app.get('/api/aggregate/by-loan-purpose', (req, res) => {
  try {
    const { year, state } = req.query;

    let query = `
      SELECT
        loan_purpose,
        COUNT(*) as loan_count,
        AVG(CAST(loan_amount AS REAL)) as avg_loan_amount,
        SUM(CAST(loan_amount AS REAL)) as total_loan_amount
      FROM hmda_data
      WHERE loan_purpose IS NOT NULL AND loan_amount IS NOT NULL AND action_taken = '1'
    `;

    const params = [];
    if (year) {
      query += ' AND year = ?';
      params.push(year);
    }
    if (state) {
      query += ' AND state = ?';
      params.push(state);
    }

    query += ' GROUP BY loan_purpose ORDER BY loan_count DESC';

    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get aggregated data by action taken
app.get('/api/aggregate/by-action', (req, res) => {
  try {
    const { year, state } = req.query;

    let query = `
      SELECT
        action_taken,
        COUNT(*) as loan_count,
        AVG(CAST(loan_amount AS REAL)) as avg_loan_amount
      FROM hmda_data
      WHERE action_taken IS NOT NULL AND loan_amount IS NOT NULL
    `;

    const params = [];
    if (year) {
      query += ' AND year = ?';
      params.push(year);
    }
    if (state) {
      query += ' AND state = ?';
      params.push(state);
    }

    query += ' GROUP BY action_taken ORDER BY loan_count DESC';

    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Year comparison endpoint
app.get('/api/compare/years', (req, res) => {
  try {
    const { metric = 'loan_count', groupBy = 'state', limit = 20 } = req.query;

    let selectClause = '';
    if (metric === 'loan_count') {
      selectClause = 'COUNT(*) as value';
    } else if (metric === 'avg_loan_amount') {
      selectClause = 'AVG(CAST(loan_amount AS REAL)) as value';
    } else if (metric === 'total_loan_amount') {
      selectClause = 'SUM(CAST(loan_amount AS REAL)) as value';
    }

    const query = `
      SELECT
        ${groupBy} as category,
        year,
        ${selectClause}
      FROM hmda_data
      WHERE ${groupBy} IS NOT NULL AND loan_amount IS NOT NULL AND action_taken = '1'
      GROUP BY ${groupBy}, year
      ORDER BY year, value DESC
    `;

    const results = db.prepare(query).all();

    // Transform data for comparison
    const transformed = {};
    results.forEach(row => {
      if (!transformed[row.category]) {
        transformed[row.category] = { category: row.category };
      }
      transformed[row.category][`year_${row.year}`] = row.value;
    });

    const finalResults = Object.values(transformed).slice(0, parseInt(limit));
    res.json(finalResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database stats
app.get('/api/stats', (req, res) => {
  try {
    const totalRecords = db.prepare("SELECT COUNT(*) as count FROM hmda_data WHERE action_taken = '1'").get();
    const recordsByYear = db.prepare("SELECT year, COUNT(*) as count FROM hmda_data WHERE action_taken = '1' GROUP BY year").all();

    res.json({
      totalRecords: totalRecords.count,
      recordsByYear
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`HMDA API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
