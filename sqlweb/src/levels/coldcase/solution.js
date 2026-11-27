// SPOILERS: the answer to Level 3 (The Millrace Poisonings) and its ending.
import { normalizeName } from '../observatory/solution.js';

const CULPRIT = 'margo ellery';

const NUDGES = {
  'dov pereira':
    'Dov was working every time a poisoned drink was ordered, but he was only on the drinks station for two of those five orders.',
  'ines calder': 'Ines was not working on 8 September, when Bernard Lusk ordered his tea.',
  'pip langford': 'Pip was on shift for only one of the five poisoned orders.',
  'sunny okonkwo': 'Sunny was on shift for only two of the five poisoned orders, and never on drinks.',
  'theo brandt':
    'Theo works at Copperline Coffee, and Fern Ostrova never ordered there in the 48 hours before she fell ill.',
  'hazel kim': 'Hazel works at Copperline Coffee, and Fern Ostrova never ordered there in the 48 hours before she fell ill.',
  'agnes whitford': 'That is one of the five patients.',
  'bernard lusk': 'That is one of the five patients.',
  'celia moon': 'That is one of the five patients.',
  'desmond achebe': 'That is one of the five patients.',
  'fern ostrova': 'That is one of the five patients.',
  'beatrix coyle': 'Beatrix is a customer with nothing to do with the stall behind the counter. Read her review.',
  'hugo varela': 'Hugo ended up in hospital with an allergic reaction, not thallium. He is a customer, not staff.',
};

const TEXT = {
  empty: 'Write a name first.',
  correct: 'Case closed.',
  notQuite: 'Not quite.',
  unknown: 'Nobody by that name is in staff or customers. Check the spelling with a quick query.',
  wrong: 'The station log does not put that person on the drinks station for all five poisoned orders. Keep digging.',
};

export function judgeAccusation(input, personExists) {
  const name = normalizeName(input);
  if (!name) return { verdict: 'empty', message: TEXT.empty };
  if (name === CULPRIT) return { verdict: 'correct', message: TEXT.correct };
  if (NUDGES[name]) return { verdict: 'wrong', message: `${TEXT.notQuite} ${NUDGES[name]}` };
  if (!personExists) return { verdict: 'unknown', message: TEXT.unknown };
  return { verdict: 'wrong', message: TEXT.wrong };
}

const ENDING = {
  culprit: 'Margo Ellery',
  headline: 'Margo Ellery, owner of Ember & Oak, poisoned her own customers.',
  motive:
    "Ember & Oak was going under. A run of one-star reviews in August had cut its rating in half, and every review blamed the owner. Margo kept an old tin of thallium rat poison from her father's farm. She took her revenge one reviewer at a time, in the smoky chai and tea lattes she made herself.",
  chain: [
    ['The hospital', 'Five thallium cases in September. Toxicology says the poison is tasteless in hot drinks, and symptoms start 12 to 48 hours after it is swallowed.'],
    ['The common stall', 'Only Ember & Oak Tea Bar served all five patients in the 48 hours before they fell ill. Copperline Coffee served four; Fern Ostrova last ordered there two weeks earlier.'],
    ['The shifts', 'Rebuilding stints with LEAD() shows two people at Ember & Oak for all five poisoned orders: Margo Ellery and Dov Pereira.'],
    ['The drinks station', 'All five poisoned orders were hot drinks. Margo was on the drinks station for every one of them. Dov was making drinks for only two.'],
    ['The motive', 'All five patients had posted a one-star review of Ember & Oak, each one complaining about the owner, shortly before they were poisoned.'],
    ['Next on the list', 'Two people had left one-star reviews and had not yet been poisoned: Beatrix Coyle and Hugo Varela. Hugo was in hospital in September, but for a peanut allergy, not thallium. Police warned them both before Margo struck again.'],
  ],
};

export function getEnding() {
  return ENDING;
}
