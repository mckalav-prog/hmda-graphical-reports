import { createReadStream, readFileSync } from 'fs';
import { createInterface } from 'readline';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== HMDA Data Aggregation Script ===\n');

// Load LEI to Respondent Name mapping from transmittal sheet files
console.log('Loading LEI to Respondent Name mappings...');
const leiToRespondentName = {};

function loadTransmittalSheet(filePath, year) {
  try {
    const tsData = readFileSync(filePath, 'utf-8').split('\n');
    let count = 0;
    for (let i = 1; i < tsData.length; i++) {
      const line = tsData[i].trim();
      if (!line) continue;
      // CSV format: activity_year,calendar_quarter,lei,tax_id,agency_code,respondent_name,...
      // Handle quoted fields with commas
      const match = line.match(/^(\d+),(\d+),([^,]+),([^,]*),(\d+),"([^"]+)"/);
      if (match) {
        const lei = match[3];
        const respondentName = match[6];
        if (!leiToRespondentName[year]) leiToRespondentName[year] = {};
        leiToRespondentName[year][lei] = respondentName;
        count++;
      }
    }
    console.log(`  Loaded ${count} LEI mappings for ${year}`);
  } catch (err) {
    console.log(`  Warning: Could not load transmittal sheet for ${year}: ${err.message}`);
  }
}

const hmdaBasePath = join(homedir(), 'HMDA');
loadTransmittalSheet(join(hmdaBasePath, '2023_public_ts_csv.csv'), '2023');
loadTransmittalSheet(join(hmdaBasePath, '2024_public_ts_csv.csv'), '2024');
console.log('');

// Load county to MSA mapping
console.log('Loading county to MSA mapping...');
const countyToMSA = {};
const msaReferenceFile = join(__dirname, 'msa_county_reference22.txt');
const msaData = readFileSync(msaReferenceFile, 'utf-8').split('\n');
for (let i = 1; i < msaData.length; i++) {
  const line = msaData[i].trim();
  if (!line) continue;
  const match = line.match(/"(\d+)","([^"]+)","(\d+)","(\d+)"/);
  if (match) {
    const [, msaCode, msaName, stateFips, countyFips] = match;
    const countyKey = stateFips + countyFips;
    countyToMSA[countyKey] = { msa: msaCode, name: msaName };
  }
}
console.log(`Loaded ${Object.keys(countyToMSA).length} county-to-MSA mappings\n`);

// Aggregation storage
const aggregations = {
  byState: {},
  byMSA: {},
  byLender: {},
  byLoanPurpose: {},
  byLoanType: {},
  byDollarAmount: {},
  topMetros: {}
};

// Loan purpose labels (only included purposes: Purchase and Refinancing)
const LOAN_PURPOSE_LABELS = {
  '1': 'Purchase',
  '31': 'Refinancing'
};

// Loan type labels
const LOAN_TYPE_LABELS = {
  '1': 'Conventional',
  '2': 'FHA',
  '3': 'VA',
  '4': 'FSA/RHS'
};

