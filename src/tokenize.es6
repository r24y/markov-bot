import uuid from 'node-uuid';
import co from 'co';
import fs from 'q-io/fs';
import path from 'path';

// I'd really love to use `Symbol` for these, but
// unfortunately this is all going into CouchDB, and you
// can't really uniquely serialize a Symbol into JSON.
const CODE_QUOTE_START = 'SYMBOL_CODE_QUOTE_START',
      CODE_QUOTE_END = 'SYMBOL_CODE_QUOTE_END',
      SENTENCE_START = 'SYMBOL_SENTENCE_START',
      SENTENCE_END = 'SYMBOL_SENTENCE_END',
      CODE_BLOCK_START = 'SYMBOL_CODE_BLOCK_START',
      CODE_BLOCK_END = 'SYMBOL_CODE_BLOCK_END';

function tokenize(message) {
  // Place to store our tokens, with a starter token.
  let tokens = [{
    token: SENTENCE_START
  }];

  // Keep track of whether we're in a code block.
  let isCodeBlock = false;
  // Keep track of whether we're in a single-tick code string.
  let isCodeString = false;

  message = message.trim();

  while (message.length) {
    const [consumed, word, token]
      =  findWord(message)
      || findCodeQuotes(message, isCodeBlock, isCodeString)
      || findNonWord(message)
      || takeWhatYouCanGet(message);

    // If we somehow failed to consume characters, escape so we don't
    // loop infinitely.
    if (!consumed) break;

    // Update whether we're in a code block or string.
    switch (token) {
      case CODE_BLOCK_START:
        isCodeBlock = true;
        isCodeString = false;
        break;
      case CODE_BLOCK_END:
      case CODE_QUOTE_END:
        isCodeBlock = isCodeString = false;
        break;
      case CODE_QUOTE_START:
        isCodeString = true;
        isCodeBlock = false;
        break;
    }

    tokens.push({
      word: word.trim(),
      token: token.trim()
    });

    if ('.?!'.split('').includes(token.trim())) {
      tokens.push({
        token: SENTENCE_END
      });
      tokens.push({
        token: SENTENCE_START
      });
    }

    // Update the message.
    message = message.slice(consumed).trim();
  }

  for (let i = 0; i < tokens.length; i++) {
    if (i > 0) {
      tokens[i].previousToken = tokens[i-1].token;
    }
    if ((i+1) < tokens.length) {
      tokens[i].nextToken = tokens[i+1].token;
    }
  }

  if (tokens[tokens.length - 1].token === SENTENCE_START) {
    tokens.pop();
  }

  if (tokens[tokens.length - 1].token !== SENTENCE_END) {
    tokens.push({token: SENTENCE_END});
  }

  return tokens;
}

const WORD_RE = /^[\w-']+/;

function findWord(message) {
  return check(WORD_RE, message);
}

const NON_WORD_RE = /^[^\w-']+/;

function findNonWord(message) {
  return check(NON_WORD_RE, message);
}

function findCodeQuotes(message, isCodeBlock, isCodeString) {
  const triple = message.indexOf('```');
  const single = message.indexOf('`');
  const isCode = isCodeBlock || isCodeString;
  if (triple !== 0 && single !== 0) {
    return null;
  }
  if (!isCode && triple) {
    return [3, CODE_BLOCK_START, CODE_BLOCK_START];
  } else if (isCodeBlock && triple) {
    return [3, CODE_BLOCK_END, CODE_BLOCK_END];
  } else if (!isCode && single) {
    return [1, CODE_QUOTE_START, CODE_QUOTE_START];
  } else if (isCodeString && !isCodeBlock && single) {
    return [1, CODE_QUOTE_END, CODE_QUOTE_END];
  }
}

const STRAGGLERS = /^\S+/;

function takeWhatYouCanGet(message) {
  return check(STRAGGLERS, message);
}

function check(re, message) {
  const match = re.exec(message);
  if (!match) {
    return null;
  }
  return [match[0].length, match[0], match[0].toLowerCase()];
}

tokenize.SENTENCE_START = SENTENCE_START;
tokenize.SENTENCE_END = SENTENCE_END;

export default tokenize;

if (require.main === module) {
  co(function *() {
    const corpus = yield fs.read(path.join(__dirname,'..', 'corpus.txt'));
    console.log(tokenize(corpus).map(t => t.word).join('/'));
  }).catch(err => {
    console.error(err.stack);
  });
}
