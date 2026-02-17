/**
 * TranscriptAnalysisService - Agentic workflow for transcript analysis
 * 
 * Step 1: Parse transcript text into structured JSON using AI
 * Step 2: Match courses against the course catalog programmatically
 * Step 3: Perform graduation requirement gap analysis
 * Step 4: Generate structured analysis for the recommendation AI
 */

const axios = require('axios');

class TranscriptAnalysisService {
  constructor() {
    this.cachedAnalysis = new Map(); // Cache by text hash
  }

  /**
   * Main entry point: Run the full agentic analysis pipeline
   */
  async analyzeDocument(documentText, documentFilename) {
    const textHash = this._hashText(documentText);
    
    // Check cache
    if (this.cachedAnalysis.has(textHash)) {
      console.log('Returning cached transcript analysis');
      return this.cachedAnalysis.get(textHash);
    }

    console.log('=== Starting Agentic Transcript Analysis Pipeline ===');
    const startTime = Date.now();

    // STEP 1: Parse transcript into structured data
    console.log('Step 1: Parsing transcript into structured data...');
    const parsedCourses = await this._parseTranscript(documentText);
    console.log(`Step 1 complete: Found ${parsedCourses.courses.length} courses`);

    // STEP 2: Analyze the parsed data programmatically
    console.log('Step 2: Analyzing course data...');
    const courseAnalysis = this._analyzeCourses(parsedCourses);
    console.log(`Step 2 complete: ${courseAnalysis.completedCourseNames.length} completed courses identified`);

    // STEP 3: Graduation requirement gap analysis
    console.log('Step 3: Running graduation requirement gap analysis...');
    const gapAnalysis = this._analyzeGraduationGaps(parsedCourses, courseAnalysis);
    console.log(`Step 3 complete: ${gapAnalysis.missingRequirements.length} gaps found`);

    // STEP 4: Build the structured analysis summary
    console.log('Step 4: Building structured analysis summary...');
    const analysis = {
      student: parsedCourses.student,
      courses: parsedCourses.courses,
      courseAnalysis,
      gapAnalysis,
      summary: this._buildSummary(parsedCourses, courseAnalysis, gapAnalysis),
      documentFilename,
      analyzedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };

    // Cache the result
    this.cachedAnalysis.set(textHash, analysis);

    console.log(`=== Agentic Analysis Complete (${analysis.processingTimeMs}ms) ===`);
    return analysis;
  }