async function processHMDAFile(filePath, year) {
  console.log(`Processing ${year} data from: ${filePath}`);

  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;

  for await (const line of rl) {
    const fields = line.split('|');

    // Extract key fields — MLAR 2018+ pipe-delimited (0-indexed)
    // Reference: https://ffiec.cfpb.gov/documentation/publications/modified-lar/modified-lar-schema
    //  0: activity_year
    //  1: lei
    //  2: loan_type          1=Conventional 2=FHA 3=VA 4=FSA/RHS
    //  3: loan_purpose       1=Purchase 2=Home Improvement 31=Refinancing 32=Cash-out 4=Other 5=N/A
    //  4: preapproval        1=Requested 2=Not requested
    //  5: construction_method 1=Site-built 2=Manufactured
    //  6: occupancy_type     1=Principal 2=Second 3=Investment
    //  7: loan_amount
    //  8: action_taken       1=Originated 2=Approved-not-accepted 3=Denied ...
    //  9: state
    // 10: county
    // 48: lien_status        1=First lien 2=Subordinate
    // 70: property_value
    // 73: total_units
    // 83: open_end_line_of_credit  1=Open-end 2=Not open-end
    const lei = fields[1];           // Legal Entity Identifier (lender)
    const loanType = fields[2];      // 1=Conventional, 2=FHA, 3=VA, 4=FSA/RHS
    const loanPurpose = fields[3];   // 1=Purchase, 2=Home Improvement, 31=Refinancing, 32=Cash-out, 4=Other, 5=N/A
    const openEndLOC = fields[83];   // 1=open-end line of credit, 2=not open-end (closed-end)
    const lienStatus = fields[48];   // 1=first lien, 2=subordinate lien
    const actionTaken = fields[8];   // 1=originated
    const loanAmount = parseFloat(fields[7]) || 0;
    const state = fields[9];
    const countyCode = fields[10];
    const propertyValue = parseFloat(fields[70]) || 0; // property_value field
    const totalUnits = fields[73];   // 1=1-unit, 2=2-unit, 3=3-unit, 4=4-unit, 5=5-24, etc.

    // Filter: originated loans only
    if (actionTaken !== '1') continue;
    // Filter: first lien only (secured by a first lien)
    if (lienStatus !== '1') continue;
    // Filter: closed-end loans only (exclude open-end lines of credit)
    if (openEndLOC !== '2') continue;
    // Filter: 1-4 unit residential properties only
    if (!['1', '2', '3', '4'].includes(totalUnits)) continue;
    // Filter: include only Purchase (1) and Refinancing (31)
    // Excludes: Home Improvement (2), Cash-out Refi (32), Other (4), Not Applicable (5)
    if (!['1', '31'].includes(loanPurpose)) continue;
    // Filter: must have a valid loan amount
    if (loanAmount === 0) continue;

    // Look up MSA from county code
    const msaInfo = countyToMSA[countyCode];
    const msa = msaInfo?.msa;
    const msaName = msaInfo?.name;

    // Aggregate by State
    if (state) {
      if (!aggregations.byState[year]) aggregations.byState[year] = {};
      if (!aggregations.byState[year][state]) {
        aggregations.byState[year][state] = {
          state,
          count: 0,
          totalAmount: 0,
          purchaseCount: 0,
          purchaseAmount: 0,
          refinanceCount: 0,
          refinanceAmount: 0,
          _propertyValues: [],
          _purchasePropertyValues: [],
          _refinancePropertyValues: []
        };
      }

      const stateAgg = aggregations.byState[year][state];
      stateAgg.count++;
      stateAgg.totalAmount += loanAmount;
      if (propertyValue > 0) stateAgg._propertyValues.push(propertyValue);

      if (loanPurpose === '1') {
        stateAgg.purchaseCount++;
        stateAgg.purchaseAmount += loanAmount;
        if (propertyValue > 0) stateAgg._purchasePropertyValues.push(propertyValue);
      } else if (loanPurpose === '31') {
        stateAgg.refinanceCount++;
        stateAgg.refinanceAmount += loanAmount;
        if (propertyValue > 0) stateAgg._refinancePropertyValues.push(propertyValue);
      }
    }

    // Aggregate by MSA (for Top 50 Metro Markets table)
    if (msa && msaName) {
      if (!aggregations.topMetros[year]) aggregations.topMetros[year] = {};
      if (!aggregations.topMetros[year][msa]) {
        aggregations.topMetros[year][msa] = {
          msa,
          msaName,
          totalCount: 0,
          totalAmount: 0,
          purchaseCount: 0,
          purchaseAmount: 0,
          refinanceCount: 0,
          refinanceAmount: 0,
          _propertyValues: [],
          _purchasePropertyValues: [],
          _refinancePropertyValues: []
        };
      }

      const msaAgg = aggregations.topMetros[year][msa];
      msaAgg.totalCount++;
      msaAgg.totalAmount += loanAmount;
      if (propertyValue > 0) msaAgg._propertyValues.push(propertyValue);

      if (loanPurpose === '1') {
        msaAgg.purchaseCount++;
        msaAgg.purchaseAmount += loanAmount;
        if (propertyValue > 0) msaAgg._purchasePropertyValues.push(propertyValue);
      } else if (loanPurpose === '31') {
        msaAgg.refinanceCount++;
        msaAgg.refinanceAmount += loanAmount;
        if (propertyValue > 0) msaAgg._refinancePropertyValues.push(propertyValue);
      }
    }

    // Aggregate by Lender (LEI)
    if (lei) {
      if (!aggregations.byLender[year]) aggregations.byLender[year] = {};
      if (!aggregations.byLender[year][lei]) {
        // Look up respondent name from transmittal sheet mapping
        const respondentName = leiToRespondentName[year]?.[lei] || lei;
        aggregations.byLender[year][lei] = {
          lei,
          lenderName: respondentName,
          totalCount: 0,
          totalAmount: 0,
          purchaseCount: 0,
          purchaseAmount: 0,
          refinanceCount: 0,
          refinanceAmount: 0,
          _propertyValues: [],
          _purchasePropertyValues: [],
          _refinancePropertyValues: []
        };
      }

      const lenderAgg = aggregations.byLender[year][lei];
      lenderAgg.totalCount++;
      lenderAgg.totalAmount += loanAmount;
      if (propertyValue > 0) lenderAgg._propertyValues.push(propertyValue);

      if (loanPurpose === '1') {
        lenderAgg.purchaseCount++;
        lenderAgg.purchaseAmount += loanAmount;
        if (propertyValue > 0) lenderAgg._purchasePropertyValues.push(propertyValue);
      } else if (loanPurpose === '31') {
        lenderAgg.refinanceCount++;
        lenderAgg.refinanceAmount += loanAmount;
        if (propertyValue > 0) lenderAgg._refinancePropertyValues.push(propertyValue);
      }
    }

    // Aggregate by Loan Purpose
    if (loanPurpose) {
      if (!aggregations.byLoanPurpose[year]) aggregations.byLoanPurpose[year] = {};
      if (!aggregations.byLoanPurpose[year][loanPurpose]) {
        aggregations.byLoanPurpose[year][loanPurpose] = {
          loanPurpose,
          loanPurposeLabel: LOAN_PURPOSE_LABELS[loanPurpose] || `Purpose ${loanPurpose}`,
          count: 0,
          totalAmount: 0
        };
      }
      aggregations.byLoanPurpose[year][loanPurpose].count++;
      aggregations.byLoanPurpose[year][loanPurpose].totalAmount += loanAmount;
    }

    // Aggregate by Loan Type
    if (loanType) {
      if (!aggregations.byLoanType[year]) aggregations.byLoanType[year] = {};
      if (!aggregations.byLoanType[year][loanType]) {
        aggregations.byLoanType[year][loanType] = {
          loanType,
          loanTypeLabel: LOAN_TYPE_LABELS[loanType] || `Type ${loanType}`,
          count: 0,
          totalAmount: 0
        };
      }
      aggregations.byLoanType[year][loanType].count++;
      aggregations.byLoanType[year][loanType].totalAmount += loanAmount;
    }

    // Aggregate by Dollar Amount Bucket
    const bucket = getDollarBucket(loanAmount);
    if (!aggregations.byDollarAmount[year]) aggregations.byDollarAmount[year] = {};
    if (!aggregations.byDollarAmount[year][bucket]) {
      aggregations.byDollarAmount[year][bucket] = {
        bucket,
        count: 0,
        totalAmount: 0
      };
    }
    aggregations.byDollarAmount[year][bucket].count++;
    aggregations.byDollarAmount[year][bucket].totalAmount += loanAmount;

    count++;
    if (count % 100000 === 0) {
      console.log(`  Processed ${count.toLocaleString()} records...`);
    }
  }

  console.log(`  Completed: ${count.toLocaleString()} records processed for ${year}\n`);
  return count;
}

