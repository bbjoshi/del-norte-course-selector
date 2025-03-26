/**
 * Service for handling text search operations
 */
class SearchService {
  /**
   * Create search patterns based on query
   * @param {string} query - Search query
   * @returns {RegExp[]} - Array of regex patterns
   */
  createSearchPatterns(query) {
    const patterns = [];
    
    // Helper function to safely create a regex pattern
    const safeRegex = (pattern) => {
      try {
        // Escape special regex characters
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
      } catch (error) {
        console.warn('Invalid regex pattern:', pattern);
        return null;
      }
    };

    // Add patterns for academic planning
    if (query.match(/plan|schedule|pathway/i)) {
      patterns.push(
        safeRegex('year'),
        safeRegex('grade'),
        safeRegex('prerequisite'),
        safeRegex('requirement'),
        safeRegex('recommended'),
        safeRegex('pathway')
      );
    }

    // Add patterns for specific subjects
    if (query.match(/math|calculus|algebra|geometry/i)) {
      patterns.push(
        safeRegex('math'),
        safeRegex('mathematics'),
        safeRegex('algebra'),
        safeRegex('geometry'),
        safeRegex('calculus'),
        safeRegex('integrated'),
        safeRegex('prerequisite')
      );
    }

    if (query.match(/science|physics|chemistry|biology/i)) {
      patterns.push(
        safeRegex('science'),
        safeRegex('physics'),
        safeRegex('chemistry'),
        safeRegex('biology'),
        safeRegex('laboratory')
      );
    }

    if (query.match(/engineering|technology/i)) {
      patterns.push(
        safeRegex('engineering'),
        safeRegex('technology'),
        safeRegex('design'),
        safeRegex('robotics'),
        safeRegex('computer')
      );
    }

    // Add common academic terms
    patterns.push(
      safeRegex('course'),
      safeRegex('class'),
      safeRegex('credit'),
      safeRegex('prerequisite'),
      safeRegex('requirement'),
      safeRegex('advanced placement'),
      safeRegex('honors')
    );

    // Add individual word patterns for words longer than 3 characters
    const words = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .map(word => safeRegex(word));

    return [...patterns, ...words].filter(Boolean); // Remove any null patterns
  }

  /**
   * Score paragraph relevance
   * @param {string} paragraph - Paragraph to score
   * @param {RegExp[]} patterns - Regex patterns
   * @param {string} query - Original query
   * @returns {number} - Relevance score
   */
  scoreParagraph(paragraph, patterns, query) {
    let score = 0;
    const lowerParagraph = paragraph.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);

    // Score based on regex patterns
    patterns.forEach(pattern => {
      const matches = paragraph.match(pattern);
      if (matches) {
        score += matches.length * 2;  // Give more weight to pattern matches
      }
    });

    // Score based on query word proximity
    queryWords.forEach((word, i) => {
      if (word.length > 3 && lowerParagraph.includes(word)) {
        score += 1;
        // Check if next word also appears nearby (within 50 chars)
        if (i < queryWords.length - 1) {
          const nextWord = queryWords[i + 1];
          const wordIndex = lowerParagraph.indexOf(word);
          const nextWordIndex = lowerParagraph.indexOf(nextWord);
          if (nextWordIndex !== -1 && Math.abs(nextWordIndex - wordIndex) < 50) {
            score += 2;  // Bonus for words appearing close together
          }
        }
      }
    });

    // Bonus points for paragraphs containing course codes
    if (paragraph.match(/\(\d{6}\)/)) {
      score += 3;
    }

    return score;
  }

  /**
   * Search text content
   * @param {string} content - Text content to search
   * @param {string} query - Search query
   * @returns {string[]} - Array of relevant paragraphs
   */
  search(content, query) {
    if (!content || !query) {
      return [];
    }

    // Split content into paragraphs and clean them
    const paragraphs = content
      .split(/[.!?]\s+/)  // Split on sentence boundaries
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Create search patterns
    const patterns = this.createSearchPatterns(query);

    // Search for relevant paragraphs with scoring
    const scoredParagraphs = paragraphs.map(paragraph => ({
      text: paragraph,
      score: this.scoreParagraph(paragraph, patterns, query)
    }));

    // Sort by relevance score and take top results
    const relevantParagraphs = scoredParagraphs
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)  // Take top 15 most relevant paragraphs
      .map(p => p.text);

    // If no results, try a more lenient search
    if (relevantParagraphs.length === 0) {
      const queryWords = query.toLowerCase().split(/\s+/);
      const lenientResults = paragraphs.filter(p => {
        const paragraphWords = p.toLowerCase().split(/\s+/);
        return queryWords.some(word => 
          word.length > 3 && paragraphWords.some(pWord => pWord.includes(word))
        );
      }).slice(0, 8);  // Take top 8 results from lenient search

      return lenientResults;
    }

    return relevantParagraphs;
  }
}

// Export as singleton
module.exports = new SearchService();
