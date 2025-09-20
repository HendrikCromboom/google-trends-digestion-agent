interface CleanedTrendData {
  trendName: string;
  searchVolume: string;
  timeAgo: string;
  growthPercentage: string;
  relatedSearches: string[];
}

function cleanTrendsData(rawData: string): CleanedTrendData {
  // Split the data by commas and clean quotes
  const fields: string[] = rawData.split(',').map(field => field.replace(/"/g, '').trim());
  
  // Extract key information
  const result: CleanedTrendData = {
    trendName: '',
    searchVolume: '',
    timeAgo: '',
    growthPercentage: '',
    relatedSearches: []
  };
  
  // Get the trend name (first field)
  result.trendName = fields[0] || '';
  
  // Extract search volume (look for patterns like "200K+ searches")
  const volumeMatch: string | undefined = fields.find(field => 
    field.includes('searches') && (field.includes('K+') || field.includes('M+') || /\d+/.test(field))
  );
  if (volumeMatch) {
    const match: RegExpMatchArray | null = volumeMatch.match(/(\d+[KM]?\+?)\s*searches?/i);
    result.searchVolume = match ? match[1] : '';
  }
  
  // Extract time ago (look for patterns like "20h ago", "2 hours ago")
  const timeMatch: string | undefined = fields.find(field => 
    field.includes('ago') || field.includes('hours ago') || field.includes('h ago')
  );
  if (timeMatch) {
    const match: RegExpMatchArray | null = timeMatch.match(/(\d+\s*(?:hours?|h)\s*ago)/i);
    result.timeAgo = match ? match[1] : timeMatch.replace(/^·/, '').trim();
  }
  
  // Extract growth percentage (look for patterns like "1,000%", "arrow_upward1,000%")
  const growthMatch: string | undefined = fields.find(field => 
    field.includes('%') && (field.includes('arrow_upward') || /\d+/.test(field))
  );
  if (growthMatch) {
    const match: RegExpMatchArray | null = growthMatch.match(/(\d+,?\d*%)/);
    result.growthPercentage = match ? match[1] : '';
  }
  
  // Extract related searches (unique terms that don't contain noise)
  const relatedTerms: Set<string> = new Set();
  const noiseWords: string[] = ['Search term', 'query_statsExplore', 'More actions', 'Active', 'trending_up', 'checklistSelect', 'more_vert'];
  
  fields.forEach(field => {
    const cleanField: string = field.replace(/^·+|·+$/g, '').trim();
    
    // Skip if it's noise, too short, or contains the main trend name
    if (cleanField.length > 3 && 
        !noiseWords.some(noise => cleanField.includes(noise)) &&
        !cleanField.includes(result.trendName) &&
        !cleanField.includes('searches') &&
        !cleanField.includes('%') &&
        !cleanField.includes('ago') &&
        /^[a-zA-Z\s]+$/.test(cleanField)) {
      
      relatedTerms.add(cleanField);
    }
  });
  
  result.relatedSearches = Array.from(relatedTerms).slice(0, 5); // Limit to top 5
  
  return result;
}

// Enhanced function that handles multiple rows
function cleanTrendsDataArray(rawDataArray: (string | string[])[]): CleanedTrendData[] {
  return rawDataArray.map(row => {
    if (Array.isArray(row)) {
      // If it's already an array, join it first
      return cleanTrendsData(row.join(','));
    } else {
      // If it's a string
      return cleanTrendsData(row);
    }
  });
}

// Function to convert cleaned data back to CSV format
function convertCleanedDataToCSV(cleanedDataArray: CleanedTrendData[]): string {
  const headers: string[] = ['Trend Name', 'Search Volume', 'Time Ago', 'Growth %', 'Related Searches'];
  let csv: string = headers.join(',') + '\n';
  
  cleanedDataArray.forEach(item => {
    const row: string[] = [
      `"${item.trendName}"`,
      `"${item.searchVolume}"`,
      `"${item.timeAgo}"`,
      `"${item.growthPercentage}"`,
      `"${item.relatedSearches.join('; ')}"`
    ];
    csv += row.join(',') + '\n';
  });
  
  return csv;
}

// Export functions for use in other modules
export { 
  CleanedTrendData, 
  cleanTrendsData, 
  cleanTrendsDataArray, 
  convertCleanedDataToCSV 
};