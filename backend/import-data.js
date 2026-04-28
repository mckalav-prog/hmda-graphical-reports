import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'hmda.db'));

// ── MLAR Field Positions (0-indexed, 2018 & Onward format) ──────────────────
// Reference: https://ffiec.cfpb.gov/documentation/publications/modified-lar/modified-lar-schema
// Fields in the pipe-delimited MLAR text file, in order:
//
//  0  activity_year
//  1  lei
//  2  loan_type              1=Conventional 2=FHA 3=VA 4=FSA/RHS
//  3  loan_purpose           1=Purchase 2=Home Improvement 31=Refinancing 32=Cash-out 4=Other 5=N/A
//  4  preapproval            1=Requested 2=Not requested
//  5  construction_method    1=Site-built 2=Manufactured
//  6  occupancy_type         1=Principal 2=Second 3=Investment
//  7  loan_amount
//  8  action_taken           1=Originated 2=Approved-not-accepted 3=Denied 4=Withdrawn
//                            5=File closed 6=Purchased 7=Preapproval denied 8=Preapproval approved-not-accepted
//  9  state
// 10  county
// 11  census_tract
// 12  ethnicity_applicant_1  primary
// 13  ethnicity_applicant_2
// 14  ethnicity_applicant_3
// 15  ethnicity_applicant_4
// 16  ethnicity_applicant_5
// 17  ethnicity_co_applicant_1
// 18..21 ethnicity_co_applicant_2-5
// 22  ethnicity_visual_applicant
// 23  ethnicity_visual_co_applicant
// 24  race_applicant_1       primary
// 25..28 race_applicant_2-5
// 29  race_co_applicant_1
// 30..33 race_co_applicant_2-5
// 34  race_visual_applicant
// 35  race_visual_co_applicant
// 36  sex_applicant          1=Male 2=Female 3=Not provided 4=N/A 6=No co-applicant
// 37  sex_co_applicant
// 38  sex_visual_applicant
// 39  sex_visual_co_applicant
// 40  age_applicant          <25 25-34 35-44 45-54 55-64 65-74 >74 8888=N/A
// 41  age_applicant_gte62    Yes No NA
// 42  age_co_applicant
// 43  age_co_applicant_gte62
// 44  income                 gross annual income in thousands of dollars
// 45  purchaser_type
// 46  rate_spread
// 47  hoepa_status
// 48  lien_status            1=First lien 2=Subordinate
// 49  applicant_credit_score_type
// 50  co_applicant_credit_score_type
// 51  denial_reason_1
// 52  denial_reason_2
// 53  denial_reason_3
// 54  denial_reason_4
// 55  total_loan_costs
// 56  total_points_and_fees
// 57  origination_charges
// 58  discount_points
// 59  lender_credits
// 60  interest_rate
// 61  prepayment_penalty_term
// 62  debt_to_income_ratio
// 63  combined_ltv
// 64  loan_term              months
// 65  intro_rate_period
// 66  balloon_payment
// 67  interest_only_payments
// 68  negative_amortization
// 69  other_non_amortizing
// 70  property_value         rounded to nearest $10000 midpoint
// 71  manufactured_home_secured_property_type
// 72  manufactured_home_land_property_interest
// 73  total_units
// 74  multifamily_affordable_units
// 75  submission_of_application
// 76  initially_payable_to_institution
// 77  aus_1
// 78..81 aus_2-5
// 82  reverse_mortgage
// 83  open_end_line_of_credit
// 84  business_commercial_purpose

console.log('Creating database schema...');

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
    preapproval TEXT,
    occupancy_type TEXT,
    action_taken TEXT,
    loan_amount TEXT,
    interest_rate TEXT,
    loan_term TEXT,
    property_value TEXT,
    income TEXT,
    debt_to_income_ratio TEXT,
    lien_status TEXT,
    applicant_age TEXT,
    applicant_ethnicity TEXT,
    applicant_race TEXT,
    applicant_sex TEXT,
    denial_reason_1 TEXT
  );

  CREATE INDEX idx_year ON hmda_data(year);
  CREATE INDEX idx_state ON hmda_data(state);
  CREATE INDEX idx_loan_type ON hmda_data(loan_type);
  CREATE INDEX idx_loan_purpose ON hmda_data(loan_purpose);
  CREATE INDEX idx_action_taken ON hmda_data(action_taken);
  CREATE INDEX idx_applicant_race ON hmda_data(applicant_race);
  CREATE INDEX idx_applicant_sex ON hmda_data(applicant_sex);
  CREATE INDEX idx_lien_status ON hmda_data(lien_status);
