(function(){
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // soft-girl color palette for the game area
  const P = {
    bgGrid: '#eadfff',
    // bricks go to white, with tiny lilac variation
    shades: ['#f3e8ff','#f7efff','#fbf6ff','#fdfbff','#ffffff'],
    paddleDark: '#e0c7ff',
    paddleLight: '#fbe8ff',
    ball: '#ffffff',
    trail: '#f0e2ff',
    factLight: '#a06fbf',
    factBorder: '#e4c5ff'
  };

  const baseSentence = '';

  const orderedFacts = [
    'hi my name is keyaa kapadia.',
    '— communication design bfa student',
    '— born in mumbai, ’05 baby',
    '— have a twin brother',
    '— grew up sketching in the margins',
    '— now based in nyc',
    '— published illustrator',
    '— concert-obsessed freak',
    '— sunset/sunrise obsessed',
    '— spotify is my best friend',
    '— have watched my favourite movie yjhd over 12986743 times',
    '— started off as a canva designer',
    '— obsessed with beach holidays',
    '— loves thai food',
    '— beach chaser',
    '— will do anything to get on the next flight and explore a new place',
    '— have two birth marks'
  ];
  let factIndex = 0;
  function nextFact(){ const s = orderedFacts[factIndex % orderedFacts.length]; factIndex++; return s; }

  let sentenceParts = baseSentence ? [baseSentence] : [];

  let playing = false;
  let gameOver = false;
  let lives = 3;
  let level = 1;
  let score = 0;

  let balls = [];
  const BALL_R = 7;
  const BASE_SPEED_RANGE = [3.0, 4.1];

  const TRAIL_LEN = 80;

  const PADDLE_BASE_W = 110;
  const PADDLE_H = 14;
  let paddle = { x: W/2 - PADDLE_BASE_W/2, y: H - 40, w: PADDLE_BASE_W, h: PADDLE_H, speed: 7 };

  let COLS = 9;
  let ROWS = 1;
  const BRICK_W = Math.floor((W - 120) / COLS);
  const BRICK_H = 22;
  const BRICK_GAP = 8;
  const GRID_OFFSET = { x: (W - (COLS*BRICK_W + (COLS-1)*BRICK_GAP))/2, y: 80 };

  const drops = [];

  let keys = { left:false, right:false };

  function rand(min,max){ return Math.random()*(max-min)+min }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)) }

  function setClock(){
    const el = document.getElementById('clock');
    if(!el) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    el.textContent = `${hh}:${mm}`;
  }
  setClock(); setInterval(setClock, 10000);

  function mkBricks(){
    ROWS = Math.min(1 + (level - 1), 7);
    const bricks = [];
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        let startShade;
        if(level===1){ startShade = Math.random() < 0.5 ? 0 : (Math.random()<0.5?3:4); }
        else { startShade = Math.max(0, Math.min(P.shades.length-2, (ROWS-1-r))); }
        const maxShade = P.shades.length-1;
        const stepsToBreak = (maxShade - startShade) + 1;
        bricks.push({
          x: GRID_OFFSET.x + c*(BRICK_W+BRICK_GAP),
          y: GRID_OFFSET.y + r*(BRICK_H+BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          startShade,
          step:0,
          stepsToBreak,
          alive: true
        });
      }
    }
    return bricks;
  }
  let bricks = mkBricks();

  function resetBalls(n=1){
    balls = [];
    for(let i=0;i<n;i++){
      const speed = rand(BASE_SPEED_RANGE[0], BASE_SPEED_RANGE[1]);
      const dir = i===0 ? (Math.random()<0.5?-1:1) : (i%2===0?1:-1);
      balls.push({
        x: paddle.x + paddle.w/2,
        y: paddle.y - 12,
        r: BALL_R,
        dx: dir*speed*rand(0.7,1.0),
        dy: -speed,
        trail: []
      });
    }
  }
  resetBalls(1);

  function resetPaddle(){ paddle.w = PADDLE_BASE_W; paddle.x = W/2 - paddle.w/2; }

  const identityLine = document.getElementById('identityLine');
  const chips = document.getElementById('chips');
  function renderParagraph(){ identityLine.innerHTML = `<span>${sentenceParts.join(' ')}</span>`; }
  renderParagraph();

  let typing = false; let typeQueue = [];
  function typeAppend(text){ typeQueue.push(text); if(!typing) consumeQueue(); }
  function consumeQueue(){
    if(typeQueue.length===0){ typing=false; return; }
    typing = true;
    const next = typeQueue.shift();
    let toAdd = ' ' + next; let i = 0;
    const reveal = ()=>{
      if(i <= toAdd.length){
        const full = sentenceParts.join(' ') + toAdd.slice(0,i);
        identityLine.innerHTML = `<span>${full}</span>`;
        i++;
        setTimeout(reveal, 18);
      } else {
        sentenceParts.push(next);
        renderParagraph();
        typing = false;
        consumeQueue();
      }
    };
    reveal();
  }
  function addChip(text){
    const el = document.createElement('div');
    el.className='chip';
    el.textContent = text;
    chips.appendChild(el);
  }

  function drawGrid(){
    ctx.save();
    ctx.strokeStyle = P.bgGrid;
    ctx.lineWidth = 1;
    for(let y=GRID_OFFSET.y-20;y<H-80;y+=20){
      ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(W-40,y); ctx.stroke();
    }
    for(let x=40;x<W-40;x+=20){
      ctx.beginPath(); ctx.moveTo(x, GRID_OFFSET.y-20); ctx.lineTo(x, H-80); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBricks(){
    bricks.forEach(b=>{
      if(!b.alive) return;
      const shadeIdx = Math.min(b.startShade + b.step, P.shades.length-1);
      const col = P.shades[shadeIdx];
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y+b.h);
      g.addColorStop(0, shade(col, 6));
      g.addColorStop(1, shade(col, -4));
      ctx.fillStyle = g;
      roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      roundRect(b.x+2, b.y+2, b.w-4, 5, 3); ctx.fill();
    });
  }

  function drawPaddle(){
    const x=paddle.x,y=paddle.y,w=paddle.w,h=paddle.h;
    const g = ctx.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,P.paddleLight);
    g.addColorStop(1,P.paddleDark);
    ctx.fillStyle=g;
    roundRect(x,y,w,h,8); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.55)';
    roundRect(x+2,y+2,w-4,4,6); ctx.fill();
  }

  function drawBalls(){
    balls.forEach(ball=>{
      drawTrail(ball);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
      const g = ctx.createRadialGradient(ball.x-2, ball.y-3, 1, ball.x, ball.y, ball.r+2);
      g.addColorStop(0,'#ffffff');
      g.addColorStop(1,P.ball);
      ctx.fillStyle=g;
      ctx.fill();
    });
  }

  function drawDrops(){
    drops.forEach(d=>{
      if(d.caught || d.dead) return;
      if(d.type==='fact'){
        const g = ctx.createLinearGradient(d.x, d.y, d.x, d.y+d.h);
        g.addColorStop(0, '#f5e6ff');
        g.addColorStop(1, '#fbefff');
        ctx.fillStyle = g;
        ctx.strokeStyle = P.factBorder;
        roundRect(d.x, d.y, d.w, d.h, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = P.factLight;
        ctx.font = '12px "Inter", system-ui, -apple-system, sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        clipText(d.label, d.x + d.w/2, d.y + d.h/2, d.w-8);
      } else if(d.type==='star'){
        ctx.save();
        ctx.translate(d.x + d.w/2, d.y + d.h/2);
        ctx.rotate(Math.PI/4);
        ctx.fillStyle='rgba(244,194,255,.18)';
        ctx.strokeStyle='#f4c2ff';
        ctx.lineWidth=2;
        roundRect(-12,-12,24,24,4); ctx.stroke(); ctx.fill();
        ctx.rotate(-Math.PI/4);
        ctx.fillStyle='#d39bff';
        ctx.font='16px "Inter", system-ui, -apple-system, sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('⟡',0,0);
        ctx.restore();
      }
    });
  }

  function drawTrail(ball){
    const pts=ball.trail; if(pts.length<2) return;
    for(let i=1;i<pts.length;i++){
      const p0=pts[i-1], p1=pts[i];
      const t=i/pts.length;
      const alpha=0.01+0.49*t;
      ctx.strokeStyle=P.trail;
      ctx.lineWidth=1;
      ctx.globalAlpha=alpha;
      ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke();
      ctx.globalAlpha=1;
    }
  }

  function roundRect(x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function shade(hex, amt){
    let c=hex.replace('#',''); if(c.length===3) c=c.split('').map(ch=>ch+ch).join('');
    const num=parseInt(c,16);
    let r=(num>>16)+amt; r=clamp(r,0,255);
    let g=(num>>8 & 0x00FF)+amt; g=clamp(g,0,255);
    let b=(num & 0x0000FF)+amt; b=clamp(b,0,255);
    return '#' + (r<<16 | g<<8 | b).toString(16).padStart(6,'0');
  }

  function clipText(text,x,y,maxWidth){
    const words=text.split(' '); let s='',measure='';
    for(const w of words){
      const test=measure?measure+' '+w:w;
      const m=ctx.measureText(test).width;
      if(m>maxWidth){ s=measure+'…'; break; }
      measure=test; s=test;
    }
    ctx.fillText(s,x,y);
  }

  function step(){
    if(keys.left) paddle.x -= paddle.speed;
    if(keys.right) paddle.x += paddle.speed;
    paddle.x = clamp(paddle.x, 20, W - paddle.w - 20);

    if(playing){
      for(let i=balls.length-1;i>=0;i--){
        const ball=balls[i];
        ball.trail.push({x:ball.x,y:ball.y});
        if(ball.trail.length>TRAIL_LEN) ball.trail.shift();
        ball.x+=ball.dx; ball.y+=ball.dy;

        if(ball.x - ball.r < 20){ ball.x = 20 + ball.r; ball.dx *= -1; }
        if(ball.x + ball.r > W-20){ ball.x = W-20 - ball.r; ball.dx *= -1; }
        if(ball.y - ball.r < 60){ ball.y = 60 + ball.r; ball.dy *= -1; }

        if(ball.y - ball.r > H){
          balls.splice(i,1);
          if(balls.length>0){
            balls.forEach(b=>{ b.dx*=1.08; b.dy*=1.08; });
          } else {
            lives = Math.max(0, lives - 1);
            playing = false;
            if(lives === 0){ gameOver = true; }
            resetBalls(1);
          }
          continue;
        }

        if(ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h &&
           ball.x >= paddle.x && ball.x <= paddle.x + paddle.w){
          const hit = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
          const speed = Math.sqrt(ball.dx*ball.dx + ball.dy*ball.dy) * 1.03;
          ball.dx = speed * hit * 0.9;
          ball.dy = -Math.abs(speed * (1 - Math.abs(hit)*0.35));
          ball.y = paddle.y - ball.r - 0.1;
        }

        for(const b of bricks){
          if(!b.alive) continue;
          if(ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
             ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h){
            const prevX = ball.x - ball.dx, prevY = ball.y - ball.dy;
            const wasInsideX = prevX > b.x && prevX < b.x + b.w;
            const wasInsideY = prevY > b.y && prevY < b.y + b.h;
            if(wasInsideX) ball.dy *= -1; else if(wasInsideY) ball.dx *= -1; else ball.dy *= -1;

            if(b.step < b.stepsToBreak - 1){ b.step += 1; }
            else { b.alive=false; score+=10; maybeSpawnDrop(b); }
          }
        }
      }

      drops.forEach(d=>{
        if(d.caught || d.dead) return;
        d.y += d.vy; d.vy *= 1.02;
        if(d.y + d.h >= paddle.y && d.y <= paddle.y + paddle.h &&
           d.x + d.w >= paddle.x && d.x <= paddle.x + paddle.w){
          d.caught = true; onCatch(d);
        }
        if(d.y > H+30) d.dead = true;
      });
    }
  }

  function onCatch(drop){
    if(drop.type==='fact'){
      const sentence = drop.sentence;
      let tag = sentence; ['—','–','-'].forEach(d => { tag = tag.split(d).join(''); });
      tag = tag.trim().split(',')[0].trim();
      addChip(tag);
      typeAppend(sentence);
    } else if(drop.type==='star'){
      if(level>=2 && balls.length<3){
        const base = balls[0] || {dx:rand(BASE_SPEED_RANGE[0],BASE_SPEED_RANGE[1]), dy:-rand(BASE_SPEED_RANGE[0],BASE_SPEED_RANGE[1])};
        const speed = Math.sqrt(base.dx*base.dx + base.dy*base.dy);
        while(balls.length<3){
          const ang=rand(-0.7,0.7), dir=Math.random()<0.5?-1:1;
          balls.push({
            x:paddle.x + paddle.w/2,
            y:paddle.y - 14,
            r:BALL_R,
            dx:dir*speed*Math.cos(ang),
            dy:-Math.abs(speed*Math.sin(ang) || speed*0.9),
            trail:[]
          });
        }
      }
    }
  }

  function maybeSpawnDrop(b){
    if(Math.random() < 0.75){
      const sentence = nextFact();
      let tag = sentence; ['—','–','-'].forEach(d => { tag = tag.split(d).join(''); });
      tag = tag.trim().split(',')[0].trim();
      const w=176, h=28;
      drops.push({
        type:'fact',
        x:b.x + b.w/2 - w/2,
        y:b.y + b.h/2,
        w, h,
        vy:3.3,
        label:tag,
        sentence,
        caught:false,
        dead:false
      });
    }
    if(level>=2 && Math.random() < 0.18 && balls.length===1){
      const size=26;
      drops.push({
        type:'star',
        x:b.x + b.w/2 - size/2,
        y:b.y + b.h/2 - size/2,
        w:size,
        h:size,
        vy:3.0,
        caught:false,
        dead:false
      });
    }
  }

  function levelCleared(){ return bricks.every(b=>!b.alive); }

  function render(){
    ctx.clearRect(0,0,W,H);

    ctx.save();
    ctx.strokeStyle = '#e4d4ff';
    ctx.lineWidth = 2;
    roundRect(20, 60, W-40, H-120, 12);
    ctx.stroke();
    ctx.restore();

    drawGrid();
    drawBricks();
    drawPaddle();
    drawBalls();
    drawDrops();

    ctx.fillStyle = '#b58cff';
    ctx.font = '12px "Inter", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score ${score}`, 28, 48);
    ctx.textAlign = 'center';
    ctx.fillText(`Lives ${lives}`, W/2, 48);
    ctx.textAlign = 'right';
    ctx.fillText(`Level ${level}`, W-28, 48);

    if(!playing && !gameOver){
      ctx.fillStyle = 'rgba(245,230,255,0.95)';
      roundRect(40, 140, W-80, 90, 10); ctx.fill();
      ctx.fillStyle = '#a06fbf';
      ctx.textAlign='center';
      ctx.font = '20px "Inter", system-ui, -apple-system, sans-serif';
      ctx.fillText('click / tap to launch', W/2, 190);
    }

    if(gameOver){
      ctx.fillStyle = 'rgba(245,230,255,0.98)';
      roundRect(60, 120, W-120, 200, 12); ctx.fill();
      ctx.fillStyle = '#a06fbf';
      ctx.textAlign='center';
      ctx.font = '22px "Inter", system-ui, -apple-system, sans-serif';
      ctx.fillText('Game Over — Well Played', W/2, 165);
      ctx.font = '16px "Inter", system-ui, -apple-system, sans-serif';
      ctx.fillText(`Final Score: ${score}  •  Levels Reached: ${level}`, W/2, 195);
      ctx.font = '13px "Inter", system-ui, -apple-system, sans-serif';
      ctx.fillText('click / tap to restart', W/2, 225);
    }
  }

  function loop(){
    step(); render();
    if(!gameOver && levelCleared()){
      level += 1;
      sentenceParts.push('— evolving, always learning');
      renderParagraph();
      resetPaddle();
      bricks = mkBricks();
      drops.length = 0;
      playing = false;
      resetBalls(1);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowLeft' || e.key==='a') keys.left = true;
    if(e.key==='ArrowRight' || e.key==='d') keys.right = true;
    if(e.key===' '){
      if(gameOver){ restart(); }
      else if(!playing){ playing = true; }
    }
  });
  window.addEventListener('keyup', (e)=>{
    if(e.key==='ArrowLeft' || e.key==='a') keys.left = false;
    if(e.key==='ArrowRight' || e.key==='d') keys.right = false;
  });

  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width/rect.width);
    paddle.x = clamp(mx - paddle.w/2, 20, W - paddle.w - 20);
    if(!playing){
      balls.forEach(b=>{ b.x = paddle.x + paddle.w/2; b.y = paddle.y - 12; });
    }
  });
  canvas.addEventListener('click', ()=>{
    if(gameOver){ restart(); }
    else if(!playing) playing = true;
  });

  canvas.addEventListener('touchmove',(e)=>{
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const mx = (t.clientX - rect.left) * (canvas.width/rect.width);
    paddle.x = clamp(mx - paddle.w/2, 20, W - paddle.w - 20);
    if(!playing){
      balls.forEach(b=>{ b.x = paddle.x + paddle.w/2; b.y = paddle.y - 12; });
    }
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchstart',()=>{
    if(gameOver){ restart(); }
    else if(!playing) playing = true;
  });

  function restart(){
    gameOver=false; lives=3; level=1; score=0;
    sentenceParts = baseSentence ? [baseSentence] : [];
    identityLine.innerHTML = `<span>${sentenceParts.join(' ')}</span>`;
    document.getElementById('chips').innerHTML='';
    factIndex=0;
    resetPaddle();
    bricks=mkBricks();
    drops.length=0;
    playing=false;
    resetBalls(1);
  }
})();
