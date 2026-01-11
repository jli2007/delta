import type { Command, FuzzyMatch } from "./types";

/**
 * Calculate fuzzy match score between query and candidate string.
 * Returns score (0 = no match, higher = better) and highlight positions.
 */
function calculateScore(
  query: string,
  candidate: string
): { score: number; highlights: { start: number; end: number }[] } {
  if (!query) {
    return { score: 0, highlights: [] };
  }

  const normalizedQuery = query.toLowerCase();
  const normalizedCandidate = candidate.toLowerCase();

  // Exact match (highest score)
  if (normalizedCandidate === normalizedQuery) {
    return {
      score: 1000,
      highlights: [{ start: 0, end: candidate.length }],
    };
  }

  // Prefix match (very high score)
  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return {
      score: 500 + (query.length / candidate.length) * 100,
      highlights: [{ start: 0, end: query.length }],
    };
  }

  // Contains match
  const containsIndex = normalizedCandidate.indexOf(normalizedQuery);
  if (containsIndex !== -1) {
    return {
      score: 200 + (query.length / candidate.length) * 50,
      highlights: [{ start: containsIndex, end: containsIndex + query.length }],
    };
  }

  // Fuzzy character-by-character match
  let queryIndex = 0;
  let score = 0;
  const highlights: { start: number; end: number }[] = [];
  let currentHighlight: { start: number; end: number } | null = null;

  for (let i = 0; i < normalizedCandidate.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedCandidate[i] === normalizedQuery[queryIndex]) {
      // Consecutive matches score higher
      if (currentHighlight && currentHighlight.end === i) {
        currentHighlight.end = i + 1;
        score += 20; // Bonus for consecutive
      } else {
        if (currentHighlight) {
          highlights.push(currentHighlight);
        }
        currentHighlight = { start: i, end: i + 1 };
        score += 10;
      }

      // Bonus for matching at word boundaries
      if (i === 0 || normalizedCandidate[i - 1] === " " || normalizedCandidate[i - 1] === "/") {
        score += 15;
      }

      queryIndex++;
    }
  }

  if (currentHighlight) {
    highlights.push(currentHighlight);
  }

  // Only return score if all query characters were matched
  if (queryIndex === normalizedQuery.length) {
    return { score, highlights };
  }

  return { score: 0, highlights: [] };
}

/**
 * Find matching commands for a query string.
 * Query should already have the "/" prefix removed.
 */
export function fuzzyMatchCommands(query: string, commands: Command[]): FuzzyMatch[] {
  const normalizedQuery = query.toLowerCase().replace(/^\//, "");

  if (!normalizedQuery) {
    // Return all commands when query is empty (just "/")
    return commands.map((command) => ({
      command,
      score: 0,
      matchedOn: command.trigger,
      highlights: [],
    }));
  }

  const matches: FuzzyMatch[] = [];

  for (const command of commands) {
    let bestScore = 0;
    let bestMatchedOn = command.trigger;
    let bestHighlights: { start: number; end: number }[] = [];

    // Try matching against trigger (without "/" prefix)
    const triggerWithoutSlash = command.trigger.replace(/^\//, "");
    const triggerResult = calculateScore(normalizedQuery, triggerWithoutSlash);
    if (triggerResult.score > bestScore) {
      bestScore = triggerResult.score;
      bestMatchedOn = command.trigger;
      // Offset highlights by 1 to account for "/" prefix in display
      bestHighlights = triggerResult.highlights.map((h) => ({
        start: h.start + 1,
        end: h.end + 1,
      }));
    }

    // Try matching against aliases
    for (const alias of command.aliases) {
      const aliasWithoutSlash = alias.replace(/^\//, "");
      const aliasResult = calculateScore(normalizedQuery, aliasWithoutSlash);
      if (aliasResult.score > bestScore) {
        bestScore = aliasResult.score;
        bestMatchedOn = alias;
        bestHighlights = aliasResult.highlights.map((h) => ({
          start: h.start + 1,
          end: h.end + 1,
        }));
      }
    }

    // Try matching against name
    const nameResult = calculateScore(normalizedQuery, command.name);
    if (nameResult.score > bestScore) {
      bestScore = nameResult.score;
      bestMatchedOn = command.name;
      bestHighlights = nameResult.highlights;
    }

    if (bestScore > 0) {
      matches.push({
        command,
        score: bestScore,
        matchedOn: bestMatchedOn,
        highlights: bestHighlights,
      });
    }
  }

  // Sort by score (descending), then by trigger alphabetically
  return matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.command.trigger.localeCompare(b.command.trigger);
  });
}

/**
 * Parse a command string into trigger and arguments.
 * e.g., "/teleport toronto canada" -> { trigger: "/teleport", args: "toronto canada" }
 */
export function parseCommandInput(input: string): { trigger: string; args: string } {
  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(" ");

  if (spaceIndex === -1) {
    return { trigger: trimmed, args: "" };
  }

  return {
    trigger: trimmed.slice(0, spaceIndex),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Find the best matching command for a trigger string.
 */
export function findCommand(trigger: string, commands: Command[]): Command | null {
  const normalizedTrigger = trigger.toLowerCase();

  for (const command of commands) {
    if (command.trigger.toLowerCase() === normalizedTrigger) {
      return command;
    }
    for (const alias of command.aliases) {
      if (alias.toLowerCase() === normalizedTrigger) {
        return command;
      }
    }
  }

  return null;
}

/**
 * Group commands by category.
 */
export function groupCommandsByCategory(commands: Command[]): Map<string, Command[]> {
  const groups = new Map<string, Command[]>();

  for (const command of commands) {
    const existing = groups.get(command.category) || [];
    existing.push(command);
    groups.set(command.category, existing);
  }

  return groups;
}
