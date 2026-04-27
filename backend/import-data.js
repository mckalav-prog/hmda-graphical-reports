import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'hmda.db'));

// HMDA field mapping (subset of most important fields for analysis)
const FIELD_POSITIONS = {
  year: 0,
  lei: 1,
  activity_year: 0,
  state_code: 9,
  county_code: 10,
  census_tract: 11,
  loan_type: 3,
  loan_purpose: 4,
  action_taken: 7,
  loan_amount: 7,
  combined_loan_to_value_ratio: 46,
  interest_rate: 47,
  rate_spread: 48,
  total_loan_costs: 49,
  total_points_and_fees: 50,
  origination_charges: 51,
  loan_term: 53,
  property_value: 55,
  income: 63,
  debt_to_income_ratio: 64,
  applicant_credit_score_type: 65,
  co_applicant_credit_score_type: 66,
  applicant_ethnicity_1: 13,
  applicant_race_1: 18,
  applicant_sex: 28,
  applicant_age: 33
};

console.log('Creating database schema...');

// Create table with indexed fields
db.exec(`
  DROP TABLE IF EXISTS hmda_data;

  CREATE TABLE hmda_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  CREATE INDEX idx_year ON hmda_data(year);
  CREATE INDEX idx_state ON hmda_data(state);
  CREATE INDEX idx_loan_purpose ON hmda_data(loan_purpose);
  CREATE INDEX idx_action_taken ON hmda_data(action_taken);
`);

console.log('Schema created successfully.');

// Prepare insert statement
const insert = db.prepare(`
  INSERT INTO hmda_data (
    year, lei, state, county, census_tract,
    loan_type, loan_purpose, action_taken, loan_amount,
    interest_rate, loan_term, property_value, income,
    debt_to_income_ratio, applicant_age, applicant_ethnicity,
    applicant_race, applicant_sex
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Transaction for bulk insert
const insertMany = db.transaction((records) => {
  for (const record of records) {
    insert.run(record);
  }
});

async function importFile(filePath, year) {
  console.log(`\nImporting ${year} data from: ${filePath}`);

  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let batch = [];
  const batchSize = 10000;

  for await (const line of rl) {
    const fields = line.split('|');

    // Only import originated loans (action_taken = 1)
    if (fields[6] !== '1') continue;

    // HMDA LAR field positions (pipe-delimited format)
    // Reference: https://ffiec.cfpb.gov/documentation/publications/loan-level-datasets/lar-data-fields
    const record = [
      fields[0] || null,              // year (activity_year)
      fields[1] || null,              // lei (Legal Entity Identifier)
      fields[9] || null,              // state
      fields[10] || null,             // county
      fields[11] || null,             // census_tract
      fields[3] || null,              // loan_type (1=Conventional, 2=FHA, 3=VA, 4=FSA/RHS)
      fields[4] || null,              // loan_purpose (1=Purchase, 2=Refinance, 31=Cash-out refi, 32=Other refi, 4=Other, 5=Not applicable)
      fields[6] || null,              // action_taken (1=Originated, 2=Approved not accepted, 3=Denied, etc.)
      fields[7] || null,              // loan_amount
      fields[50] || null,             // interest_rate
      fields[54] || null,             // loan_term
      fields[56] || null,             // property_value
      fields[64] || null,             // income
      fields[65] || null,             // debt_to_income_ratio
      fields[33] || null,             // applicant_age
      fields[13] || null,             // applicant_ethnicity (derived)
      fields[18] || null,             // applicant_race (derived)
      fields[28] || null              // applicant_sex (derived)
    ];

    batch.push(record);
    count++;

    if (batch.length >= batchSize) {
      insertMany(batch);
      batch = [];
      if (count % 100000 === 0) {
        console.log(`  Processed ${count.toLocaleString()} records...`);
      }
    }
  }

  // Insert remaining records
  if (batch.length > 0) {
    insertMany(batch);
  }

  console.log(`  Completed: ${count.toLocaleString()} records imported for ${year}`);
  return count;
}

async function main() {
  const hmdaPath = join(homedir(), 'HMDA');

  const files = [
    { path: join(hmdaPath, '2023_combined_mlar', '2023_combined_mlar.txt'), year: 2023 },
    { path: join(hmdaPath, '2024_combined_mlar', '2024_combined_mlar.txt'), year: 2024 }
  ];

  console.log('\n=== Starting HMDA Data Import ===\n');
  const startTime = Date.now();

  let totalRecords = 0;
  for (const file of files) {
    const count = await importFile(file.path, file.year);
    totalRecords += count;
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n=== Import Complete ===');
  console.log(`Total records imported: ${totalRecords.toLocaleString()}`);
  console.log(`Time taken: ${duration} seconds`);
  console.log(`Average speed: ${(totalRecords / duration).toFixed(0)} records/second`);

  // Show summary stats
  console.log('\n=== Database Statistics ===');
  const stats = db.prepare('SELECT year, COUNT(*) as count FROM hmda_data GROUP BY year').all();
  stats.forEach(stat => {
    console.log(`${stat.year}: ${stat.count.toLocaleString()} records`);
  });

  db.close();
  console.log('\nDatabase closed. Import finished successfully!');
}

main().catch(err => {
  console.error('Error during import:', err);
  process.exit(1);
});
