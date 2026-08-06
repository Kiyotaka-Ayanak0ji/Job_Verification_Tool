import { env } from "../config/env.js";

/**
 * Reddit service for fetching posts and comments about companies
 * Uses Reddit's public API (no authentication required for read-only access)
 */
export async function searchCompanyPosts(companyName, limit = 10) {
  try {
    // Search for posts mentioning the company in relevant subreddits
    const query = encodeURIComponent(`"${companyName}"`);
    const url = `https://www.reddit.com/search.json?q=${query}&sort=relevance&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TrustHire-Verification-Bot/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract posts and comments
    const posts = data.data.children.map(child => child.data);

    // Get comments for each post to analyze sentiment
    const postsWithComments = await Promise.all(
      posts.map(async (post) => {
        try {
          const commentsUrl = `https://www.reddit.com${data.permalink}.json`;
          const commentsResponse = await fetch(commentsUrl, {
            headers: {
              'User-Agent': 'TrustHire-Verification-Bot/1.0'
            }
          });

          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            // Comments are in the second array element
            const comments = commentsData[1]?.data?.children || [];
            post.comments = comments.map(c => c.data.body || '').filter(Boolean);
          } else {
            post.comments = [];
          }
        } catch (commentError) {
          // If we can't get comments, continue with just the post
          post.comments = [];
        }
        return post;
      })
    );

    return postsWithComments;
  } catch (error) {
    console.error('[RedditService] Error fetching posts:', error.message);
    return [];
  }
}

/**
 * Analyze sentiment of text (simple rule-based approach)
 * Returns score between -1 (very negative) and 1 (very positive)
 */
export function analyzeSentiment(text) {
  if (!text) return 0;

  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'fantastic', 'positive', 'recommend',
    'best', 'better', 'love', 'loved', 'awesome', 'fantastic', 'perfect',
    'legit', 'legitimate', 'real', 'genuine', 'trustworthy', 'reliable'
  ];

  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'scam', 'fraud', 'fake',
    'fake', 'lie', 'lied', 'sued', 'lawsuit', 'complaint', 'angry', 'disappointed',
    'rip off', 'ripoff', 'avoid', 'warning', 'danger', 'illegal', 'lawsuit',
    'not paying', 'didn\\'t pay', 'withheld wages', 'unpaid', 'scam artist'
  ];

  const textLower = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    const matches = textLower.matchAll(new RegExp(`\\b${word}\\b`, 'g'));
    for (const match of matches) {
      positiveCount++;
    }
  });

  negativeWords.forEach(word => {
    const matches = textLower.matchAll(new RegExp(`\\\\b${word}\\\\b`, 'g'));
    for (const match of matches) {
      negativeCount++;
    }
  });

  const total = positiveCount + negativeCount;
  if (total === 0) return 0;

  return (positiveCount - negativeCount) / total;
}

/**
 * Get aggregated sentiment score for a company from Reddit
 * Returns object with sentiment score (-1 to 1) and confidence level
 */
export async function getCompanySentiment(companyName) {
  try {
    const posts = await searchCompanyPosts(companyName, 10);

    if (posts.length === 0) {
      return {
        sentiment: 0,
        confidence: 0,
        postCount: 0,
        commentCount: 0
      };
    }

    // Analyze sentiment of posts and comments
    let totalScore = 0;
    let totalItems = 0;

    for (const post of posts) {
      // Analyze post title and content
      const postText = `${post.title || ''} ${post.selftext || ''}`;
      const postSentiment = analyzeSentiment(postText);
      totalScore += postSentiment;
      totalItems++;

      // Analyze comments
      for (const comment of post.comments || []) {
        const commentSentiment = analyzeSentiment(comment);
        totalScore += commentSentiment;
        totalItems++;
      }
    }

    const averageSentiment = totalItems > 0 ? totalScore / totalItems : 0;
    const confidence = Math.min(1.0, totalItems / 20); // Max confidence at 20+ items

    return {
      sentiment: averageSentiment, // -1 to 1
      confidence: confidence, // 0 to 1
      postCount: posts.length,
      commentCount: posts.reduce((sum, post) => sum + (post.comments?.length || 0), 0)
    };
  } catch (error) {
    console.error('[RedditService] Error getting company sentiment:', error.message);
    return {
      sentiment: 0,
      confidence: 0,
      postCount: 0,
      commentCount: 0
    };
  }
}