import PouchDB from 'pouchdb';
import path from 'path';
import fs from 'q-io/fs';
import uuid from 'node-uuid';
import co from 'co';

import tokenize from './tokenize';

let _db = null;

function *getDb() {
  if (_db) return _db;
  const DB_PATH = path.join(__dirname, '.db');
  if (!(yield fs.isDirectory(DB_PATH))) {
    yield fs.makeTree(DB_PATH);
    _db = new PouchDB(DB_PATH);
    yield [
      _db.put(dictDesign()),
      _db.put(occDesign())
    ];
  } else {
    _db = new PouchDB(DB_PATH);
  }
  return _db;
}

function *saveOccurrence(occ) {
  const db = yield getDb();
  occ.type = 'occurrence';
  // Using UUID v1 means that Couch will internally sort by timestamp.
  // To randomly select a word, we find the number N of documents in
  // the database, pick a random number R between 0 and N, and then select
  // document R. Using UUID v1 ensures that new documents added to the end of
  // the database won't make the random selection unfair.
  //
  // To be quite honest, I'm not sure why I'm focusing on making the random
  // selection "fair" like this. It's a Markov bot. No one cares.
  occ._id = uuid.v1();
  return yield db.put(occ);
}

function *randOccurrence() {
  const db = yield getDb();
  const count = (yield db.query('dict/count')).rows[0].value;
  const r = Math.floor(Math.random() * count);
  return (yield db.query('dict/word', {
    skip: r,
    limit: 1
  })).rows[0].key;
}

function *nextWord(word) {
  const db = yield getDb();
  const nextTokens = (yield db.query('dict/next', {
    key: word
  })).rows.map(r => r.value);
  const nextToken = nextTokens[Math.floor(Math.random() * nextTokens.length)];
  const forms = (yield db.query('dict/word', {
    key: nextToken
  })).rows.map(r => r.value);
  return {
    token: nextToken,
    word: forms[Math.floor(Math.random() * forms.length)]
  };
}

/*
When I refer to an "occurrence", I mean the following:
```
{
  type: 'occurrence',
  word: string,
  token: Token,
  nextToken: Token,
  previousToken: Token
}
```
*/

function dictDesign() {
  return {
    _id: '_design/dict',
    views: {
      next: {
        map: `function (doc) {
          if (doc.type === 'occurrence')
            emit(doc.token, doc.nextToken);
        }`
      },
      previous: {
        map: `function (doc) {
          if (doc.type === 'occurrence')
            emit(doc.token, doc.previousToken);
        }`
      },
      word: {
        map: `function (doc) {
          if (doc.type === 'occurrence')
            emit(doc.token, doc.word);
        }`
      },
      count: {
        map: `function (doc) {
          if (doc.type === 'occurrence')
            emit(doc.word, 1);
        }`,
        reduce: '_count'
      }
    }
  };
}

function occDesign() {
  return {
    _id: '_design/occ',
    views: {
      count: {
        map: `function (doc) {
          if (doc.type === 'occurrence')
            emit(null, 1);
        }`,
        reduce: '_count'
      }
    }
  }
}

export {
  getDb,
  saveOccurrence,
  randOccurrence,
  nextWord
};


if (require.main === module) {
  co(function *() {
    const db = yield getDb();
    const corpus = yield fs.read(path.join(__dirname,'..', 'corpus.txt'));
    const tokens = tokenize(corpus);
    for (let t in tokens) {
      yield saveOccurrence(tokens[t]);
    }
    let token = tokenize.SENTENCE_START;
    let word = null;
    let sentence = [];
    while (token !== tokenize.SENTENCE_END) {
      const next = yield nextWord(token);
      token = next.token;
      word = next.word;
      sentence.push(word);
    }
    console.log(sentence.join(' ').replace(/\s([,.])/g, '$1'));
    db.destroy();
  }).catch(err => {
    console.error(err.stack);
  });
}
