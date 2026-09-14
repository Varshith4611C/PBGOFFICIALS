const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\varsh\\.gemini\\antigravity-ide\\brain\\da5c829a-a481-4988-bb28-016154a9c194\\.system_generated\\logs\\transcript_full.jsonl')
});

rl.on('line', (line) => {
  const o = JSON.parse(line);
  if (o.step_index === 857) {
    console.log(o.content);
    process.exit(0);
  }
});