function getDollarBucket(amount) {
  if (amount < 100000) return '$0-$100k';
  if (amount < 200000) return '$100k-$200k';
  if (amount < 300000) return '$200k-$300k';
  if (amount < 400000) return '$300k-$400k';
  if (amount < 500000) return '$400k-$500k';
  if (amount < 750000) return '$500k-$750k';
  if (amount < 1000000) return '$750k-$1M';
  return '$1M+';
}

function computeMedian(arr) {
  if (!arr || arr.length === 0) return 0;
  arr.sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function calculateAveragesAndPercentages() {
  console.log('Calculating averages and percentages...');

  // Process state aggregations and calculate totals (similar to MSA)
  for (const year in aggregations.byState) {
    const states = Object.values(aggregations.byState[year]);

    const totalCount = states.reduce((sum, s) => sum + s.count, 0);
    const totalAmount = states.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurchaseCount = states.reduce((sum, s) => sum + s.purchaseCount, 0);
    const totalPurchaseAmount = states.reduce((sum, s) => sum + s.purchaseAmount, 0);
    const totalRefinanceCount = states.reduce((sum, s) => sum + s.refinanceCount, 0);
    const totalRefinanceAmount = states.reduce((sum, s) => sum + s.refinanceAmount, 0);

    states.forEach(data => {
      // Rename count to totalCount for consistency
      data.totalCount = data.count;
      delete data.count;

      data.avgLoanSize = data.totalCount > 0 ? data.totalAmount / data.totalCount : 0;
      data.avgPurchaseSize = data.purchaseCount > 0 ? data.purchaseAmount / data.purchaseCount : 0;
      data.avgRefinanceSize = data.refinanceCount > 0 ? data.refinanceAmount / data.refinanceCount : 0;

      // Compute median property values
      data.medianHomeValue = computeMedian(data._propertyValues);
      data.medianPurchaseHomeValue = computeMedian(data._purchasePropertyValues);
      data.medianRefinanceHomeValue = computeMedian(data._refinancePropertyValues);
      delete data._propertyValues;
      delete data._purchasePropertyValues;
      delete data._refinancePropertyValues;

      // Add percentage calculations
      data.totalPctCount = totalCount > 0 ? (data.totalCount / totalCount) * 100 : 0;
      data.totalPctAmount = totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0;
      data.purchasePctCount = totalPurchaseCount > 0 ? (data.purchaseCount / totalPurchaseCount) * 100 : 0;
      data.purchasePctAmount = totalPurchaseAmount > 0 ? (data.purchaseAmount / totalPurchaseAmount) * 100 : 0;
      data.refinancePctCount = totalRefinanceCount > 0 ? (data.refinanceCount / totalRefinanceCount) * 100 : 0;
      data.refinancePctAmount = totalRefinanceAmount > 0 ? (data.refinanceAmount / totalRefinanceAmount) * 100 : 0;
    });

    // Sort by total count and take top 50
    aggregations.byState[year] = states
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 50);
  }

  // Process MSA aggregations and calculate totals
  for (const year in aggregations.topMetros) {
    const metros = Object.values(aggregations.topMetros[year]);

    const totalCount = metros.reduce((sum, m) => sum + m.totalCount, 0);
    const totalAmount = metros.reduce((sum, m) => sum + m.totalAmount, 0);
    const totalPurchaseCount = metros.reduce((sum, m) => sum + m.purchaseCount, 0);
    const totalPurchaseAmount = metros.reduce((sum, m) => sum + m.purchaseAmount, 0);
    const totalRefinanceCount = metros.reduce((sum, m) => sum + m.refinanceCount, 0);
    const totalRefinanceAmount = metros.reduce((sum, m) => sum + m.refinanceAmount, 0);

    metros.forEach(metro => {
      metro.totalPctCount = totalCount > 0 ? (metro.totalCount / totalCount) * 100 : 0;
      metro.totalPctAmount = totalAmount > 0 ? (metro.totalAmount / totalAmount) * 100 : 0;
      metro.avgTotalLoanSize = metro.totalCount > 0 ? metro.totalAmount / metro.totalCount : 0;

      metro.purchasePctCount = totalPurchaseCount > 0 ? (metro.purchaseCount / totalPurchaseCount) * 100 : 0;
      metro.purchasePctAmount = totalPurchaseAmount > 0 ? (metro.purchaseAmount / totalPurchaseAmount) * 100 : 0;
      metro.avgPurchaseLoanSize = metro.purchaseCount > 0 ? metro.purchaseAmount / metro.purchaseCount : 0;

      metro.refinancePctCount = totalRefinanceCount > 0 ? (metro.refinanceCount / totalRefinanceCount) * 100 : 0;
      metro.refinancePctAmount = totalRefinanceAmount > 0 ? (metro.refinanceAmount / totalRefinanceAmount) * 100 : 0;
      metro.avgRefinanceLoanSize = metro.refinanceCount > 0 ? metro.refinanceAmount / metro.refinanceCount : 0;

      // Compute median property values
      metro.medianHomeValue = computeMedian(metro._propertyValues);
      metro.medianPurchaseHomeValue = computeMedian(metro._purchasePropertyValues);
      metro.medianRefinanceHomeValue = computeMedian(metro._refinancePropertyValues);
      delete metro._propertyValues;
      delete metro._purchasePropertyValues;
      delete metro._refinancePropertyValues;
    });

    // Sort by total count and take top 50
    aggregations.topMetros[year] = metros
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 50);
  }

  // Process lender aggregations and calculate totals
  for (const year in aggregations.byLender) {
    const lenders = Object.values(aggregations.byLender[year]);

    const totalCount = lenders.reduce((sum, l) => sum + l.totalCount, 0);
    const totalAmount = lenders.reduce((sum, l) => sum + l.totalAmount, 0);
    const totalPurchaseCount = lenders.reduce((sum, l) => sum + l.purchaseCount, 0);
    const totalPurchaseAmount = lenders.reduce((sum, l) => sum + l.purchaseAmount, 0);
    const totalRefinanceCount = lenders.reduce((sum, l) => sum + l.refinanceCount, 0);
    const totalRefinanceAmount = lenders.reduce((sum, l) => sum + l.refinanceAmount, 0);

    lenders.forEach(lender => {
      lender.totalPctCount = totalCount > 0 ? (lender.totalCount / totalCount) * 100 : 0;
      lender.totalPctAmount = totalAmount > 0 ? (lender.totalAmount / totalAmount) * 100 : 0;
      lender.avgTotalLoanSize = lender.totalCount > 0 ? lender.totalAmount / lender.totalCount : 0;

      lender.purchasePctCount = totalPurchaseCount > 0 ? (lender.purchaseCount / totalPurchaseCount) * 100 : 0;
      lender.purchasePctAmount = totalPurchaseAmount > 0 ? (lender.purchaseAmount / totalPurchaseAmount) * 100 : 0;
      lender.avgPurchaseLoanSize = lender.purchaseCount > 0 ? lender.purchaseAmount / lender.purchaseCount : 0;

      lender.refinancePctCount = totalRefinanceCount > 0 ? (lender.refinanceCount / totalRefinanceCount) * 100 : 0;
      lender.refinancePctAmount = totalRefinanceAmount > 0 ? (lender.refinanceAmount / totalRefinanceAmount) * 100 : 0;
      lender.avgRefinanceLoanSize = lender.refinanceCount > 0 ? lender.refinanceAmount / lender.refinanceCount : 0;

      // Compute median property values
      lender.medianHomeValue = computeMedian(lender._propertyValues);
      lender.medianPurchaseHomeValue = computeMedian(lender._purchasePropertyValues);
      lender.medianRefinanceHomeValue = computeMedian(lender._refinancePropertyValues);
      delete lender._propertyValues;
      delete lender._purchasePropertyValues;
      delete lender._refinancePropertyValues;
    });

    // Sort by total count and take top 50
    aggregations.byLender[year] = lenders
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 50);
  }

  // Process loan purpose
  for (const year in aggregations.byLoanPurpose) {
    for (const purpose in aggregations.byLoanPurpose[year]) {
      const data = aggregations.byLoanPurpose[year][purpose];
      data.avgLoanSize = data.count > 0 ? data.totalAmount / data.count : 0;
    }
  }

  // Process loan type
  for (const year in aggregations.byLoanType) {
    for (const type in aggregations.byLoanType[year]) {
      const data = aggregations.byLoanType[year][type];
      data.avgLoanSize = data.count > 0 ? data.totalAmount / data.count : 0;
    }
  }

  console.log('Calculations complete.\n');
}

