/* Exercise library with animated side-view figures (pure SVG, works offline). */
(function(){
  const GROUND = 'M6 94 H114';
  const ln = (a,b,cls) => ({tag:'line',cls, f:p=>({x1:p[a][0],y1:p[a][1],x2:p[b][0],y2:p[b][1]})});
  const st = (x1,y1,x2,y2,cls='eq') => ({tag:'line',cls,f:()=>({x1,y1,x2,y2})});
  const dumbbell = (k='W') => ({tag:'rect',cls:'pf',f:p=>({x:p[k][0]-7,y:p[k][1]-3,width:14,height:6,rx:2})});
  const plate = (k='W',r=6) => ({tag:'circle',cls:'pf',f:p=>({cx:p[k][0],cy:p[k][1],r})});
  const bell = (k='W') => ({tag:'rect',cls:'pf',f:p=>({x:p[k][0]-5,y:p[k][1]-1,width:10,height:10,rx:4})});
  const handle = (k='W') => ({tag:'circle',cls:'pf',f:p=>({cx:p[k][0],cy:p[k][1],r:3.5})});
  const cable = (x,y,k='W') => ({tag:'line',cls:'cb',f:p=>({x1:p[k][0],y1:p[k][1],x2:x,y2:y})});
  const pulley = (x,y) => ({tag:'circle',cls:'pf',f:()=>({cx:x,cy:y,r:4})});

  const EX = {
    squat:{name:'Goblet squat',muscles:'Legs · glutes · core',
      cue:'Hold the weight at your chest. Sit hips back and down, knees over toes, chest up. Drive up through your heels.',
      A:{P:[60,52],N:[60,28],K:[62,72],F:[60,92],E:[66,40],W:[68,30]},
      B:{P:[46,68],N:[56,46],K:[66,72],F:[60,92],E:[64,57],W:[67,46]},
      back:[], front:[bell()]},
    chestpress:{name:'Machine chest press',muscles:'Chest · shoulders · triceps',
      cue:'Back flat on the pad, handles at chest height. Press forward until arms are almost straight, then return slowly.',
      A:{P:[50,66],N:[48,42],K:[71,64],F:[72,85],E:[40,52],W:[52,46]},
      B:{P:[50,66],N:[48,42],K:[71,64],F:[72,85],E:[61,43],W:[73,43]},
      back:[st(42,70,39,30),st(38,70,62,70),st(50,72,50,92)], front:[handle()]},
    seatedrow:{name:'Seated cable row',muscles:'Upper back · lats · biceps',
      cue:'Sit tall, slight knee bend. Pull the handle to your lower ribs, squeeze shoulder blades together, return under control.',
      A:{P:[42,74],N:[48,51],K:[62,68],F:[82,72],E:[60,55],W:[72,57]},
      B:{P:[42,74],N:[42,50],K:[62,68],F:[82,72],E:[34,60],W:[46,58]},
      back:[st(28,78,58,78),st(86,62,86,84),pulley(106,62)], front:[cable(106,62),handle()]},
    plank:{name:'Forearm plank',muscles:'Core · shoulders',
      cue:'Elbows under shoulders, body in one straight line from head to heels. Brace your stomach and breathe steadily.',
      A:{P:[68,84],N:[44,79],K:[86,87],F:[104,90],E:[44,92],W:[58,92]},
      B:{P:[68,82],N:[44,79],K:[86,86],F:[104,90],E:[44,92],W:[58,92]},
      dur:3, back:[], front:[]},
    rdl:{name:'Romanian deadlift',muscles:'Hamstrings · glutes · lower back',
      cue:'Soft knees, push hips back and lower the bar along your legs with a flat back. Stand tall by squeezing glutes.',
      A:{P:[60,50],N:[60,26],K:[61,71],F:[60,92],E:[61,39],W:[61,51]},
      B:{P:[70,52],N:[48,40],K:[64,71],F:[60,92],E:[47,53],W:[48,65]},
      back:[], front:[plate('W',7)]},
    pulldown:{name:'Lat pulldown',muscles:'Lats · upper back · biceps',
      cue:'Thighs under the pad, lean back slightly. Pull the bar to your upper chest, elbows down, then let it rise slowly.',
      A:{P:[52,72],N:[52,48],K:[73,70],F:[74,91],E:[56,35],W:[58,23]},
      B:{P:[52,72],N:[52,48],K:[73,70],F:[74,91],E:[44,56],W:[50,45]},
      back:[st(40,74,62,74),st(52,76,52,92),st(68,62,78,62),pulley(56,4)],
      front:[cable(56,4),{tag:'line',cls:'pr',f:p=>({x1:p.W[0]-16,y1:p.W[1],x2:p.W[0]+12,y2:p.W[1]})}]},
    shoulderpress:{name:'Seated shoulder press',muscles:'Shoulders · triceps',
      cue:'Back against the pad, dumbbells at shoulder height. Press straight up without arching, lower to shoulders.',
      A:{P:[52,72],N:[52,48],K:[73,70],F:[74,91],E:[60,56],W:[60,44]},
      B:{P:[52,72],N:[52,48],K:[73,70],F:[74,91],E:[56,35],W:[56,23]},
      back:[st(44,74,42,36),st(40,74,62,74),st(52,76,52,92)], front:[dumbbell()]},
    deadbug:{name:'Dead bug',muscles:'Deep core',
      cue:'Lie on your back, knees and arms up. Press lower back into the floor, slowly extend opposite arm and leg, return, switch.',
      A:{P:[72,86],N:[46,86],K:[72,65],F:[92,65],E:[46,73],W:[46,61],K2:[72,65],F2:[92,65],E2:[46,73],W2:[46,61]},
      B:{P:[72,86],N:[46,86],K:[92,80],F:[112,84],E:[38,74],W:[26,72],K2:[72,65],F2:[92,65],E2:[46,73],W2:[46,61]},
      dur:3.2, back:[], front:[]},
    legpress:{name:'Leg press',muscles:'Quads · glutes',
      cue:'Feet hip-width on the plate, lower back on the pad. Lower until knees reach ~90°, push back without locking knees.',
      A:{P:[46,74],N:[26,58],K:[56,54],F:[76,58],E:[36,70],W:[48,74]},
      B:{P:[46,74],N:[26,58],K:[67,64],F:[88,54],E:[36,70],W:[48,74]},
      back:[st(18,52,44,78),st(44,80,62,80),st(62,80,112,50,'gd')],
      front:[{tag:'line',cls:'pr',f:p=>({x1:p.F[0]-5,y1:p.F[1]-11,x2:p.F[0]+5,y2:p.F[1]+11})}]},
    inclinepress:{name:'Incline dumbbell press',muscles:'Upper chest · shoulders',
      cue:'Bench at 30–45°. Dumbbells at chest level, press up and slightly together, lower slowly with elbows at ~45°.',
      A:{P:[54,76],N:[34,60],K:[74,72],F:[76,92],E:[32,73],W:[42,64]},
      B:{P:[54,76],N:[34,60],K:[74,72],F:[76,92],E:[38,47],W:[40,35]},
      back:[st(26,58,56,82),st(56,82,66,82),st(48,84,48,93)], front:[dumbbell()]},
    cablerow:{name:'Standing cable row',muscles:'Mid back · rear shoulders',
      cue:'Staggered stance, brace your core. Pull the handle to your side, elbow close to body, squeeze, then reach forward.',
      A:{P:[56,54],N:[54,30],K:[64,73],F:[68,92],K2:[50,73],F2:[46,92],E:[67,34],W:[79,36]},
      B:{P:[56,54],N:[54,30],K:[64,73],F:[68,92],K2:[50,73],F2:[46,92],E:[44,40],W:[56,40]},
      back:[st(108,10,108,94),pulley(108,38)], front:[cable(108,38),handle()]},
    carry:{name:"Farmer's carry",muscles:'Grip · core · traps',
      cue:'Heavy weight in each hand, shoulders back, stand tall. Walk with short controlled steps for the set distance.',
      A:{P:[60,52],N:[60,28],K:[66,71],F:[64,92],K2:[55,71],F2:[50,91],E:[60,41],W:[60,53]},
      B:{P:[60,52],N:[60,28],K:[55,71],F:[50,91],K2:[66,71],F2:[64,92],E:[60,41],W:[60,53]},
      dur:1.2, back:[], front:[bell()]},
    walk:{name:'Brisk walk / incline treadmill',muscles:'Heart · legs',
      cue:'Walk at a pace where you can talk but not sing. Add incline before speed. Aim for steady breathing.',
      A:{P:[58,52],N:[59,28],K:[64,71],F:[62,92],K2:[53,71],F2:[48,91],E:[64,40],W:[72,47],E2:[54,40],W2:[48,49]},
      B:{P:[58,52],N:[59,28],K:[53,71],F:[48,91],K2:[64,71],F2:[62,92],E:[54,40],W:[48,49],E2:[64,40],W2:[72,47]},
      dur:1.1, ground:'M24 94 H100', back:[st(96,94,104,50),st(104,50,92,46)], front:[]},
    bike:{name:'Stationary bike',muscles:'Heart · legs',
      cue:'Seat at hip height, slight knee bend at the bottom. Keep a steady cadence; add resistance as you get fitter.',
      A:{P:[54,50],N:[64,28],K:[72,59],F:[72,80],K2:[68,62],F2:[52,76],E:[74,38],W:[84,40]},
      B:{P:[54,50],N:[64,28],K:[68,62],F:[52,76],K2:[72,59],F2:[72,80],E:[74,38],W:[84,40]},
      dur:1, back:[st(54,54,62,78),st(62,78,84,42),st(84,42,86,36),st(44,52,62,52),st(62,78,40,94),st(62,78,90,94),
        {tag:'circle',cls:'eq',f:()=>({cx:62,cy:78,r:4})}],
      front:[{tag:'line',cls:'pr',f:p=>({x1:62,y1:78,x2:p.F[0],y2:p.F[1]})}]},
  };

  const SESSIONS = {
    A:{label:'A',name:'Full body',type:'Strength',items:[
      {id:'squat',sets:3,reps:10,unit:'reps'},{id:'chestpress',sets:3,reps:10,unit:'reps'},
      {id:'seatedrow',sets:3,reps:10,unit:'reps'},{id:'plank',sets:3,reps:30,unit:'sec',noKg:true}]},
    B:{label:'B',name:'Hinge & pull',type:'Strength',items:[
      {id:'rdl',sets:3,reps:10,unit:'reps'},{id:'pulldown',sets:3,reps:10,unit:'reps'},
      {id:'shoulderpress',sets:3,reps:10,unit:'reps'},{id:'deadbug',sets:3,reps:10,unit:'reps',noKg:true}]},
    C:{label:'C',name:'Legs & press',type:'Strength',items:[
      {id:'legpress',sets:3,reps:12,unit:'reps'},{id:'inclinepress',sets:3,reps:10,unit:'reps'},
      {id:'cablerow',sets:3,reps:12,unit:'reps'},{id:'carry',sets:3,reps:40,unit:'m'}]},
    D:{label:'D',name:'Cardio (optional)',type:'Cardio',items:[
      {id:'walk',sets:1,reps:30,unit:'min',noKg:true},{id:'bike',sets:1,reps:20,unit:'min',noKg:true}]},
  };

  function headPos(p){
    const dx=p.N[0]-p.P[0], dy=p.N[1]-p.P[1], L=Math.hypot(dx,dy)||1;
    return [+(p.N[0]+dx/L*10).toFixed(1), +(p.N[1]+dy/L*10).toFixed(1)];
  }
  function full(p){ const q={...p}; q.H=headPos(p); return q; }

  function el(item,A,B,dur){
    const a=item.f(A), b=item.f(B);
    let s=`<${item.tag} class="${item.cls}"`;
    for(const k in a) s+=` ${k}="${a[k]}"`;
    let kids='';
    for(const k in a){
      if(a[k]!==b[k]) kids+=`<animate attributeName="${k}" values="${a[k]};${b[k]};${a[k]}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/>`;
    }
    return kids ? s+`>${kids}</${item.tag}>` : s+'/>';
  }

  function figure(id){
    const ex=EX[id]; if(!ex) return '';
    const A=full(ex.A), B=full(ex.B), dur=ex.dur||2.6;
    const parts=[];
    parts.push(`<path class="gd" d="${ex.ground||GROUND}"/>`);
    (ex.back||[]).forEach(i=>parts.push(el(i,A,B,dur)));
    // far-side limbs
    if(A.K2) { parts.push(el(ln('P','K2','bk'),A,B,dur)); parts.push(el(ln('K2','F2','bk'),A,B,dur)); }
    if(A.E2) { parts.push(el(ln('N','E2','bk'),A,B,dur)); parts.push(el(ln('E2','W2','bk'),A,B,dur)); }
    // near side
    [['P','N'],['P','K'],['K','F'],['N','E'],['E','W']].forEach(([a,b])=>parts.push(el(ln(a,b,'bd'),A,B,dur)));
    parts.push(el({tag:'circle',cls:'hd',f:p=>({cx:p.H[0],cy:p.H[1],r:7})},A,B,dur));
    (ex.front||[]).forEach(i=>parts.push(el(i,A,B,dur)));
    return `<svg class="fig" viewBox="0 0 120 100" role="img" aria-label="${ex.name} demonstration">${parts.join('')}</svg>`;
  }

  window.EXERCISES = EX;
  window.SESSIONS = SESSIONS;
  window.exerciseFigure = figure;
})();
