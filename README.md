# HMDA Graphical Reports Dashboard

A full-stack web application for analyzing and visualizing Home Mortgage Disclosure Act (HMDA) data with interactive charts and filtering capabilities.

## Features

### Backend (Node.js + SQLite)
- SQLite database for efficient querying of large HMDA datasets (5+ million records)
- RESTful API with Express.js
- Aggregation endpoints for state, loan purpose, and action taken analysis
- Year-over-year comparison capabilities
- Optimized with database indexes for fast queries

### Frontend (React + Recharts)
- Interactive charts: Line, Bar, Pie, and Data Tables
- Dynamic filtering by year, state, and view type
- Real-time data loading from backend API
- Responsive design with modern gradient UI
- HMDA-specific data transformations and labels

### Supported Analyses
- **By State**: Aggregate loan data by geographic location
- **By Loan Purpose**: Purchase, Refinance, Cash-out refinancing analysis
- **By Action Taken**: Originated, Denied, Withdrawn, etc.
- **Year Comparison**: Side-by-side 2023 vs 2024 comparison

## Architecture

```
graphical-reports-site/
├── backend/
│   ├── server.js          # Express API server
│   ├── import-data.js     # Data import script
│   ├── package.json       # Backend dependencies
│   └── hmda.db           # SQLite database (created after import)
├── src/
│   ├── App.jsx           # Main React application
│   ├── components/       # Chart and filter components
│   └── *.css            # Styling
└── package.json         # Frontend dependencies
```

## Setup Instructions

### Step 1: Install Backend Dependencies

```bash
cd graphical-reports-site/backend
npm install
```

### Step 2: Import HMDA Data

This will load your HMDA data files from `~/HMDA/` into the SQLite database. This process may take 10-30 minutes depending on file size.

```bash
npm run import
```

Expected output:
```
=== Starting HMDA Data Import ===

Importing 2023 data from: /home/fbrianne103/HMDA/2023_combined_mlar/2023_combined_mlar.txt
  Processed 100,000 records...
  Processed 200,000 records...
  ...
  Completed: 2,500,000 records imported for 2023

Importing 2024 data from: /home/fbrianne103/HMDA/2024_combined_mlar/2024_combined_mlar.txt
  ...
  Completed: 2,700,000 records imported for 2024

=== Import Complete ===
Total records imported: 5,200,000
Time taken: 180 seconds
```

### Step 3: Start Backend Server

```bash
npm start
```

The API server will run on `http://localhost:3001`

### Step 4: Install Frontend Dependencies

Open a new terminal:

```bash
cd graphical-reports-site
npm install
```

### Step 5: Start Frontend Development Server

```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is busy)

### Step 6: Access the Dashboard

Open your browser to `http://localhost:5173`

## Usage

1. **Select View Type**: Choose from "By State", "By Loan Purpose", "By Action Taken", or "Compare 2023 vs 2024"

2. **Apply Filters** (optional):
   - Select specific year (2023, 2024, or All Years)
   - Select specific state (or All States)

3. **Click "Load Data"**: The dashboard will query the database and display charts

4. **Explore Visualizations**:
   - Line charts show trends across categories
   - Bar charts compare values side-by-side
   - Pie charts show proportional distributions
   - Data tables display exact numbers

## API Endpoints

All endpoints are prefixed with `http://localhost:3001/api`

### Data Endpoints

- `GET /health` - Health check
- `GET /stats` - Database statistics
- `GET /years` - Available years
- `GET /states` - Available states

### Aggregation Endpoints

- `GET /aggregate/by-state?year=2023&limit=50`
  - Returns loan counts and amounts aggregated by state

- `GET /aggregate/by-loan-purpose?year=2023&state=CA`
  - Returns loan data by purpose (Purchase, Refinance, etc.)

- `GET /aggregate/by-action?year=2024&state=TX`
  - Returns loan data by action taken (Originated, Denied, etc.)

- `GET /compare/years?metric=loan_count&groupBy=state&limit=20`
  - Returns year-over-year comparison data

## HMDA Data Fields

The application imports and analyzes the following key fields:

- **year**: Activity year (2023, 2024)
- **state**: Two-letter state code
- **loan_type**: 1=Conventional, 2=FHA, 3=VA, 4=FSA/RHS
- **loan_purpose**: 1=Purchase, 2=Refinance, 31=Cash-out, 32=Other Refi
- **action_taken**: 1=Originated, 3=Denied, 4=Withdrawn, etc.
- **loan_amount**: Loan amount in dollars
- **income**: Applicant income
- **property_value**: Property value
- And more demographic and underwriting fields

Reference: [FFIEC HMDA Documentation](https://ffiec.cfpb.gov/documentation/publications/loan-level-datasets/lar-data-fields)

## Database Schema

```sql
CREATE TABLE hmda_data (
  id INTEGER PRIMARY KEY,
  year INTEGER,
  lei TEXT,
  state TEXT,
  county TEXT,
  census_tract TEXT,
  loan_type TEXT,
  loan_purpose TEXT,
  action_taken TEXT,
  loan_amount TEXT,
  interest_rate TEXT,
  loan_term TEXT,
  property_value TEXT,
  income TEXT,
  debt_to_income_ratio TEXT,
  applicant_age TEXT,
  applicant_ethnicity TEXT,
  applicant_race TEXT,
  applicant_sex TEXT
);

-- Indexes for performance
CREATE INDEX idx_year ON hmda_data(year);
CREATE INDEX idx_state ON hmda_data(state);
CREATE INDEX idx_loan_purpose ON hmda_data(loan_purpose);
CREATE INDEX idx_action_taken ON hmda_data(action_taken);
```

## Performance

- **Database Size**: ~500MB for 5+ million records
- **Query Speed**: Most aggregations complete in 100-500ms
- **Import Speed**: ~25,000-30,000 records/second

## Troubleshooting

### Backend won't start
- Make sure you ran `npm run import` first to create the database
- Check that port 3001 is not already in use

### Frontend shows "Unable to connect to API server"
- Verify the backend is running on port 3001
- Check browser console for CORS errors

### Import script fails
- Verify HMDA files exist at `~/HMDA/2023_combined_mlar/` and `~/HMDA/2024_combined_mlar/`
- Ensure you have enough disk space (~500MB for database)

### Slow queries
- The first query after starting the server may be slower (cold start)
- Subsequent queries should be fast due to database indexes
- Consider adding more indexes if filtering by additional fields

## Future Enhancements

- Export charts as PNG/PDF
- Save favorite filter combinations
- Additional demographic analysis
- Geographic heat maps
- Trend analysis over time
- Custom date range selection

## Technology Stack

**Backend:**
- Node.js
- Express.js
- better-sqlite3
- CORS

**Frontend:**
- React 18
- Recharts
- Vite

## License

MIT