function saveAggregations() {
  console.log('Saving aggregated data to JSON files...');

  const outputDir = join(__dirname, '../public/data');
  mkdirSync(outputDir, { recursive: true });

  // Save each aggregation type
  const files = [
    { name: 'by-state.json', data: aggregations.byState },
    { name: 'top-metros.json', data: aggregations.topMetros },
    { name: 'by-lender.json', data: aggregations.byLender },
    { name: 'by-loan-purpose.json', data: aggregations.byLoanPurpose },
    { name: 'by-loan-type.json', data: aggregations.byLoanType },
    { name: 'by-dollar-amount.json', data: aggregations.byDollarAmount }
  ];

  files.forEach(({ name, data }) => {
    const filePath = join(outputDir, name);
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`  ✓ Saved ${name}`);
  });

  console.log('\nAll aggregations saved successfully!\n');
}

async function main() {
  const hmdaPath = join(homedir(), 'HMDA');
  const startTime = Date.now();

  const files = [
    { path: join(hmdaPath, '2023_combined_mlar', '2023_combined_mlar.txt'), year: '2023' },
    { path: join(hmdaPath, '2024_combined_mlar', '2024_combined_mlar.txt'), year: '2024' }
  ];

  let totalRecords = 0;
  for (const file of files) {
    const count = await processHMDAFile(file.path, file.year);
    totalRecords += count;
  }

  calculateAveragesAndPercentages();
  saveAggregations();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('=== Aggregation Complete ===');
  console.log(`Total records processed: ${totalRecords.toLocaleString()}`);
  console.log(`Time taken: ${duration} seconds`);
  console.log(`Average speed: ${(totalRecords / duration).toFixed(0)} records/second\n`);
}

main().catch(err => {
  console.error('Error during aggregation:', err);
  process.exit(1);
});
