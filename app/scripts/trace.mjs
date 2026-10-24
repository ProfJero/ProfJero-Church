// Traces bitmap logos into single-path SVGs (run once; output is committed).
import potrace from 'potrace';
import { writeFileSync } from 'node:fs';
const [, , input, output, turd = '20'] = process.argv;
potrace.trace(input, { threshold: 128, turdSize: Number(turd), optTolerance: 0.4, color: 'currentColor', background: 'transparent' }, (err, svg) => {
  if (err) throw err;
  writeFileSync(output, svg);
  console.log('wrote', output, svg.length, 'bytes');
});
