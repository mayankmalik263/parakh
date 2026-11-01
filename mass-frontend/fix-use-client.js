const fs = require('fs');
const glob = ['app/simulate/page.tsx','components/landing/Hero.tsx','app/dashboard/page.tsx','app/dashboard/evals/page.tsx','components/ResultsDisplay.tsx','app/dashboard/[id]/page.tsx','app/docs/page.tsx','components/landing/Features.tsx','components/landing/CTA.tsx','app/login/page.tsx'];

glob.forEach(f => {
  const p = 'src/' + f;
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  if (lines[0].startsWith('import { Icon }') && (lines[1].startsWith("'use client'") || lines[1].startsWith('"use client"'))) {
    const imp = lines[0];
    lines[0] = lines[1];
    lines[1] = imp;
    fs.writeFileSync(p, lines.join('\n'), 'utf8');
    console.log('Fixed ' + f);
  }
});
