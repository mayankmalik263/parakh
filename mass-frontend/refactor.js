const fs = require('fs');

const glob = [
  'app/simulate/page.tsx',
  'components/landing/Hero.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/evals/page.tsx',
  'components/ResultsDisplay.tsx',
  'app/dashboard/[id]/page.tsx',
  'app/docs/page.tsx',
  'components/landing/Features.tsx',
  'components/landing/CTA.tsx',
  'app/login/page.tsx'
];

let totalReplaced = 0;

glob.forEach(f => {
  const p = 'src/' + f;
  if (!fs.existsSync(p)) return;
  
  let content = fs.readFileSync(p, 'utf8');
  let fileReplaced = 0;
  
  if (content.includes('material-symbols-outlined')) {
    // Add import statement if missing
    if (!content.includes('import { Icon }')) {
      const lines = content.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          lastImportIdx = i;
        }
      }
      if (lastImportIdx !== -1) {
        lines.splice(lastImportIdx + 1, 0, "import { Icon } from '@/components/ui/Icon';");
        content = lines.join('\n');
      } else {
        content = "import { Icon } from '@/components/ui/Icon';\n" + content;
      }
    }
    
    // Replace span with Icon
    content = content.replace(/<span\s+className=["']([^"']*)["']([^>]*)>([\s\S]*?)<\/span>/g, (match, classNames, otherProps, innerText) => {
      if (!classNames.includes('material-symbols-outlined')) return match;
      
      const remainingClasses = classNames.split(/\s+/).filter(c => c && c !== 'material-symbols-outlined').join(' ');
      const classProp = remainingClasses ? ` className="${remainingClasses}"` : '';
      const otherPropsStr = otherProps.trim() ? ` ${otherProps.trim()}` : '';
      
      let nameProp = '';
      innerText = innerText.trim();
      
      if (innerText.startsWith('{') && innerText.endsWith('}')) {
        nameProp = `name=${innerText}`;
      } else {
        nameProp = `name="${innerText}"`;
      }
      
      fileReplaced++;
      totalReplaced++;
      return `<Icon ${nameProp}${classProp}${otherPropsStr} />`;
    });
    
    fs.writeFileSync(p, content, 'utf8');
    console.log(f + ': ' + fileReplaced);
  }
});
console.log('Total: ' + totalReplaced);
