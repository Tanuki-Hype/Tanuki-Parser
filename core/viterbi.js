/*
Viterbi segmentation algorithm with PoS transitions and whitespace/skip handling.

- At each position in the text, for each possible previous POS, keep only the best scoring path.
- For each position, try to match dictionary words (using the trie), and for each POS tag, compute the transition score.
- Always allow skipping a character (for out-of-dictionary words).
- Whitespace is always consumed as a single contiguous token.
- At the end, select the path with the highest score.
- The best path is reconstructed by following back pointers from the best end state.
- This merging of paths prevents exponential growth of the search space.
*/

/*
viterbiTable is a dynamic programming table for the best segmentation paths.

Structure:
  viterbiTable[position][pos] = {
    score: <number>,         // Total log-probability score for this state
    backPointer: <object>,   // Previous state (for reconstructing the path)
    token: {                 // Token object for this step:
      token: <string>,       // Matched word or character
      pos: <string>,         // POS tag ("" for whitespace/skipped)
      type: <string>,        // "text", "whitespace", or "skipped"
      transProb: <number>    // Non-cumulative transition probability to this token
    }
  }

At each (position, pos), only the best scoring path is kept.
*/

import { buildMorphTrie, findMorphsFromTrie } from './trie.js';

export function viterbiSegment(text, trie, posMap, transitionMap, findMorphsFromTrie, recombinationMap = {}) {
  // viterbiTable[i][pos] = best path to position i ending with pos. Only one entry per pos is needed because only the best scoring path is kept.
  const viterbiTable = [];
  for (let i = 0; i <= text.length; i++) viterbiTable[i] = {};
  // Start with empty path at position 0, no POS
  viterbiTable[0][""] = { score: 0, backPointer: null, token: null };

  // Iterate through each position in the text
  for (let idx = 0; idx < text.length; idx++) {
    // For each possible previous POS at this position
    for (const prevPos in viterbiTable[idx]) {
      const prevState = viterbiTable[idx][prevPos];

      // 1. Consume contiguous whitespace as a single morph
      if (/\s/.test(text[idx])) {
        let end = idx;
        while (end < text.length && /\s/.test(text[end])) end++;
        const wsToken = { morph: text.slice(idx, end), pos: "", type: "whitespace", transProb: 1.0 };
        // Whitespace does not affect POS, so keep prevPos
        updateViterbiTable(viterbiTable, end, prevPos, prevState, wsToken, 0, prevPos, idx);
        continue;
      }

      // 2. Try to match dictionary morphs from trie starting at idx
      const foundMorphs = findMorphsFromTrie(trie, text, idx);
      let matched = false;
      for (let f = 0; f < foundMorphs.length; f++) {
        matched = true;
        const morph = foundMorphs[f].morph;
        const endIdx = foundMorphs[f].end;
        const posTags = posMap[morph] ? posMap[morph].pos : [];
        // For each possible POS tag for this morph
        for (let p = 0; p < posTags.length; p++) {
          const posTag = posTags[p];
          // Use transition probability if available, else small penalty for unlikely transitions
          let transProb = 1.0;
          if (prevPos && transitionMap[prevPos] && transitionMap[prevPos][posTag])
            transProb = transitionMap[prevPos][posTag];
          else if (prevPos) transProb = 1e-8;
          // Add log probability to score (log for numerical stability to prevent underflow)
          const score = prevState.score + Math.log(transProb);
          // Store the non-cumulative transition probability on the morph
          const morphObj = { morph: morph, pos: posTag, type: "text", transProb: transProb };
          // Store best path to (endIdx, posTag)
          updateViterbiTable(viterbiTable, endIdx, posTag, prevState, morphObj, score - prevState.score, posTag, idx);
        }
      }

      // 3. Always allow skipping a character (for out-of-dictionary)
      if (!matched) {
        const skipToken = { morph: text[idx], pos: "", type: "skipped", transProb: 1e-8 };
        updateViterbiTable(viterbiTable, idx + 1, prevPos, prevState, skipToken, Math.log(1e-8), prevPos, idx);
      }
    }
  }

  // Find the best path at the end of the text
  // There may be multiple possible POS tags at the end, so select the one with the highest score
  let best = null;
  for (const posTag in viterbiTable[text.length]) {
    const cand = viterbiTable[text.length][posTag];
    if (!best || cand.score > best.score) {
      best = cand;
    }
  }

  // Reconstruct tokens by following back pointers from the best end state
  const tokens = [];
  let state = best;
  while (state && state.token) {
    tokens.push(state.token);
    state = state.backPointer;
  }
  tokens.reverse();

  // Call recombination function to merge recombination pairs
  const words = recombineTokens(tokens, recombinationMap);

  return words;
}

// Recombination function: merges tokens according to recombinationMap
function recombineTokens(tokens, recombinationMap) {
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    let merged = false;
    // Only try to merge if current token's pos is in recombinationMap
    const cur = tokens[i];
    if (cur && cur.pos && recombinationMap[cur.pos]) {
      for (const nextPos of recombinationMap[cur.pos]) {
        if (
          tokens[i + 1] &&
          tokens[i + 1].pos === nextPos &&
          tokens[i].type === "text" &&
          tokens[i + 1].type === "text"
        ) {
          // Merge current and next token
          result.push({ tokens: [tokens[i], tokens[i + 1]] });
          i += 2;
          merged = true;
          break;
        }
      }
    }
    if (!merged) {
      result.push({ tokens: [tokens[i]] });
      i += 1;
    }
  }
  return result;
}

/*
Update the viterbiTable at (nextIdx, nextPos) with a new candidate path.
Only keep the best scoring path for each (position, POS).
This is the key to merging paths and preventing combinatorial explosion.
*/
function updateViterbiTable(viterbiTable, nextIdx, nextPos, prevState, token, addScore, lastPos, prevIdx) {
  const newScore = prevState.score + addScore;
  if (!viterbiTable[nextIdx][nextPos] || viterbiTable[nextIdx][nextPos].score < newScore) {
    viterbiTable[nextIdx][nextPos] = {
      score: newScore,
      backPointer: prevState,
      token: token
    };
  }
}

export function buildPosMap(morphs) {
  // Build a map from morph to array of POS tags
  const posMap = {};
  for (let i = 0; i < morphs.length; i++) {
    const morph = morphs[i].morph;
    const pos = morphs[i].pos;
    if (!posMap[morph]) posMap[morph] = { pos: [] };
    if (!posMap[morph].pos.includes(pos)) posMap[morph].pos.push(pos);
  }
  return posMap;
}