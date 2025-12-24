/**
 * Rock Paper Scissors game logic
 */

export const CHOICES = {
  ROCK: "rock",
  PAPER: "paper",
  SCISSORS: "scissors",
};

export const CHOICE_EMOJIS = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
};

export const CHOICE_NAMES = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
};

/**
 * Get bot's random choice
 * @returns {string} Random choice (rock, paper, or scissors)
 */
export function getBotChoice() {
  const choices = Object.values(CHOICES);
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Determine the winner of a Rock Paper Scissors game
 * @param {string} player1Choice - Player 1's choice
 * @param {string} player2Choice - Player 2's choice (or bot)
 * @param {boolean} isMultiplayer - Whether this is a multiplayer game
 * @returns {string} 'player1', 'player2', 'player', 'bot', or 'tie'
 */
export function determineWinner(
  player1Choice,
  player2Choice,
  isMultiplayer = false,
) {
  if (player1Choice === player2Choice) {
    return isMultiplayer ? "tie" : "tie";
  }

  const winConditions = {
    [CHOICES.ROCK]: CHOICES.SCISSORS,
    [CHOICES.PAPER]: CHOICES.ROCK,
    [CHOICES.SCISSORS]: CHOICES.PAPER,
  };

  if (winConditions[player1Choice] === player2Choice) {
    return isMultiplayer ? "player1" : "player";
  }

  return isMultiplayer ? "player2" : "bot";
}

/**
 * Get result message based on winner
 * @param {string} winner - 'player', 'bot', 'player1', 'player2', or 'tie'
 * @param {Object} options - Optional parameters
 * @param {string} options.player1Name - Name of player 1
 * @param {string} options.player2Name - Name of player 2
 * @returns {string} Result message
 */
export function getResultMessage(winner, options = {}) {
  switch (winner) {
    case "player":
      return "You win! 🎉";
    case "bot":
      return "Bot wins! 🤖";
    case "player1":
      return `${options.player1Name || "Player 1"} wins! 🎉`;
    case "player2":
      return `${options.player2Name || "Player 2"} wins! 🎉`;
    case "tie":
      return "It's a tie! 🤝";
    default:
      return "Unknown result";
  }
}

/**
 * Generate unique challenge ID
 * @returns {string} Challenge ID
 */
export function generateChallengeId() {
  return `rps-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
