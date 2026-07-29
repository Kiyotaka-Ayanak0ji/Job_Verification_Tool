"""
Glassdoor service for fetching company reviews and ratings
Note: This is a placeholder implementation. In production, consider using:
1. Official Glassdoor API (if available and approved)
2. Licensed third-party data providers
3. More sophisticated scraping with proper rate limiting and error handling
"""
import logging
import os
import requests
from typing import Dict, Any
import json
import time

logger = logging.getLogger(__name__)

class GlassdoorService:
    def __init__(self):
        """Initialize Glassdoor service"""
        self.api_key = os.environ.get('GLASSDOOR_API_KEY')
        self.partner_id = os.environ.get('GLASSDOOR_PARTNER_ID')
        self.enabled = bool(self.api_key and self.partner_id)

        if self.enabled:
            logger.info("Glassdoor service initialized with API credentials")
        else:
            logger.info("Glassdoor service running in limited mode (no API credentials)")

    def is_available(self) -> bool:
        """Check if Glassdoor service is configured (always returns True for basic functionality)"""
        return True  # Always available, but may have limited functionality without API key

    def get_company_rating(self, company_name: str) -> Dict[str, Any]:
        """
        Get company rating and sentiment from Glassdoor

        Args:
            company_name: Name of the company to look up

        Returns:
            Dictionary with rating (0-5 scale), sentiment (-1 to 1), confidence, and review count
        """
        try:
            # If we have API credentials, try to use the official API
            if self.enabled:
                return self._get_rating_via_api(company_name)
            else:
                # Fallback: return neutral response
                # In a production system, you might implement web scraping here
                # with proper rate limiting, user-agent rotation, and respect for robots.txt
                return self._get_default_rating()

        except Exception as e:
            logger.error(f"Error getting Glassdoor rating for {company_name}: {e}")
            return self._get_default_rating()

    def _get_rating_via_api(self, company_name: str) -> Dict[str, Any]:
        """
        Get rating using Glassdoor API (placeholder implementation)
        Note: Actual Glassdoor API implementation would require partnership approval
        """
        try:
            # This is a placeholder for the actual Glassdoor API call
            # The real Glassdoor API endpoint would look something like:
            # http://api.glassdoor.com/api/api.htm
            #
            # Parameters would include:
            # - v: '1'
            # - format: 'json'
            # - t.p: partner_id
            # - t.k: api_key
            # - userip: '0.0.0.0'
            # - useragent: 'YourApp/1.0'
            # - action: 'employers'
            # - q: company_name

            # For now, we'll simulate a delay and return structured data
            # In a real implementation, you would make the actual HTTP request here

            # Simulate API delay
            time.sleep(0.1)

            # Placeholder response - in reality, this would come from the API
            return {
                'rating': 3.5,  # 0-5 scale
                'sentiment': 0.2,  # -1 to 1 scale (derived from rating)
                'confidence': 0.7,  # Based on having API access
                'review_count': 42  # Placeholder
            }

        except Exception as e:
            logger.warning(f"Glassdoor API request failed: {e}")
            return self._get_default_rating()

    def _get_default_rating(self) -> Dict[str, Any]:
        """
        Return a default/rating when Glassdoor data is not available
        This ensures the system continues to function even without Glassdoor access
        """
        return {
            'rating': 0.0,      # Indicates no data available
            'sentiment': 0.0,   # Neutral sentiment
            'confidence': 0.0,  # No confidence without data
            'review_count': 0   # No reviews found
        }

    def extract_review_sentiment(self, review_text: str) -> float:
        """
        Extract sentiment from review text
        Returns score between -1 (very negative) and 1 (very positive)
        """
        if not review_text or not isinstance(review_text, str):
            return 0.0

        # Similar sentiment analysis as Reddit service
        text_lower = review_text.lower()

        positive_indicators = [
            'recommend', 'recommended', 'great', 'excellent', 'good', 'best',
            'positive', 'happy', 'satisfied', 'worth it', 'valuable', 'learning',
            'growth', 'opportunity', 'flexible', 'benefits', 'culture', 'team',
            'management', 'leadership', 'work-life balance', 'compensation',
            'proud', 'proud to work', 'proud to be', 'great place', 'great company',
            'amazing', 'fantastic', 'wonderful', 'terrific', 'outstanding',
            'superb', 'brilliant', 'exceptional', 'outstanding', 'first-rate',
            'top-notch', 'world-class', 'leading', 'innovative', 'dynamic'
        ]

        negative_indicators = [
            'not recommend', 'avoid', 'terrible', 'awful', 'bad', 'worst',
            'disappointed', 'unhappy', 'miserable', 'toxic', 'stressful',
            'overworked', 'underpaid', 'poor management', 'no growth',
            'layoffs', 'fired', 'quit', 'resigned', 'stress', 'burnout',
            'micromanaged', 'favoritism', 'discrimination', 'harassment',
            'hostile', 'hostile work environment', 'unsafe', 'unprofessional',
            'disorganized', 'chaotic', 'messy', 'dirty', 'broken', 'broken system',
            'broken promises', 'broken culture', 'broken leadership', 'broken management'
        ]

        positive_count = sum(1 for word in positive_indicators if word in text_lower)
        negative_count = sum(1 for word in negative_indicators if word in text_lower)

        total = positive_count + negative_count
        if total == 0:
            return 0.0

        return (positive_count - negative_count) / max(total, 1)

# Singleton instance
glassdoor_service = GlassdoorService()

def get_company_glassdoor_rating(company_name: str) -> dict:
    """
    Convenience function to get Glassdoor rating for a company

    Args:
        company_name: Name of the company

    Returns:
        Dictionary with rating analysis results
    """
    return glassdoor_service.get_company_rating(company_name)

def is_glassdoor_available() -> bool:
    """
    Check if Glassdoor service is available

    Returns:
        True (always available, though may have limited functionality without API key)
    """
    return glassdoor_service.is_available()