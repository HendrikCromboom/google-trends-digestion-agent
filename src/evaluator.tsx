import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from 'fs';
import { CleanedTrendData } from './data-cleaner';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define your domains of interest
interface DomainOfInterest {
  name: string;
  description: string;
  keywords: string[];
  examples: string[];
}

const DOMAINS_OF_INTEREST: DomainOfInterest[] = [
  {
    name: "Technology & AI",
    description: "Artificial intelligence, machine learning, software development, tech companies, programming languages, tech trends",
    keywords: ["AI", "machine learning", "software", "tech", "programming", "blockchain", "crypto", "startup"],
    examples: ["ChatGPT", "iPhone release", "Google AI", "Tesla", "cryptocurrency crash"]
  }
];

interface DomainEvaluation {
  domain: string;
  relevance: number;
  reasoning: string;
  isMatch: boolean;
}

interface EvaluationResult {
  trend: string;
  classification: string;
  confidence: number;
  reasoning: string;
  domainEvaluations: DomainEvaluation[];
  searchVolume: string;
  growth: string;
  timeAgo: string;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

class TopicEvaluator {
  async evaluateTrend(trendData: CleanedTrendData): Promise<EvaluationResult> {
    console.log(`🔍 Evaluating: ${trendData.trendName}`);
    
    // Step 1: Evaluate against each domain
    const domainEvaluations = await this.evaluateAgainstDomains(trendData);
    
    // Step 2: Determine final classification
    const { classification, confidence, reasoning } = await this.getFinalClassification(trendData, domainEvaluations);
    
    return {
      trend: trendData.trendName,
      classification,
      confidence,
      reasoning,
      domainEvaluations,
      searchVolume: trendData.searchVolume,
      growth: trendData.growthPercentage,
      timeAgo: trendData.timeAgo
    };
  }

  private async evaluateAgainstDomains(trendData: CleanedTrendData): Promise<DomainEvaluation[]> {
    const evaluations: DomainEvaluation[] = [];
    
    for (const domain of DOMAINS_OF_INTEREST) {
      try {
        const evaluation = await this.evaluateSingleDomain(trendData, domain);
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`❌ Error evaluating ${domain.name}:`, error);
        evaluations.push({
          domain: domain.name,
          relevance: 0,
          reasoning: "Error during evaluation",
          isMatch: false
        });
      }
    }
    
    return evaluations;
  }

  private async evaluateSingleDomain(trendData: CleanedTrendData, domain: DomainOfInterest): Promise<DomainEvaluation> {
    const prompt = `
You are an expert content classifier. Evaluate how relevant this trending topic is to the given domain.

TRENDING TOPIC:
- Name: ${trendData.trendName}
- Search Volume: ${trendData.searchVolume}
- Growth: ${trendData.growthPercentage}
- Related Searches: ${trendData.relatedSearches.join(', ')}

DOMAIN TO EVALUATE:
- Name: ${domain.name}
- Description: ${domain.description}
- Keywords: ${domain.keywords.join(', ')}
- Examples: ${domain.examples.join(', ')}

Please provide:
1. A relevance score from 0-10 (10 = highly relevant, 0 = not relevant at all)
2. A brief explanation of your reasoning
3. Whether this is a clear match (true/false)

Respond in JSON format:
{
  "relevance": <number>,
  "reasoning": "<explanation>",
  "isMatch": <boolean>
}
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const evaluation = JSON.parse(jsonMatch[0]);
    
    return {
      domain: domain.name,
      relevance: evaluation.relevance || 0,
      reasoning: evaluation.reasoning || 'No reasoning provided',
      isMatch: evaluation.isMatch || false
    };
  }

  private async getFinalClassification(
    trendData: CleanedTrendData, 
    evaluations: DomainEvaluation[]
  ): Promise<{ classification: string; confidence: number; reasoning: string }> {
    
    // Find the highest scoring domain
    const bestMatch = evaluations.reduce((best, current) => 
      current.relevance > best.relevance ? current : best
    );
    
    // Determine if we have a confident classification
    const threshold = 6; // Minimum relevance score for classification
    const classification = bestMatch.relevance >= threshold ? bestMatch.domain : "Other/Unclassified";
    const confidence = bestMatch.relevance / 10;
    
    // Generate overall reasoning with Gemini
    const prompt = `
Based on these domain evaluations for the trending topic "${trendData.trendName}", provide a final summary:

EVALUATIONS:
${evaluations.map(e => `- ${e.domain}: ${e.relevance}/10 - ${e.reasoning}`).join('\n')}

BEST MATCH: ${classification} (confidence: ${(confidence * 100).toFixed(1)}%)

Provide a concise final reasoning (2-3 sentences) for this classification:
`;

    try {
      const result = await model.generateContent(prompt);
      const reasoning = result.response.text().trim();
      
      return { classification, confidence, reasoning };
    } catch (error) {
      return {
        classification,
        confidence,
        reasoning: `Classified as ${classification} based on highest relevance score of ${bestMatch.relevance}/10`
      };
    }
  }
}

// Main evaluation function
export async function evaluateTopics(csvFilePath: string): Promise<void> {
  const evaluator = new TopicEvaluator();
  
  try {
    // Read and parse CSV
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvContent.split('\n').slice(1).filter(line => line.trim());
    
    const results: EvaluationResult[] = [];
    
    for (const line of lines) {
      // Parse CSV line (basic parsing)
      const [name, volume, timeAgo, growth, relatedSearches] = line.split(',').map(field => 
        field.replace(/^"|"$/g, '').trim()
      );
      
      if (!name) continue;
      
      const trendData: CleanedTrendData = {
        trendName: name,
        searchVolume: volume || '',
        timeAgo: timeAgo || '',
        growthPercentage: growth || '',
        relatedSearches: relatedSearches ? relatedSearches.split(';').map(s => s.trim()) : []
      };
      
      // Evaluate the trend
      const result = await evaluator.evaluateTrend(trendData);
      results.push(result);
      
      console.log(`✅ ${result.trend} → ${result.classification} (${(result.confidence * 100).toFixed(1)}%)`);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = `trend_evaluations_${timestamp}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\n📊 Evaluation complete! Results saved to: ${outputPath}`);
    console.log(`📈 Processed ${results.length} trends`);
    
    // Summary statistics
    const classifications = results.reduce((acc, r) => {
      acc[r.classification] = (acc[r.classification] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📋 Classification Summary:');
    Object.entries(classifications).forEach(([classification, count]) => {
      console.log(`   ${classification}: ${count} trends`);
    });
    
  } catch (error) {
    console.error('❌ Error during evaluation:', error);
  }
}

// Usage
if (require.main === module) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Please set GEMINI_API_KEY environment variable');
    process.exit(1);
  }
  
  const csvFile = process.argv[2] || 'trending_topics_latest.csv';
  evaluateTopics(csvFile);
}