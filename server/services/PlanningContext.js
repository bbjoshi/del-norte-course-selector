const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const PDFService = require('./PDFService');

const REFERENCES_DIR = path.join(__dirname, '..', '..', 'references');

// UC a-g subject and GPA requirements. None of the school documents spell these
// out (the catalog only tags each course with its a-g area), so they live here.
// Re-check against the source pages whenever UC updates its requirements.
const UC_REQUIREMENTS = `
=== UC A-G ADMISSION REQUIREMENTS (University of California) ===
Sources:
- https://admission.universityofcalifornia.edu/admission-requirements/first-year-requirements/subject-requirement-a-g.html
- https://admission.universityofcalifornia.edu/admission-requirements/first-year-requirements/gpa-requirement.html
(retrieved 2026-10-27)

Overall: 15 yearlong high school courses with a letter grade of C or better, at least 11 of them completed before the last year of high school.

A - History: Two years, including one year of world history, cultures or historical geography, and one year of U.S. history (or one-half year of U.S. history and one-half year of civics or American government).
B - English: Four years of college-preparatory English that include frequent writing and reading of classic and modern literature.
C - Mathematics: Three years of college-preparatory mathematics covering elementary and advanced algebra and two- and three-dimensional geometry. A fourth year of math is strongly recommended.
D - Science: Two years of college-preparatory science providing fundamental knowledge in two of these three subjects: biology, chemistry, or physics. A third year of science is recommended.
E - Language Other Than English: Two years (or the equivalent of the 2nd level of high school instruction) of the same language. A third year is recommended.
F - Visual and Performing Arts: One yearlong course in dance, music, theater, visual arts or interdisciplinary arts.
G - College-Preparatory Elective: One year (two semesters) of an additional course from the a-g subject areas or the G elective area.

GPA: Minimum 3.0 for California residents and 3.4 for nonresidents, calculated on all a-g courses taken from the summer after 9th grade through the summer after 11th grade. A=4, B=3, C=2, D=1 (plus/minus not counted). One extra point per semester of honors-level coursework (AP, UC-transferable college courses, UC-certified honors), up to 8 points across 10th and 11th grade.

Note: These are minimums. Selective campuses and competitive majors such as computer science or engineering typically expect students to exceed them (for example, the recommended 4th year of math, 3rd year of science, and 3rd year of language).
`;

let graduationRequirementsText = null;

async function loadGraduationRequirements() {
  if (graduationRequirementsText !== null) return graduationRequirementsText;
  graduationRequirementsText = '';
  try {
    const file = fs.existsSync(REFERENCES_DIR)
      && fs.readdirSync(REFERENCES_DIR).find(f => /graduation/i.test(f) && f.toLowerCase().endsWith('.pdf'));
    if (file) {
      const parser = new PDFParse({ data: fs.readFileSync(path.join(REFERENCES_DIR, file)), verbosity: 0 });
      const result = await parser.getText();
      graduationRequirementsText = (result.text || '').trim();
      console.log(`Loaded graduation requirements for planning context (${graduationRequirementsText.length} chars)`);
    }
  } catch (error) {
    console.error('Error loading graduation requirements:', error.message);
  }
  return graduationRequirementsText;
}

/**
 * Whether a query asks for a multi-year plan or pathway
 */
function isPlanningQuery(query) {
  return /\b(plan|pathway|schedule|4[- ]?year|four[- ]?year)/i.test(query || '');
}

/**
 * Full course catalog plus graduation and UC a-g requirements, for planning
 * queries where retrieved excerpts alone leave out whole subject areas.
 * Kept byte-stable between requests so it can be prompt-cached.
 */
async function getPlanningContext() {
  // The live catalog (startup reference PDF, or an admin upload)
  const catalogText = (PDFService.getPDFContent() || '').trim();
  const catalogSection = catalogText
    ? `\n=== COURSE CATALOG (full document) ===\n${catalogText}\n`
    : '';
  const gradText = await loadGraduationRequirements();
  const gradSection = gradText
    ? `\n=== DEL NORTE GRADUATION REQUIREMENTS (full document) ===\n${gradText}\n`
    : '';
  return catalogSection + gradSection + UC_REQUIREMENTS;
}

module.exports = { isPlanningQuery, getPlanningContext };
