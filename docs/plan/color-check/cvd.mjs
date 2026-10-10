const hex = h => { h=h.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); };
const lin = c => c<=0.04045? c/12.92 : ((c+0.055)/1.055)**2.4;
const unlin = c => c<=0.0031308? 12.92*c : 1.055*c**(1/2.4)-0.055;
const L = rgb => 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
const cr = (a,b) => { const x=L(hex(a).map(lin)), y=L(hex(b).map(lin)); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
// Machado 2009 severity 1.0
const M = {
 deut:[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
 prot:[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
 trit:[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]],
};
const sim=(h,m)=>{const l=hex(h).map(lin); return m.map(r=>Math.min(1,Math.max(0,r[0]*l[0]+r[1]*l[1]+r[2]*l[2])));};
// OKLab
const oklab=l=>{const [r,g,b]=l;const L_=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),M_=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),S_=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);return[0.2104542553*L_+0.7936177850*M_-0.0040720468*S_,1.9779984951*L_-2.4285922050*M_+0.4505937099*S_,0.0259040371*L_+0.7827717662*M_-0.8086757660*S_];};
const dE=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))*100;
const sets = JSON.parse(process.argv[2]);
for (const [name,cols] of Object.entries(sets)) {
  console.log('\n'+name, Object.entries(cols).map(([k,v])=>`${k}${v} vsPaper ${cr(v,cols.paper??'#F7F6F1').toFixed(2)}`).join(' | '));
  const keys=Object.keys(cols).filter(k=>k!=='paper');
  for (const v of ['normal','deut','prot','trit']) {
    const out=[];
    for (let i=0;i<keys.length;i++) for (let j=i+1;j<keys.length;j++){
      const a=cols[keys[i]],b=cols[keys[j]];
      const la=v==='normal'?hex(a).map(lin):sim(a,M[v]); const lb=v==='normal'?hex(b).map(lin):sim(b,M[v]);
      out.push(`${keys[i]}/${keys[j]}=${dE(oklab(la),oklab(lb)).toFixed(1)}`);
    }
    console.log(' ',v.padEnd(6),out.join('  '));
  }
}
