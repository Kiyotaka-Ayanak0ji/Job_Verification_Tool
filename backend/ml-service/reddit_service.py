"""
Reddit service for fetching Reddit posts and comments about companies
using the Reddit API (PRAW - Python Reddit API Wrapper)
"""
import praw
import logging
import os
from typing import Dict, List, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class RedditService:
    def __init__(self):
        """Initialize Reddit API client"""
        self.reddit = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the Reddit API client with credentials from environment"""
        try:
            client_id = os.environ.get('REDDIT_CLIENT_ID')
            client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
            user_agent = os.environ.get('REDDIT_USER_AGENT', 'TrustHire-Verification-Bot/1.0')

            if not client_id or not client_secret:
                logger.warning("Reddit API credentials not found. Reddit service will be disabled.")
                return

            self.reddit = praw.Reddit(
                client_id=client_id,
                client_secret=client_secret,
                user_agent=user_agent
            )

            # Test connection
            self.reddit.user.me()
            logger.info("Reddit API client initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Reddit API client: {e}")
            self.reddit = None

    def is_available(self) -> bool:
        """Check if Reddit service is available"""
        return self.reddit is not None

    def get_company_sentiment(self, company_name: str, limit: int = 25) -> Dict[str, Any]:
        """
        Get sentiment analysis for a company from Reddit posts and comments

        Args:
            company_name: Name of the company to search for
            limit: Maximum number of posts/comments to analyze

        Returns:
            Dictionary with sentiment score (-1 to 1), confidence, and counts
        """
        if not self.is_available():
            return {
                'sentiment': 0.0,
                'confidence': 0.0,
                'post_count': 0,
                'comment_count': 0
            }

        try:
            # Search for posts mentioning the company
            search_query = f'"{company_name}"'
            posts = []
            comments = []

            # Search in relevant subreddits
            subreddits_to_search = [
                'jobs', 'careerguidance', 'recruitinghell',
                'antiwork', 'WorkOnline', 'beermoney',
                'WorkOnline', 'forhire', 'HireMe',
                'scams', 'scambait', 'fraud'
            ]

            # Also search general Reddit
            subreddits_to_search.append('all')

            search_limit = max(5, len(subreddits_to_search))

            for subreddit_name in subreddits_to_search:
                try:
                    subreddit = self.reddit.subreddit(subreddit_name)
                    search_results = subreddit.search(
                        query=search_query,
                        sort='relevance',
                        time='month',
                        limit=search_limit
                    )

                    for post in search_results:
                        posts.append({
                            'title': post.title,
                            'text': post.selftext,
                            'score': post.score,
                            'upvote_ratio': getattr(post, 'upvote_ratio', 0.5),
                            'created_utc': datetime.fromtimestamp(post.created_utc),
                            'subreddit': subreddit_name,
                            'url': f"https://reddit.com{post.permalink}"
                        })

                        # Get some comments from each post (limit to avoid too many requests)
                        try:
                            post.comments.replace_more(limit=0)  # Flatten comment tree
                            for comment in post.comments.list()[:3]:  # Top 3 comments per post
                                if hasattr(comment, 'body') and len(comment.body.strip()) > 10:
                                    comments.append({
                                        'text': comment.body,
                                        'score': comment.score,
                                        'created_utc': datetime.fromtimestamp(comment.created_utc),
                                        'subreddit': subreddit_name
                                    })
                        except Exception:
                            # Continue if we can't get comments
                            pass

                except Exception as e:
                    logger.debug(f"Error searching r/{subreddit_name}: {e}")
                    continue

            # Calculate sentiment from posts and comments
            sentiment_score = self._calculate_sentiment_from_texts(
                [p['title'] + ' ' + p['text'] for p in posts] +
                [c['text'] for c in comments]
            )

            # Confidence based on volume of data
            total_items = len(posts) + len(comments)
            confidence = min(1.0, total_items / 30)  # Max confidence at 30+ items

            return {
                'sentiment': max(-1.0, min(1.0, sentiment_score)),  # Clamp to -1 to 1
                'confidence': confidence,
                'post_count': len(posts),
                'comment_count': len(comments)
            }

        except Exception as e:
            logger.error(f"Error getting Reddit sentiment for {company_name}: {e}")
            return {
                'sentiment': 0.0,
                'confidence': 0.0,
                'post_count': 0,
                'comment_count': 0
            }

    def _calculate_sentiment_from_texts(self, texts: List[str]) -> float:
        """
        Calculate sentiment score from a list of texts
        Returns value between -1 (very negative) and 1 (very positive)
        """
        if not texts:
            return 0.0

        # Define sentiment lexicons for job/workplace context
        positive_words = {
            'great', 'excellent', 'good', 'best', 'amazing', 'fantastic', 'wonderful',
            'positive', 'recommend', 'recommended', 'love', 'loved', 'like', 'liked',
            'happy', 'happiness', 'satisfied', 'satisfactory', 'worth', 'worthwhile',
            'valuable', 'benefit', 'beneficial', 'flexible', 'flexibility', 'growth',
            'opportunity', 'advancement', 'promotion', 'raise', 'bonus', 'paid well',
            'good pay', 'fair pay', 'respect', 'respected', 'team', 'teamwork',
            'collaborative', 'supportive', 'helpful', 'understanding', 'flexible',
            'work-life balance', 'wlb', 'remote', 'flexible hours', 'good culture',
            'great culture', 'amazing culture', 'learning', 'development', 'training',
            'mentor', 'mentorship', 'leader', 'leadership', 'manager', 'management',
            'boss', 'supervisor', 'organised', 'organized', 'efficient', 'professional'
        }

        negative_words = {
            'bad', 'terrible', 'awful', 'worst', 'hate', 'hated', 'dislike', 'disliked',
            'negative', 'poor', 'poorly', 'unsatisfied', 'unsatisfactory', 'waste',
            'waste of time', 'not worth', 'not recommended', 'avoid', 'avoided',
            'toxic', 'toxicity', 'stress', 'stressed', 'stressful', 'burnout',
            'burned out', 'overwork', 'overworked', 'underpaid', 'underpay',
            'low pay', 'poor pay', 'unfair', 'unfairly', 'exploit', 'exploited',
            'micromanage', 'micromanaged', 'micro-manage', 'micro-managed',
            'commute', 'long commute', 'bad commute', 'traffic', 'parking',
            'layoff', 'laid off', 'fired', 'terminated', 'quit', 'resigned',
            'resign', 'quitting', 'leaving', 'left', 'turnover', 'high turnover',
            'management', 'managers', 'boss', 'bosses', 'supervisor', 'supervisors',
            'leadership', 'leaders', 'incompetent', 'incompetence', 'unprofessional',
            'unorganized', 'disorganized', 'chaotic', 'messy', 'dirty', 'unsafe',
            'harassment', 'harassed', 'discrimination', 'discriminated', 'bias',
            'biased', 'favoritism', 'favorited', 'clique', 'cliques', 'excluded',
            'excluding', 'isolated', 'isolation', 'lonely', 'alone', 'no friends',
            'no help', 'no support', 'ignored', 'ignoring', 'overlooked'
        }

        total_score = 0
        total_words = 0

        for text in texts:
            if not text:
                continue

            words = text.lower().split()
            for word in words:
                # Clean word (remove punctuation)
                clean_word = ''.join(c for c in word if c.isalnum())
                if not clean_word:
                    continue

                total_words += 1
                if clean_word in positive_words:
                    total_score += 1
                elif clean_word in negative_words:
                    total_score -= 1

        if total_words == 0:
            return 0.0

        # Normalize to -1 to 1 range
        # Assuming max possible score is roughly total_words/2 (if all words are sentiment words)
        normalized_score = total_score / max(total_words * 0.5, 1)
        return max(-1.0, min(1.0, normalized_score))  # Clamp to -1 to 1


# Singleton instance
reddit_service = RedditService()

def get_company_reddit_sentiment(company_name: str, limit: int = 25) -> dict:
    """
    Convenience function to get Reddit sentiment for a company

    Args:
        company_name: Name of the company
        limit: Maximum number of items to analyze

    Returns:
        Dictionary with sentiment analysis results
    """
    return reddit_service.get_company_sentiment(company_name, limit)

def is_reddit_available() -> bool:
    """
    Check if Reddit service is available

    Returns:
        True if Reddit API credentials are configured and working
    """
    return reddit_service.is_available()