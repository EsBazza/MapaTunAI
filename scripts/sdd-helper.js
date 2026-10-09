const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sddDir = path.join(process.cwd(), '.superpowers', 'sdd');
if (!fs.existsSync(sddDir)) {
  fs.mkdirSync(sddDir, { recursive: true });
}

const command = process.argv[2];

if (command === 'task-brief') {
  const planFile = process.argv[3];
  const taskNumber = process.argv[4];
  if (!planFile || !taskNumber) {
    console.error('Usage: node scripts/sdd-helper.js task-brief <plan-file> <task-number>');
    process.exit(1);
  }

  const content = fs.readFileSync(planFile, 'utf8');
  const lines = content.split('\n');
  const taskHeaderRegex = new RegExp(`^###\\s+Task\\s+${taskNumber}:`, 'i');
  const anyTaskHeaderRegex = /^###\s+Task\s+\d+:/i;

  let inTask = false;
  const taskLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (taskHeaderRegex.test(line)) {
      inTask = true;
      taskLines.push(line);
      continue;
    }
    if (inTask && anyTaskHeaderRegex.test(line)) {
      break;
    }
    if (inTask) {
      taskLines.push(line);
    }
  }

  if (taskLines.length === 0) {
    console.error(`Task ${taskNumber} not found in ${planFile}`);
    process.exit(2);
  }

  const outFile = path.join(sddDir, `task-${taskNumber}-brief.md`);
  fs.writeFileSync(outFile, taskLines.join('\n'), 'utf8');
  console.log(`wrote ${outFile}: ${taskLines.length} lines`);
} else if (command === 'review-package') {
  const base = process.argv[3];
  const head = process.argv[4];
  if (!base || !head) {
    console.error('Usage: node scripts/sdd-helper.js review-package <base> <head>');
    process.exit(1);
  }

  const base7 = execSync(`git rev-parse --short ${base}`, { encoding: 'utf8' }).trim();
  const head7 = execSync(`git rev-parse --short ${head}`, { encoding: 'utf8' }).trim();

  const commitsLog = execSync(`git log --oneline ${base7}..${head7}`, { encoding: 'utf8' });
  const statDiff = execSync(`git diff --stat ${base7}..${head7}`, { encoding: 'utf8' });
  const fullDiff = execSync(`git diff -U10 ${base7}..${head7}`, { encoding: 'utf8' });

  const outFile = path.join(sddDir, `review-${base7}..${head7}.diff`);
  const content = [
    `# Review package: ${base}..${head}`,
    '',
    '## Commits',
    commitsLog,
    '## Files changed',
    statDiff,
    '## Diff',
    fullDiff,
  ].join('\n');

  fs.writeFileSync(outFile, content, 'utf8');
  console.log(`wrote ${outFile}: ${content.length} bytes`);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
