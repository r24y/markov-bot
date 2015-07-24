import Slack from 'slack-client';
import co from 'co';
import tokenize from './tokenize';
import {saveOccurrence} from './db';
import getSentence from './markov';

const TOKEN = process.env.SLACK_TOKEN;

const bot = new Slack(TOKEN, true, true);

bot.on('open', () => {
  console.log('Bot online');
});

bot.on('message', (message) => {
  let {text, user} = message;
  console.log(`@${user}: ${text}`)
  text = text.replace(/<@(\w+)>/g, ($0, $1) => {
    console.log($0, $1);
    return `@${bot.getUserByID($1).name}`
  });
  const channel = bot.getChannelGroupOrDMByID(message.channel);
  co(function *() {
    const tokens = tokenize(text);
    for (let t in tokens) {
      yield saveOccurrence(tokens[t]);
    }
    if (text.indexOf('@shittybot') >= 0 || Math.random()*10 < 1) {
      channel.send(yield getSentence());
    }
  }).catch(err => {
    console.error(err.stack);
  });
});

export default bot;
