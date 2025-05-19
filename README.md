# Tanuki-Parser

Tanuki-Parser is a simple, modular text segmentation and part-of-speech (PoS) tagging tool, designed for languages like Japanese where words are not separated by spaces. It uses a dictionary-based Viterbi algorithm with PoS transition probabilities to segment input text into words and assign PoS tags.

> **Note:**  
> This project is in the early stages of development and is intended as an example implementation of a morphological analyzer and natural language parser. It is primarily for educational and experimental purposes. The dictionary supplied contains many errors and missing or mislabeled data.

---

## How It Works

### Dictionary

The dictionary contains a list of word fragments (morphs) with part-of-speech (PoS) tags:

```
は: particle  
が: particle  
から: particle  
今日: noun  
雨: noun  
降: verb  
出かけ: verb  
っている: suffix  
たくない: suffix
```

### Transition Probabilities

Transition probabilities describe how likely one PoS is to follow another. For example, a noun has a 50% chance of being followed by a particle, and a verb is always followed by a suffix:

```
noun:   particle 0.5, verb 0.5  
verb:   suffix 1.0  
suffix: particle 0.75, noun 0.25
```

### Example Segmentation

Given the sentence:

```
今日は雨が降っているから、出かけたくない。
```

The initial segmentation might look like:

```
[今日][は][雨][が][降][っている][から]、[出かけ][たくない]。
```

*Notice verbs are separated from their suffixes.*

#### Recombination

Recombination rules combine fragments into complete words. For example, verbs get attached to their suffixes:

```
verb: suffix  
adj:  suffix
```

After recombination:

```
[今日][は][雨][が][降っている][から]、[出かけたくない]。
```

---

## Algorithms

### Dictionary Trie

Fragments are stored in a Trie data structure for fast lookups. Each branch shares common prefixes. An asterisk `[*]` indicates the end of a word.

```
cat
car
cart
dog
dollar
frog
```

Trie structure:

```
(root)
├── c
│   └── a
│       ├── t [*]
│       └── r [*]
│           └── t [*]
├── d
│   └── o
│       ├── g [*]
│       └── l
│           └── l
│               └── a
│                   └── r [*]
└── f
    └── r
        └── o
            └── g [*]
```

Word paths:

```
cat  → c → a → t [*]  
car  → c → a → r [*]  
cart → c → a → r → t [*]  
dog  → d → o → g [*]
```

The Trie will return all possible matches for a word.  
If the word is `cart`, the Trie will return both `car` and `cart`.

PoS tags are stored in a separate hashtable.  
The matching words can then be used to index the PoS hashtable to get the PoS tag.

---

### Segmentation (Viterbi)

#### Video Explanation
[![Watch on YouTube](https://img.youtube.com/vi/IqXdjdOgXPM/0.jpg)](https://www.youtube.com/watch?v=IqXdjdOgXPM)

The Viterbi algorithm is a dynamic programming approach that efficiently finds the most likely sequence of words and PoS tags in a sentence, given a dictionary and transition probabilities.

#### The Dynamic Programming Table

The core of the algorithm is a dynamic programming table called `viterbiTable`. This table keeps track of the best way to reach each position in the input text, for every possible PoS tag.

- **Structure:**  
  `viterbiTable[position][pos]`
  - `position`: character index in the input text (from 0 to text.length)
  - `pos`: PoS tag of the last token in the path to this position

- **Each entry stores:**
  - `score`: total (log) probability of the best path to this state
  - `backPointer`: reference to the previous state (for reconstructing the path)
  - `token`: information about the token that led to this state (matched word, PoS, type, transition probability)

#### How Each Position is Tested

The algorithm processes the input text one character at a time. At each position, it considers all possible ways to advance:

1. **Whitespace Handling:**  
   If the current character is whitespace, the algorithm consumes all contiguous whitespace as a single token. Whitespace does not affect PoS transitions.

2. **Dictionary Matching:**  
   Using the Trie, the algorithm finds all dictionary words (morphs) that start at the current position. For each match, and for each possible PoS tag for that morph, a new candidate path is created.

3. **Transition Probabilities:**  
   For each candidate, the transition probability from the previous PoS to the current PoS is looked up. If no transition is defined, a small penalty is applied.

4. **Skipping Characters:**  
   If no dictionary match is found, the algorithm allows skipping a character (with a heavy penalty), which helps handle unknown words or typos.

#### Where Data for Each Matching Word is Stored

For each matching word, the resulting state is stored at the **end position** of the word in the DP table.  
For example, if a word starts at index 2 and ends at index 5, the state for that word is stored at `viterbiTable[5][pos]`.  
This means the DP table at each position contains the best scoring path to reach that position, ending with a specific PoS.

#### Maintaining and Merging Multiple Paths

At each `(position, pos)` pair, only the **best scoring path** is kept.

- If multiple paths reach the same `(position, pos)`, only the one with the highest score is stored.
- This merging is crucial: without it, the number of possible paths would grow exponentially with sentence length, making computation infeasible.
- By merging, the algorithm efficiently explores all possible segmentations and PoS sequences, but only keeps the most promising ones.

#### Backtracking at the End

After processing the entire text, the algorithm looks at all possible end states (at `viterbiTable[text.length][pos]` for all PoS) and selects the one with the highest score.

To reconstruct the best sequence of tokens:

1. Start from the best **end** state.
2. Follow the `backPointer` links backward through the table.
3. Collect the tokens along the way.
4. Reverse the sequence to get the correct order.