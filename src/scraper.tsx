import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import { parse } from 'node-html-parser';
import { cleanTrendsDataArray, convertCleanedDataToCSV, CleanedTrendData } from './data-cleaner';

async function run(): Promise<void> {
  /**
   * Launches a Chromium browser and extracts trending topics from Google Trends.
   */
  const browser: Browser = await chromium.launch({ headless: false });
  
  // Create a new browser context
  const context: BrowserContext = await browser.newContext();
  
  // Open a new page in the browser context
  const page: Page = await context.newPage();
  
  // Navigate to the Google Trends page for the US
  await page.goto("https://trends.google.com/trending?geo=US");
  await page.waitForLoadState('load', { timeout: 30000 });
  
  // Get the page content as a string
  const response: string = await page.content();
  console.log(response.length);
  
  // Parse the HTML content using node-html-parser
  const root = parse(response);
  
  // Extract all row elements containing trending topics
  const rows = root.querySelectorAll('tr[role="row"]');
  console.log(rows.length);
  
  // Initialize an array to store the extracted data
  const data: string[][] = [];
  
  // Iterate over each row and extract relevant data
  for (const element of rows) {
    const rowData: string[] = [];
    
    // Extract text from td/div elements
    const tdDivs = element.querySelectorAll('td div');
    tdDivs.forEach(div => {
      const text = div.text.trim();
      if (text) {
        rowData.push(text);
      }
    });
    
    // Extract text from td/div/div elements
    const tdDivDivs = element.querySelectorAll('td div div');
    if (tdDivDivs.length > 0) {
      const text = tdDivDivs[0].text.trim();
      if (text) {
        rowData.push(text);
      }
    }
    
    if (rowData.length > 0) {
      data.push(rowData);
    }
  }
  
  // Clean the extracted data
  const cleanedData: CleanedTrendData[] = cleanTrendsDataArray(data);
  
  // Create CSV content from cleaned data
  const csvContent: string = convertCleanedDataToCSV(cleanedData);
  
  // Create timestamp for filename
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  const filename = `trending_topics_${timestamp}.csv`;
  
  // Write the extracted data to a CSV file with timestamp
  fs.writeFileSync(filename, csvContent, 'utf8');
  console.log(`Data saved to: ${filename}`);
  
  // Close the browser context and browser
  await context.close();
  await browser.close();
}

async function main(): Promise<void> {
  /**
   * Runs the Playwright script.
   */
  await run();
}

// Execute the main function
main().catch(console.error);