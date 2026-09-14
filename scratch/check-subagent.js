const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\varsh\\.gemini\\antigravity-ide\\brain\\da5c829a-a481-4988-bb28-016154a9c194\\.system_generated\\logs\\transcript.jsonl', 'utf8').trim().split('\n');
for (const line of lines) {
  const o = JSON.parse(line);
  if (o.step_index >= 856 && o.step_index <= 863) {
    console.log(o.step_index, o.type, o.status, (o.content || '').slice(0, 300));
  }
}
