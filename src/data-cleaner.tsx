interface CleanedTrendData {
  trendName: string;
  searchVolume: string;
  timeAgo: string;
  growthPercentage: string;
  relatedSearches: string[];
}

function cleanTrendsData(rawData: string): CleanedTrendData {
  console.log('Raw input:', rawData); // Debug log
  
  // Split the data by commas but be smarter about it - don't split inside quoted strings
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < rawData.length; i++) {
    const char = rawData[i];
    
    if (char === '"' && (i === 0 || rawData[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
      continue;
    }
    current += char;
  }
  if (current) {
    fields.push(current.trim().replace(/^"|"$/g, ''));
  }
  
  console.log('Parsed fields:', fields); // Debug log
  
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
  
  // Extract time ago (look for patterns like "20h ago", "2 hours ago", "50m ago")
  const timeMatch: string | undefined = fields.find(field => 
    field.includes('ago') || field.includes('hours ago') || field.includes('h ago') || field.includes('m ago')
  );
  if (timeMatch) {
    console.log('Time field found:', timeMatch); // Debug log
    // Updated pattern to handle minutes (m) and hours (h)
    const match: RegExpMatchArray | null = timeMatch.match(/(\d+\s*(?:hours?|h|minutes?|m)\s*ago)/i);
    result.timeAgo = match ? match[1] : timeMatch.replace(/^·/, '').trim();
    console.log('Extracted time:', result.timeAgo); // Debug log
  }
  
  // Extract growth percentage - now look for the pattern across the entire raw data
  // This handles cases where "1,000%" was split into separate fields
  const percentageMatch: RegExpMatchArray | null = rawData.match(/(\d{1,3}(?:,\d{3})*%)/);
  if (percentageMatch) {
    result.growthPercentage = percentageMatch[1];
    console.log('Found percentage in raw data:', result.growthPercentage); // Debug log
  } else {
    // Fallback: look in individual fields
    const growthMatch: string | undefined = fields.find(field => 
      field.includes('%') && /\d/.test(field)
    );
    if (growthMatch) {
      console.log('Growth field found:', growthMatch); // Debug log
      
      // Try multiple patterns to capture the percentage
      let match: RegExpMatchArray | null = null;
      
      // Pattern 1: Handle arrow_upward prefix
      match = growthMatch.match(/arrow_upward(\d{1,3}(?:,\d{3})*%)/);
      
      // Pattern 2: Handle standalone percentage
      if (!match) {
        match = growthMatch.match(/(\d{1,3}(?:,\d{3})*%)/);
      }
      
      // Pattern 3: Handle any digits followed by %
      if (!match) {
        match = growthMatch.match(/(\d+(?:,\d+)*%)/);
      }
      
      result.growthPercentage = match ? match[1] : '';
      console.log('Extracted percentage:', result.growthPercentage); // Debug log
    }
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

// Convert to CSV format
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

export { 
  CleanedTrendData, 
  cleanTrendsData, 
  cleanTrendsDataArray, 
  convertCleanedDataToCSV 
};