`);

console.log('Schema created successfully.');

const insert = db.prepare(`
  INSERT INTO hmda_data (
    year, lei, state, county, census_tract,
    loan_type, loan_purpose, preapproval, occupancy_type, action_taken,
    loan_amount, interest_rate, loan_term, property_value, income,
    debt_to_income_ratio, lien_status, applicant_age, applicant_ethnicity,
    applicant_race, applicant_sex, denial_reason_1
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((records) => {
  for (const record of records) {
    insert.run(record);
  }
});

async function importFile(filePath, year) {
  console.log(`\nImporting ${year} data from: ${filePath}`);

  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;
  let skipped = 0;
  let batch = [];
  const batchSize = 10000;
  let firstLine = true;

  for await (const line of rl) {
    // Skip header row if present
    if (firstLine) {
      firstLine = false;
      if (line.toLowerCase().includes('activity_year') || line.toLowerCase().includes('lei')) {
        console.log('  Skipping header row');
        continue;
      }
    }

    const fields = line.split('|');

    // Only import originated loans (Action Taken = 1, field index 8)
    if (fields[8] !== '1') {
      skipped++;
      continue;
    }

    const record = [
      fields[0]  || null,  // year (activity_year)
      fields[1]  || null,  // lei
      fields[9]  || null,  // state
      fields[10] || null,  // county
      fields[11] || null,  // census_tract
      fields[2]  || null,  // loan_type        (1=Conventional 2=FHA 3=VA 4=FSA/RHS)
      fields[3]  || null,  // loan_purpose     (1=Purchase 2=Home Improvement 31=Refi 32=Cash-out 4=Other)
      fields[4]  || null,  // preapproval      (1=Requested 2=Not requested)
      fields[6]  || null,  // occupancy_type   (1=Principal 2=Second 3=Investment)
      fields[8]  || null,  // action_taken     (1=Originated)
      fields[7]  || null,  // loan_amount
      fields[60] || null,  // interest_rate
      fields[64] || null,  // loan_term        (months)
      fields[70] || null,  // property_value
      fields[44] || null,  // income           (thousands of dollars)
      fields[62] || null,  // debt_to_income_ratio
      fields[48] || null,  // lien_status      (1=First 2=Subordinate)
      fields[40] || null,  // applicant_age    (<25 25-34 35-44 45-54 55-64 65-74 >74 8888)
      fields[12] || null,  // applicant_ethnicity  (Ethnicity of Applicant:1, primary)
      fields[24] || null,  // applicant_race       (Race of Applicant:1, primary)
      fields[36] || null,  // applicant_sex        (1=Male 2=Female 3=Not provided 4=N/A)
      fields[51] || null,  // denial_reason_1  (only populated for denials, mostly null here)
    ];

    batch.push(record);
    count++;

    if (batch.length >= batchSize) {
      insertMany(batch);
      batch = [];
      if (count % 100000 === 0) {
        console.log(`  Processed ${count.toLocaleString()} records (skipped ${skipped.toLocaleString()})...`);
      }
    }
  }

  if (batch.length > 0) {
    insertMany(batch);
  }

  console.log(`  Completed: ${count.toLocaleString()} originated records imported for ${year}`);
  console.log(`  Skipped: ${skipped.toLocaleString()} non-originated records`);
  return count;
}

async function main() {
  const hmdaPath = join(homedir(), 'HMDA');

  const files = [
    { path: join(hmdaPath, '2023_combined_mlar', '2023_combined_mlar.txt'), year: 2023 },
    { path: join(hmdaPath, '2024_combined_mlar', '2024_combined_mlar.txt'), year: 2024 },
  ];

  console.log('\n=== Starting HMDA Data Import (corrected field mappings) ===\n');
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

  console.log('\n=== Database Statistics ===');
  const stats = db.prepare('SELECT year, COUNT(*) as count FROM hmda_data GROUP BY year').all();
  stats.forEach(s => console.log(`${s.year}: ${s.count.toLocaleString()} records`));

  db.close();
  console.log('\nImport finished.');
}

main().catch(err => {
  console.error('Error during import:', err);
  process.exit(1);
});