  /**
   * STEP 1: Use AI to parse transcript text into structured JSON
   */
  async _parseTranscript(documentText) {
    const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('No API key available for transcript parsing');
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: `Parse this academic document and extract ALL course and student information into structured JSON format.

DOCUMENT TEXT:
${documentText.substring(0, 6000)}
${documentText.length > 6000 ? '\n[... truncated ...]' : ''}

Respond with ONLY valid JSON (no markdown, no commentary) in this exact format:
{
  "student": {
    "name": "Student Name or null if not found",
    "gradeLevel": 9/10/11/12 or null,
    "school": "School name or null",
    "gpa": {
      "cumulative": number or null,
      "weighted": number or null
    },
    "totalCreditsEarned": number or null
  },
  "courses": [
    {
      "name": "Course Name",
      "grade": "A/B/C/D/F or letter grade received",
      "credits": number or null,
      "year": "2024-2025 or similar",
      "semester": "Fall/Spring/S1/S2/Tri1/etc or null",
      "status": "completed/in_progress/planned",
      "subject": "math/science/english/social_studies/language/arts/pe/elective/cte",
      "isHonors": true/false,
      "isAP": true/false
    }
  ]
}

RULES:
- Extract EVERY course listed in the document
- If grade is missing, use null
- Determine subject category based on course name
- Mark AP courses (isAP: true) and Honors courses (isHonors: true)
- If currently taking a course (no grade yet), mark status as "in_progress"
- Best effort for all fields - use null when truly unknown`
          }
        ],
        max_tokens: 3000,
        temperature: 0.1, // Low temperature for structured extraction
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://del-norte-course-selector.vercel.app',
          'X-Title': 'Del Norte Course Selector - Transcript Parser',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    try {
      // Clean up potential markdown wrapping
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      jsonStr = jsonStr.trim();
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate structure
      if (!parsed.courses || !Array.isArray(parsed.courses)) {
        throw new Error('Invalid response structure: missing courses array');
      }
      
      return {
        student: parsed.student || {},
        courses: parsed.courses.map(c => ({
          name: c.name || 'Unknown Course',
          grade: c.grade || null,
          credits: c.credits || null,
          year: c.year || null,
          semester: c.semester || null,
          status: c.status || 'completed',
          subject: c.subject || 'elective',
          isHonors: !!c.isHonors,
          isAP: !!c.isAP,
        })),
      };
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError.message);
      console.error('Raw response:', content.substring(0, 500));
      // Return minimal structure
      return {
        student: {},
        courses: [],
        parseError: parseError.message,
      };
    }
  }

  /**
   * STEP 2: Programmatic course analysis
   */
  _analyzeCourses(parsedData) {
    const courses = parsedData.courses;
    
    // Completed courses
    const completed = courses.filter(c => c.status === 'completed');
    const inProgress = courses.filter(c => c.status === 'in_progress');
    
    // Course names for easy lookup (normalized)
    const completedCourseNames = completed.map(c => c.name.toLowerCase().trim());
    const inProgressCourseNames = inProgress.map(c => c.name.toLowerCase().trim());
    const allTakenNames = [...completedCourseNames, ...inProgressCourseNames];
    
    // Subject breakdown
    const bySubject = {};
    for (const course of courses) {
      const subj = course.subject || 'elective';
      if (!bySubject[subj]) bySubject[subj] = [];
      bySubject[subj].push(course);
    }
    
    // Grade analysis
    const gradePoints = { 'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0.0 };
    const gradedCourses = completed.filter(c => c.grade && gradePoints[c.grade.toUpperCase()] !== undefined);
    const strongSubjects = []; // Subjects with average >= 3.5
    const weakSubjects = [];   // Subjects with average < 2.5
    
    for (const [subj, subjCourses] of Object.entries(bySubject)) {
      const graded = subjCourses.filter(c => c.grade && gradePoints[c.grade.toUpperCase()] !== undefined);
      if (graded.length > 0) {
        const avg = graded.reduce((sum, c) => sum + (gradePoints[c.grade.toUpperCase()] || 0), 0) / graded.length;
        if (avg >= 3.5) strongSubjects.push({ subject: subj, avgGPA: Math.round(avg * 100) / 100 });
        if (avg < 2.5) weakSubjects.push({ subject: subj, avgGPA: Math.round(avg * 100) / 100 });
      }
    }
    
    // AP/Honors tracking
    const apCourses = courses.filter(c => c.isAP);
    const honorsCourses = courses.filter(c => c.isHonors);
    
    // Total credits
    const totalCredits = completed.reduce((sum, c) => sum + (c.credits || 0), 0);
    
    return {
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      completedCourseNames,
      inProgressCourseNames,
      allTakenNames,
      bySubject,
      strongSubjects,
      weakSubjects,
      apCount: apCourses.length,
      honorsCount: honorsCourses.length,
      totalCredits,
    };
  }

  /**
   * STEP 3: Graduation requirement gap analysis
   * Based on typical California high school graduation requirements
   */
  _analyzeGraduationGaps(parsedData, courseAnalysis) {
    const bySubject = courseAnalysis.bySubject;
    const student = parsedData.student || {};
    const gradeLevel = student.gradeLevel || null;
    
    // Standard graduation requirements (Del Norte / California)
    const requirements = [
      { category: 'English', subject: 'english', yearsRequired: 4, creditsRequired: 40 },
      { category: 'Math', subject: 'math', yearsRequired: 3, creditsRequired: 30 },
      { category: 'Science', subject: 'science', yearsRequired: 2, creditsRequired: 20 },
      { category: 'Social Studies', subject: 'social_studies', yearsRequired: 3, creditsRequired: 30 },
      { category: 'World Language', subject: 'language', yearsRequired: 1, creditsRequired: 10 },
      { category: 'PE', subject: 'pe', yearsRequired: 2, creditsRequired: 20 },
      { category: 'Visual/Performing Arts', subject: 'arts', yearsRequired: 1, creditsRequired: 10 },
      { category: 'CTE/Elective', subject: 'cte', yearsRequired: 0, creditsRequired: 0 },
    ];

    // UC/CSU A-G Requirements
    const agRequirements = [
      { category: 'A - History/Social Science', subject: 'social_studies', yearsRequired: 2 },
      { category: 'B - English', subject: 'english', yearsRequired: 4 },
      { category: 'C - Mathematics', subject: 'math', yearsRequired: 3 },
      { category: 'D - Laboratory Science', subject: 'science', yearsRequired: 2 },
      { category: 'E - Language Other Than English', subject: 'language', yearsRequired: 2 },
      { category: 'F - Visual/Performing Arts', subject: 'arts', yearsRequired: 1 },
      { category: 'G - College Prep Elective', subject: 'elective', yearsRequired: 1 },
    ];

    const missingRequirements = [];
    const completedRequirements = [];
    const agStatus = [];

    for (const req of requirements) {
      const subjectCourses = bySubject[req.subject] || [];
      const completedInSubject = subjectCourses.filter(c => c.status === 'completed').length;
      const totalInSubject = subjectCourses.length;
      
      if (completedInSubject >= req.yearsRequired) {
        completedRequirements.push({
          category: req.category,
          completed: completedInSubject,
          required: req.yearsRequired,
          status: 'met',
        });
      } else if (totalInSubject >= req.yearsRequired) {
        completedRequirements.push({
          category: req.category,
          completed: completedInSubject,
          required: req.yearsRequired,
          status: 'in_progress',
        });
      } else {
        missingRequirements.push({
          category: req.category,
          completed: totalInSubject,
          required: req.yearsRequired,
          remaining: req.yearsRequired - totalInSubject,
          status: 'not_met',
        });
      }
    }

    // A-G analysis
    for (const req of agRequirements) {
      const subjectCourses = bySubject[req.subject] || [];
      const total = subjectCourses.length;
      agStatus.push({
        category: req.category,
        completed: total,
        required: req.yearsRequired,
        met: total >= req.yearsRequired,
      });
    }

    return {
      missingRequirements,
      completedRequirements,
      agStatus,
      estimatedGradeLevel: gradeLevel,
      totalCreditsNeeded: 220, // Typical requirement
      totalCreditsEarned: courseAnalysis.totalCredits,
      onTrack: missingRequirements.length === 0,
    };
  }

  /**
   * STEP 4: Build a structured text summary for the recommendation AI
   */
  _buildSummary(parsedData, courseAnalysis, gapAnalysis) {
    const student = parsedData.student || {};
    const lines = [];

    lines.push('=== STRUCTURED TRANSCRIPT ANALYSIS ===');
    lines.push('');

    // Student info
    if (student.name) lines.push(`Student: ${student.name}`);
    if (student.gradeLevel) lines.push(`Grade Level: ${student.gradeLevel}`);
    if (student.gpa?.cumulative) lines.push(`Cumulative GPA: ${student.gpa.cumulative}`);
    if (student.gpa?.weighted) lines.push(`Weighted GPA: ${student.gpa.weighted}`);
    if (courseAnalysis.totalCredits) lines.push(`Credits Earned: ${courseAnalysis.totalCredits}`);
    lines.push(`AP Courses Taken: ${courseAnalysis.apCount}`);
    lines.push(`Honors Courses Taken: ${courseAnalysis.honorsCount}`);
    lines.push('');

    // Completed courses list (this is what the AI must NOT recommend again)
    lines.push('=== COURSES ALREADY COMPLETED (DO NOT RECOMMEND THESE) ===');
    const completed = parsedData.courses.filter(c => c.status === 'completed');
    for (const course of completed) {
      const grade = course.grade ? ` — Grade: ${course.grade}` : '';
      const ap = course.isAP ? ' [AP]' : '';
      const honors = course.isHonors ? ' [Honors]' : '';
      lines.push(`  ✓ ${course.name}${ap}${honors}${grade}`);
    }
    lines.push('');

    // In-progress courses
    const inProgress = parsedData.courses.filter(c => c.status === 'in_progress');
    if (inProgress.length > 0) {
      lines.push('=== COURSES CURRENTLY IN PROGRESS (DO NOT RECOMMEND THESE) ===');
      for (const course of inProgress) {
        const ap = course.isAP ? ' [AP]' : '';
        const honors = course.isHonors ? ' [Honors]' : '';
        lines.push(`  → ${course.name}${ap}${honors}`);
      }
      lines.push('');
    }

    // Strengths
    if (courseAnalysis.strongSubjects.length > 0) {
      lines.push('=== STRONG SUBJECTS (suggest advanced/AP courses) ===');
      for (const s of courseAnalysis.strongSubjects) {
        lines.push(`  ★ ${s.subject} (avg GPA: ${s.avgGPA})`);
      }
      lines.push('');
    }

    // Weak areas
    if (courseAnalysis.weakSubjects.length > 0) {
      lines.push('=== AREAS NEEDING SUPPORT (suggest appropriate-level courses) ===');
      for (const s of courseAnalysis.weakSubjects) {
        lines.push(`  ⚠ ${s.subject} (avg GPA: ${s.avgGPA})`);
      }
      lines.push('');
    }

    // Graduation gaps
    if (gapAnalysis.missingRequirements.length > 0) {
      lines.push('=== GRADUATION REQUIREMENT GAPS (prioritize these) ===');
      for (const gap of gapAnalysis.missingRequirements) {
        lines.push(`  ✗ ${gap.category}: needs ${gap.remaining} more year(s) (${gap.completed}/${gap.required} completed)`);
      }
      lines.push('');
    }

    // A-G Status
    const unmetAG = gapAnalysis.agStatus.filter(a => !a.met);
    if (unmetAG.length > 0) {
      lines.push('=== UC/CSU A-G REQUIREMENTS NOT YET MET ===');
      for (const ag of unmetAG) {
        lines.push(`  ✗ ${ag.category}: ${ag.completed}/${ag.required} years completed`);
      }
      lines.push('');
    }

    lines.push('=== RECOMMENDATION RULES ===');
    lines.push('1. NEVER recommend any course listed above as completed or in-progress');
    lines.push('2. PRIORITIZE courses that fill graduation requirement gaps');
    lines.push('3. Suggest honors/AP in strong subjects, standard level in weak areas');
    lines.push('4. Only recommend courses from the course catalog');
    lines.push('5. Follow prerequisite chains (recommend the NEXT course in sequence)');

    return lines.join('\n');
  }

  /**
   * Simple hash for caching
   */
  _hashText(text) {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      const chr = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cachedAnalysis.clear();
  }
}

module.exports = new TranscriptAnalysisService();
