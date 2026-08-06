import axios from "axios";
import { env } from "../config/env.js";

/**
 * Glassdoor service for fetching company reviews and ratings
 * Note: Glassdoor has strong anti-bot measures, so this is a simplified implementation
 * In production, you might want to use official APIs or more sophisticated scraping techniques
 */
export async function getCompanyReviews(companyName, limit = 10) {
  try {
    // Note: Direct scraping of Glassdoor is challenging due to anti-bot measures
    // This is a placeholder implementation that returns structured data
    // For a real implementation, consider:
    // 1. Using Glassdoor's official API if available
    // 2. Using third-party services that provide Glassdoor data
    // 3. Implementing more sophisticated scraping with rate limiting and proxies

    // For now, we'll return empty results and rely on other data sources
    // This maintains compatibility while allowing for future enhancement

    // Try to get data from alternative sources if available
    try {
      // Attempt to use a general search API or service if configured
      if (env.GLASSDOOR_API_KEY) {
        const response = await axios.get('https://api.glassdoor.com/api/api.htm', {
          params: {
            v: '1',
            format: 'json',
            t.p: 'YOUR_PARTNER_ID',
            t.k: 'YOUR_API_KEY',
            userip: '0.0.0.0',
            useragent: '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"',
            action: 'employers',
            q: companyName
          },
          timeout: 5000
        });

        if (response.data && response.data.response &&
            response.data.response.employers &&
            response.data.response.employers.length > 0) {

          const employer = response.data.response.employers[0];
          return {
            rating: employer.overallRating || 0,
            reviewCount: employer.numberOfRatings || 0,
            reviews: [] // Would contain actual review texts in a full implementation
          };
        }
      }
    } catch (apiError) {
      // Fall through to return empty result
      console.warn('[GlassdoorService] API attempt failed:', apiError.message);
    }

    // Return empty structure - no Glassdoor data available
    return {
      rating: 0,
      reviewCount: 0,
      reviews: []
    };
  } catch (error) {
    console.error('[GlassdoorService] Error fetching reviews:', error.message);
    return {
      rating: 0,
      reviewCount: 0,
      reviews: []
    };
  }
}

/**
 * Extract sentiment from review text
 * Returns score between -1 (very negative) and 1 (very positive)
 */
export function extractReviewSentiment(reviewText) {
  if (!reviewText) return 0;

  // Similar sentiment analysis as Reddit service but tuned for reviews
  const positiveIndicators = [
    'recommend', 'recommended', 'great', 'excellent', 'good', 'best',
    'positive', 'happy', 'satisfied', 'worth it', 'valuable', 'learning',
    'growth', 'opportunity', 'flexible', 'benefits', 'culture', 'team',
    'management', 'leadership', 'work-life balance', 'compensation'
  ];

  const negativeIndicators = [
    'not recommend', 'avoid', 'terrible', 'awful', 'bad', 'worst',
    'disappointed', 'unhappy', 'miserable', 'toxic', 'stressful',
    'overworked', 'underpaid', 'poor management', 'no growth',
    'layoffs', 'fired', 'quit', 'resigned', 'stress', 'burnout',
    'micromanaged', 'favoritism', 'discrimination', 'harassment'
  ];

  const textLower = reviewText.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;

  positiveIndicators.forEach(word => {
    if (textLower.includes(word)) {
      positiveScore += 1;
    }
  });

  negativeIndicators.forEach(word => {
    if (textLower.includes(word)) {
      negativeScore += 1;
    }
  });

  const total = positiveScore + negativeScore;
  if (total === 0) return 0;

  return (positiveScore - negativeScore) / Math.max(total, 1);
}

/**
 * Get aggregated sentiment and rating for a company from Glassdoor
 */
export async function getCompanyRating(companyName) {
  try {
    const result = await getCompanyReviews(companyName);

    // Convert rating (typically 0-5 scale) to -1 to 1 scale for sentiment
    // Assume 3.0 is neutral (0 sentiment), 5.0 is very positive (1.0), 1.0 is very negative (-1.0)
    const normalizedRating = (result.rating - 3) / 2; // Maps 1-5 to -1 to 1

    // Analyze sentiment from review texts if available
    let reviewSentiment = 0;
    if (result.reviews && result.reviews.length > 0) {
      const sentiments = result.reviews.map(review =>
        extractReviewSentiment(review.text || review.summary || '')
      );
      const validSentiments = sentiments.filter(s => !isNaN(s));
      if (validSentiments.length > 0) {
        reviewSentiment = validSentiments.reduce((sum, val) => sum + val, 0) / validSentiments.length;
      }
    }

    // Combine rating sentiment and review sentiment (weighted average)
    // Give more weight to the numerical rating as it's more reliable
    const combinedSentiment = (normalizedRating * 0.7) + (reviewSentiment * 0.3);

    // Confidence based on number of reviews
    const confidence = Math.min(1.0, result.reviewCount / 50); // Max confidence at 50+ reviews

    return {
      rating: result.rating, // Original 0-5 scale
      sentiment: Math.max(-1, Math.min(1, combinedSentiment)), // Ensure -1 to 1 range
      confidence: confidence,
      reviewCount: result.reviewCount
    };
  } catch (error) {
    console.error('[GlassdoorService] Error getting company rating:', error.message);
    return {
      rating: 0,
      sentiment: 0,
      confidence: 0,
      reviewCount: 0
    };
  }
}