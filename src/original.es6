// yay es6!
import co from 'co';
import fs from 'q-io/fs';

const START_OF_SENTENCE = Symbol('START_OF_SENTENCE');
const END_OF_SENTENCE = Symbol('END_OF_SENTENCE');

const dict = {};
const words = [];
let total = 0;

co(function *() {
  const origCorpus = yield fs.read('corpus.txt');
  const tokens = tokenize(origCorpus);
  tokens.forEach((token, i, ar) => {
    if (!dict[token]) dict[token] = {
      count: 0,
      next: [],
    };
    const entry = dict[token];
    entry.count++;
    if (token !== END_OF_SENTENCE && (i+1) < ar.length) {
      entry.next.push(ar[i+1]);
    }
  });
  buildWordsLookup();
  console.log(dict);
  for (let i=0; i<10; i++) {
    const rawSentence = getSentence().join(' ') + '.';
    const sentence = rawSentence.charAt(0).toUpperCase() + rawSentence.slice(1);
    console.log(' >> ' + sentence);
  }
}).catch(err => {
  console.log(err.stack);
});

function getSentence() {
  let token = randomWeightedWord();
  let wordData = dict[token];
  const sentence = [];
  while(token !== END_OF_SENTENCE) {
    if (wordData.next.length === 0) {
      token = END_OF_SENTENCE;
    } else {
      sentence.push(token);
      wordData = dict[token];
      token = randFromList(wordData.next);
    }
  }
  return sentence;
}

function randFromList(list) {
  return list[Math.floor(Math.random()*list.length)];
}

// Takes in a corpus and returns a list
// of the tokens within the corpus.
function tokenize(corpus) {
  const lines = corpus.split('\n');
  const words = lines.map(line => line.split(' ')
      .map(word => word.toLowerCase()
                       .replace(/^[^a-z0-9]+|[^a-z0-9.!?]+$/g,''))
      .map(word => {
        if (/[.!]$/.test(word)) {
          return [
            word.replace(/[.!]$/, ''),
            END_OF_SENTENCE
          ];
        }
        return word;
      }));
  return flatten(flatten(words)).filter(x => x);
}

function flatten(arr) {
  return arr.map(x => Array.isArray(x) ? x : [x])
            .reduce((a, b) => a.concat(b));
}

function buildWordsLookup() {
  while (words.length > 0) words.pop();
  total = 0;
  Object.keys(dict).forEach(word => {
    words.push({
      word: word,
      count: (total += dict[word].count)
    });
  });
}

function randomWeightedWord() {
  const rand = Math.random() * total;
  return words.reduce((countOrWord, next) => {
    if (Number.isInteger(countOrWord)) {
      let count = countOrWord;
      if (count >= rand) {
        return next.word;
      }
      return count + next.count;
    } else {
      let word = countOrWord;
      return word;
    }
  }, 0);

}
