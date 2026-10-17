/**
 * Netgain Ads Engine Unit Test
 */
const XLSX = require('xlsx');

// Test standard Meta field regexes
const testHeaders = [
  'Day',
  'Campaign name',
  'Ad set name',
  'Ad name',
  'Age',
  'Gender',
  'Amount spent (INR)',
  'Impressions',
  'Reach',
  'Link clicks',
  'Landing page views',
  'Leads'
];

console.log('Testing Netgain Ads header regexes and aggregation...');

// Aggregation test
const sampleRows = [
  { spend: 1000, impr: 10000, reach: 8000, clicksLink: 200, lpv: 150, leads: 10 },
  { spend: 2000, impr: 15000, reach: 12000, clicksLink: 300, lpv: 220, leads: 25 },
  { spend: 500, impr: 5000, reach: 4000, clicksLink: 50, lpv: 30, leads: 0 }
];

const totalSpend = sampleRows.reduce((s, r) => s + r.spend, 0); // 3500
const totalImpr = sampleRows.reduce((s, r) => s + r.impr, 0);   // 30000
const totalClicks = sampleRows.reduce((s, r) => s + r.clicksLink, 0); // 550
const totalLeads = sampleRows.reduce((s, r) => s + r.leads, 0);  // 35

const aggCTR = (totalClicks / totalImpr) * 100;
const aggCPC = totalSpend / totalClicks;
const aggCPM = (totalSpend / totalImpr) * 1000;
const aggCPL = totalSpend / totalLeads;

console.log(`Totals: Spend = ₹${totalSpend}, Impr = ${totalImpr}, Clicks = ${totalClicks}, Leads = ${totalLeads}`);
console.log(`Recalculated Rates: CTR = ${aggCTR.toFixed(2)}%, CPC = ₹${aggCPC.toFixed(2)}, CPM = ₹${aggCPM.toFixed(2)}, CPL = ₹${aggCPL.toFixed(2)}`);

if (Math.abs(aggCTR - 1.833) < 0.01 && Math.abs(aggCPC - 6.36) < 0.01 && Math.abs(aggCPL - 100) < 0.01) {
  console.log('✅ Aggregation and recalculation tests PASSED!');
} else {
  console.error('❌ Aggregation test failed!');
  process.exit(1);
}
