const hex = h => { h=h.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); };
const lin = c => c<=0.04045? c/12.92 : ((c+0.055)/1.055)**2.4;
const L = h => { const [r,g,b]=hex(h).map(lin); return 0.2126*r+0.7152*g+0.0722*b; };
const cr = (a,b) => { const x=L(a), y=L(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
export const light = {
  paper:'#F7F6F1', raised:'#FFFFFF', well:'#F0EEE7', sunken:'#E9E6DD', hover:'#EBE8DF',
  ink:'#1A1916', 'ink-2':'#4A463F', 'ink-3':'#686359',
  rule:'#E0DCD1', 'rule-soft':'#EAE7DF', 'rule-strong':'#C6C0B2',
  'grid-minor':'#CEC8BA','grid-major':'#B3AC9C',
  'accent-solid':'#D3EE3F', accent:'#4D5A00', 'accent-ink':'#1A1916', 'accent-soft':'#EFF6C8', highlight:'#E3F380',
  'signal-strong':'#0B6A4E','signal-strong-soft':'#E3F1EA','mark-strong':'#0E8F6A',
  'signal-partial':'#8F4E00','signal-partial-soft':'#FAEED8','mark-partial':'#D88A00',
  'signal-gap':'#B4233A','signal-gap-soft':'#FAE8E9','mark-gap':'#E04A5A',
  ai:'#6A3CC9','ai-soft':'#F1EDFA','ai-rule':'#CBBDEE','mark-ai':'#8B5CF6',
  focus:'#1A1916',
};
export const dark = {
  paper:'#131210', raised:'#1C1B18', well:'#171614', sunken:'#23211D', hover:'#2A2824',
  ink:'#EEEBE3', 'ink-2':'#B7B2A6', 'ink-3':'#958F83',
  rule:'#2E2B26', 'rule-soft':'#252320', 'rule-strong':'#44403A',
  'grid-minor':'#34312B','grid-major':'#4D4840',
  'accent-solid':'#D3EE3F', accent:'#D3EE3F', 'accent-ink':'#161600', 'accent-soft':'#23280F', highlight:'#3A4416',
  'signal-strong':'#4CC9A0','signal-strong-soft':'#0F2620','mark-strong':'#22A47E',
  'signal-partial':'#F2B252','signal-partial-soft':'#2B200E','mark-partial':'#EFA12A',
  'signal-gap':'#FF8086','signal-gap-soft':'#331719','mark-gap':'#F4606A',
  ai:'#C3AFFF','ai-soft':'#1E1A2C','ai-rule':'#4A3E75','mark-ai':'#A385FA',
  focus:'#D3EE3F',
};
const S=['paper','raised','well','sunken','hover'];
const mode = process.argv[2];
for (const [name,T] of Object.entries({light,dark})) {
  const out=[];
  const row=(fg,bgs)=>out.push(`| \`--${fg}\` | ${bgs.map(bg=>`${bg} ${cr(T[fg],T[bg]).toFixed(1)}`).join(', ')} |`);
  for (const fg of ['ink','ink-2','ink-3','accent','signal-strong','signal-partial','signal-gap','ai']) row(fg,S);
  row('signal-strong',['signal-strong-soft']); row('signal-partial',['signal-partial-soft']); row('signal-gap',['signal-gap-soft']); row('ai',['ai-soft']);
  row('ink',['accent-soft','highlight','ai-soft','accent-solid']); row('ink-2',['accent-soft','ai-soft','signal-gap-soft','highlight']); row('ink-3',['accent-soft','ai-soft']);
  row('accent',['accent-soft']); row('accent-ink',['accent-solid']); row('paper',['ink']);
  for (const m of ['mark-strong','mark-partial','mark-gap','mark-ai','focus','rule-strong','grid-major']) row(m,['paper','raised']);
  console.log(`\n### ${name}\n`+out.join('\n'));
  const bad=[];
}
