/**
 * Would You Rather questions database organized by category
 * Questions are loaded from wyr_questions.json in the same directory for easier management
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to questions JSON file (in the same directory as this file)
const QUESTIONS_FILE = path.join(__dirname, "wyr_questions.json");

// Cache for loaded questions
let WYR_QUESTIONS_CACHE = null;

/**
 * Load questions from JSON file
 * @returns {Object} Questions organized by category
 */
function loadQuestions() {
  if (WYR_QUESTIONS_CACHE) {
    return WYR_QUESTIONS_CACHE;
  }

  try {
    const fileContent = fs.readFileSync(QUESTIONS_FILE, "utf8");
    WYR_QUESTIONS_CACHE = JSON.parse(fileContent);
    logger.debug(
      `Loaded ${Object.values(WYR_QUESTIONS_CACHE).flat().length} WYR questions from ${QUESTIONS_FILE}`,
    );
    return WYR_QUESTIONS_CACHE;
  } catch (error) {
    logger.error(`Failed to load WYR questions from ${QUESTIONS_FILE}:`, error);
    // Return empty structure as fallback
    return {
      FUNNY: [],
      SUPERHERO: [],
      LIFE_CHOICES: [],
      PHILOSOPHICAL: [],
      CHALLENGING: [],
      POP_CULTURE: [],
    };
  }
}

/**
 * Get questions database
 * @returns {Object} Questions organized by category
 */
export function getWYRQuestions() {
  return loadQuestions();
}

/**
 * Get all questions as a flat array
 * @returns {Array<string>} All questions
 */
export function getAllQuestions() {
  const questions = getWYRQuestions();
  return Object.values(questions).flat();
}

/**
 * Get questions by category
 * @param {string} category - Category name
 * @returns {Array<string>} Questions in category
 */
export function getQuestionsByCategory(category) {
  const questions = getWYRQuestions();
  return questions[category] || [];
}

/**
 * Get all available categories
 * @returns {Array<string>} Category names
 */
export function getCategories() {
  const questions = getWYRQuestions();
  return Object.keys(questions);
}

/**
 * Get a random Would You Rather question
 * @param {string|null} category - Optional category to filter by
 * @returns {string|null} Random WYR question, or null if no questions available
 */
export function getRandomWYRQuestion(category = null) {
  const questions = category
    ? getQuestionsByCategory(category)
    : getAllQuestions();

  if (questions.length === 0) {
    // Try fallback to all questions if category-specific search failed
    const allQuestions = getAllQuestions();
    if (allQuestions.length === 0) {
      logger.error(
        "No WYR questions available - questions file may have failed to load",
      );
      return null; // Return null instead of undefined to indicate failure
    }
    return allQuestions[Math.floor(Math.random() * allQuestions.length)];
  }

  return questions[Math.floor(Math.random() * questions.length)];
}

/**
 * Parse a question to extract the two options
 * @param {string} question - The WYR question
 * @returns {Object} Object with option1 and option2
 */
export function parseQuestionOptions(question) {
  // Handle null/undefined questions
  if (!question || typeof question !== "string") {
    logger.warn("parseQuestionOptions called with invalid question:", question);
    return {
      option1: "Option 1",
      option2: "Option 2",
    };
  }

  // Remove "Would you rather" prefix and question mark
  const cleanQuestion = question
    .replace(/^Would you rather\s+/i, "")
    .replace(/\?$/, "")
    .trim();

  // Split by " or " to get the two options
  const parts = cleanQuestion.split(/\s+or\s+/i);

  if (parts.length === 2) {
    return {
      option1: parts[0].trim(),
      option2: parts[1].trim(),
    };
  }

  // Fallback if parsing fails
  return {
    option1: "Option 1",
    option2: "Option 2",
  };
}
