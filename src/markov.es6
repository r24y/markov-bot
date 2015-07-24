import tokenize from './tokenize';
import {nextWord} from './db';

function *getSentence() {
  let next = {token: tokenize.SENTENCE_START};
  const sentence = [];
  while (next.token !== tokenize.SENTENCE_END) {
    console.log(next.token);
    if (next.word && next.word.trim()) sentence.push(next.word);
    next = yield nextWord(next.token);
  }
  return sentence.filter(x => x).join(' ').replace(/\s([,.])/g, '$1').replace(/@\s/g, '@');
}

export default getSentence;
