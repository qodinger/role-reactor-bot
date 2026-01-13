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

// Funny user titles based on voting patterns
export const USER_TITLES = {
  CONTRARIAN: "The Contrarian 🔄", // Always votes for losing option
  TRENDSETTER: "The Trendsetter 🌟", // Often votes for winning option
  FIRST_VOTER: "Quick Draw 🏹", // First to vote
  TIE_BREAKER: "The Decider ⚖️", // Breaks ties
  FLIP_FLOPPER: "The Flip-Flopper 🔄", // Changes vote multiple times
  BANDWAGON: "Bandwagon Rider 🚂", // Joins the winning side
  UNDERDOG: "Underdog Champion 🐕", // Supports the losing side
};

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
      TECHNOLOGY: [],
      RELATIONSHIPS: [],
      LIFE_CHOICES: [],
      PHILOSOPHICAL: [],
      CHALLENGING: [],
      POP_CULTURE: [],
      FOOD: [],
      ADVENTURE: [],
      MODERN_LIFE: [],
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

/**
 * Determine user title based on voting behavior
 * @param {string} userId - User ID
 * @param {Object} voteData - Current vote data
 * @param {number} choice - User's choice (1 or 2)
 * @param {boolean} isFirstVote - Whether this is the first vote on this question
 * @returns {string|null} User title or null
 */
export function getUserTitle(userId, voteData, choice, isFirstVote) {
  if (isFirstVote) {
    return USER_TITLES.FIRST_VOTER;
  }

  const voteCounts = getVoteCounts(voteData);
  const { option1, option2, total } = voteCounts;

  // Check if this vote breaks a tie
  if (option1 === option2 && total > 2) {
    return USER_TITLES.TIE_BREAKER;
  }

  // Check if user is joining the winning side (bandwagon)
  if (total >= 3) {
    const winningOption = option1 > option2 ? 1 : option2 > option1 ? 2 : null;
    if (
      winningOption &&
      choice === winningOption &&
      Math.abs(option1 - option2) >= 2
    ) {
      return USER_TITLES.BANDWAGON;
    }

    // Check if user is supporting the underdog
    const losingOption = option1 < option2 ? 1 : option2 < option1 ? 2 : null;
    if (
      losingOption &&
      choice === losingOption &&
      Math.abs(option1 - option2) >= 2
    ) {
      return USER_TITLES.UNDERDOG;
    }
  }

  return null;
}

/**
 * Get vote counts from vote data
 * @param {Object} voteData - Vote data object
 * @returns {Object} Vote counts
 */
function getVoteCounts(voteData) {
  if (!voteData || !voteData.votes) {
    return { option1: 0, option2: 0, total: 0 };
  }

  let option1 = 0;
  let option2 = 0;

  for (const choice of voteData.votes.values()) {
    if (choice === 1) option1++;
    if (choice === 2) option2++;
  }

  return {
    option1,
    option2,
    total: option1 + option2,
  };
}
