(function(){
var D=document,W=window,RM=W.matchMedia&&W.matchMedia('(prefers-reduced-motion:reduce)').matches;
var TOUCH=W.matchMedia&&W.matchMedia('(hover:none)').matches;var ENGINE=!TOUCH&&!RM;
function $(s,r){return (r||D).querySelector(s)}function $$(s,r){return [].slice.call((r||D).querySelectorAll(s))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}function lerp(a,b,t){return a+(b-a)*t}function ease(t){return 1-Math.pow(1-t,3)}
/* header, menu */
var hd=$('.hd'),mt=$('.mt'),mm=$('.mm');
if(mt&&mm){var cm=function(){mm.classList.remove('open');mt.classList.remove('x')};mt.onclick=function(){var o=mm.classList.toggle('open');mt.classList.toggle('x',o)};mm.addEventListener('click',function(e){if(e.target===mm||e.target.closest('a'))cm()})}
/* whatsapp links */
var WA='https://wa.me/595992149352?text=';
$$('[data-wa]').forEach(function(a){a.href=WA+encodeURIComponent(a.dataset.wa);a.target='_blank';a.rel='noopener'});
$$('.rv').forEach(function(el){el.classList.add('in')});
/* word reveal */
var wordEls=$$('[data-words]');
wordEls.forEach(function(el){
 function walk(node){[].slice.call(node.childNodes).forEach(function(c){
  if(c.nodeType===3){var f=D.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(function(t){if(!t)return;if(/^\s+$/.test(t)){f.appendChild(D.createTextNode(' '))}else{var s=D.createElement('span');s.className='w';s.textContent=t;f.appendChild(s)}});node.replaceChild(f,c)}
  else if(c.nodeType===1)walk(c)})}
 walk(el);el._w=$$('.w',el);el._k=-1});
/* tabs */
var tb=$$('.tabs button');
function show(id,push){var ok=false;$$('.pane').forEach(function(p){var on=p.id===id;p.classList.toggle('on',on);if(on)ok=true});if(!ok)return;tb.forEach(function(b){b.classList.toggle('on',b.dataset.t===id)});if(push)history.replaceState(null,'','#'+id)}
if(tb.length){tb.forEach(function(b){b.onclick=function(){show(b.dataset.t,true);var t=$('.pane.on');if(t){var y=t.getBoundingClientRect().top+W.scrollY-150;if(y<W.scrollY)W.scrollTo({top:Math.max(0,y),behavior:'smooth'})}}});
 var h=location.hash.slice(1),he=h&&D.getElementById(h);show(he&&he.classList.contains('pane')?h:tb[0].dataset.t);
 W.addEventListener('hashchange',function(){var h=location.hash.slice(1),he=h&&D.getElementById(h);if(he&&he.classList.contains('pane'))show(h)})}
/* lazy videos + play only when visible */
function lazyVideos(){$$('video[data-src]').forEach(function(v){if(v._l)return;v._l=1;var s=D.createElement('source');s.src=v.dataset.src;s.type='video/mp4';var s2=D.createElement('source');s2.src=v.dataset.src.replace('.mp4','.webm');s2.type='video/webm';v.appendChild(s);v.appendChild(s2);v.load();if(v._vis){var p=v.play();if(p&&p.catch)p.catch(function(){})}})}
if(!TOUCH){if(D.readyState==='complete')setTimeout(lazyVideos,400);else W.addEventListener('load',function(){setTimeout(lazyVideos,400)})}
if('IntersectionObserver' in W){
 var vio=new IntersectionObserver(function(e){e.forEach(function(x){var v=x.target;v._vis=x.isIntersecting;if(!v._l)return;if(x.isIntersecting){var p=v.play();if(p&&p.catch)p.catch(function(){})}else v.pause()})},{threshold:.05});
 if(!TOUCH)$$('video[data-src]').forEach(function(v){vio.observe(v)});
 var pio=new IntersectionObserver(function(e){e.forEach(function(x){x.target.classList.toggle('off',!x.isIntersecting)})},{threshold:0});
 $$('.hero,.h2,.mq').forEach(function(el){pio.observe(el)})}
/* scroll engine: reads first, then writes */
var pgb=$('.pgb'),xv=$('.xv'),dbs=$$('.db .trk'),w3=$('.w3 .stage'),tlw=$('.tlw'),darks=$$('.hero,.xv,.db,.lz,.fin,.sec.dk,.ft');
var xs=xv?$$('.xs',xv):[],xc=xv?$('.xc',xv):null,xh=xv?$('.xh',xv):null,xo=xv?$('.xo',xv):null,xst=xv?$('.st',xv):null;
var scene=w3?$('.scene',w3):null,tlItems=tlw?$$('.it',tlw):[];
var vh=W.innerHeight,vw=W.innerWidth,sh=vh,mx=0,my=0,ticking=false,last={xe:-1,dp:[]};
var trkMax=[];
function sizeX(){vh=W.innerHeight;vw=W.innerWidth;
 if(xv){sh=xst.clientHeight||vh;var h0=Math.min(sh*.5,500),w0=h0*9/16;xv.style.setProperty('--w0',w0+'px');xv.style.setProperty('--h0',h0+'px');xv._h0=h0;xv._w0=w0;xc.classList.toggle('ct',vw/sh>.62);last.xe=-1}
 trkMax=dbs.map(function(t){return Math.max(0,t.scrollWidth-vw*.9)})}
function tick(){ticking=false;
 var y=W.pageYOffset||D.documentElement.scrollTop,H=D.documentElement.scrollHeight-vh;
 /* READ */
 var xr=xv?xv.getBoundingClientRect():null,
  wr=wordEls.map(function(el){return el.getBoundingClientRect()}),
  dr=dbs.map(function(t){return t.closest('.db').getBoundingClientRect()}),
  sr=w3?w3.getBoundingClientRect():null,
  tr=tlw?tlw.getBoundingClientRect():null,
  ir=tlItems.map(function(it){return it.getBoundingClientRect().top}),
  zz=0;
 /* WRITE */
 if(pgb)pgb.style.transform='scaleX('+(H>0?clamp(y/H,0,1):0)+')';
 if(!ENGINE)return;
 wordEls.forEach(function(el,i){var r=wr[i];if(r.bottom<-50||r.top>vh+50){if(r.top>vh+50&&el._k!==0)setWords(el,0);return}
  var p=clamp((vh*.86-r.top)/(vh*.86-vh*.38+r.height),0,1);setWords(el,Math.floor(p*el._w.length*1.04))});
 if(xv){var p=clamp(-xr.top/(xr.height-sh),0,1);var e=ease(clamp(p/.55,0,1));
  if(Math.abs(e-last.xe)>.002||p===1||p===0){last.xe=e;
   var w=lerp(xv._w0,vw,e),h=lerp(xv._h0,sh,e);xc.style.width=w+'px';xc.style.height=h+'px';xc.style.borderRadius=lerp(6,0,e)+'px';
   var f=1-clamp(e*1.7,0,1),gap=14,sw=xv._w0+gap;
   xs.forEach(function(s,i){var d=i<2?i-2:i-1;var dir=d<0?-1:1;var x=d*sw+dir*e*vw*.6;s.style.transform='translate3d('+x+'px,0,0)';s.style.opacity=f});
   if(xh){xh.style.opacity=1-clamp(e*2.6,0,1);xh.style.transform='translate3d(0,'+(-e*40)+'px,0)'}
   if(xo){var o=clamp((p-.5)/.2,0,1);xo.style.opacity=o;xo.classList.toggle('show',o>.5)}}}
 dbs.forEach(function(t,i){var r=dr[i];if(r.bottom<-100||r.top>vh+100)return;var p=clamp((vh-r.top)/(vh+r.height),0,1);var max=trkMax[i]||0;var dir=t.dataset.dir==='r'?-1:1;var x=dir>0?-max*p:-max*(1-p);t.style.transform='translate3d('+x.toFixed(1)+'px,0,0)'});
 if(scene&&sr.bottom>-100&&sr.top<vh+100){var p3=clamp((vh-sr.top)/(vh+sr.height),0,1);
  scene.style.setProperty('--ry',(lerp(-36,-6,ease(p3))+mx*7).toFixed(2)+'deg');scene.style.setProperty('--rx',(lerp(18,6,ease(p3))-my*5).toFixed(2)+'deg');scene.style.setProperty('--rz',lerp(5,1,p3).toFixed(2)+'deg')}
 if(tlw){tlItems.forEach(function(it,i){var on=ir[i]<vh*.66;if(it._on!==on){it._on=on;it.classList.toggle('on',on)}})}
}
function setWords(el,k){if(el._k===k)return;el._k=k;el._w.forEach(function(w,i){var on=i<k;if(w._o!==on){w._o=on;w.classList.toggle('on',on)}})}
function req(){if(!ENGINE)return;if(!ticking){ticking=true;requestAnimationFrame(tick)}}
if(ENGINE)W.addEventListener('scroll',req,{passive:true});
if(ENGINE)W.addEventListener('resize',function(){if(TOUCH&&Math.abs(W.innerWidth-vw)<2){vh=W.innerHeight;req();return}sizeX();req()});
if(scene&&!TOUCH){D.addEventListener('mousemove',function(e){mx=(e.clientX/vw-.5);my=(e.clientY/vh-.5);req()},{passive:true})}
if(ENGINE){sizeX();tick();W.addEventListener('load',function(){sizeX();tick()})}
/* touch: solo el video de "Lo que hacemos se ve" se reproduce al verse y se pausa al salir */
if(TOUCH&&'IntersectionObserver' in W){var xvv=$('.xv .xc video');if(xvv){var xio=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.intersectionRatio>=.4){if(!v._l){v._l=1;var s=D.createElement('source');s.src=v.dataset.src;s.type='video/mp4';var s2=D.createElement('source');s2.src=v.dataset.src.replace('.mp4','.webm');s2.type='video/webm';v.appendChild(s);v.appendChild(s2);v.load()}var p=v.play();if(p&&p.catch)p.catch(function(){})}else if(v._l)v.pause()})},{threshold:[0,.4,.7]});xio.observe(xvv)}}
/* hero: anillo 3D de videos */
(function(){var h2=$('.h2');if(!h2)return;var tc=$('.tc',h2),t0=Date.now();
 if(TOUCH)return;
 var hr=$('.hr',h2),ri=$('.hri',h2),cs=$$('.hrc',h2),STEP=15,DUR=64000,ticking=0;
 W.addEventListener('pointermove',function(e){if(ticking)return;ticking=1;requestAnimationFrame(function(){ticking=0;hr.style.setProperty('--px',((e.clientX/W.innerWidth)*2-1).toFixed(3))})},{passive:true});
 function ang(){var an=ri.getAnimations&&ri.getAnimations()[0],t=an?an.currentTime:performance.now();return -360*((t%DUR)/DUR)}
 function upd(){if(h2.classList.contains('off'))return;var a=ang();cs.forEach(function(c,i){var d=((i*STEP+a)%360+540)%360-180,v=c.querySelector('video');
  if(Math.abs(d)<=62){if(!v){v=D.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('muted','');v.preload='auto';var k=c.dataset.k;var s1=D.createElement('source');s1.src='/media/r-'+k+'.webm';s1.type='video/webm';var s2=D.createElement('source');s2.src='/media/r-'+k+'.mp4';s2.type='video/mp4';v.appendChild(s2);v.appendChild(s1);v.insertBefore(s1,s2);c.insertBefore(v,c.querySelector('.hrl'));v.addEventListener('playing',function(){v.classList.add('on')})}
   if(v.paused){var p=v.play();if(p&&p.catch)p.catch(function(){})}}
  else if(v&&!v.paused){v.pause()}})}
 W.addEventListener('load',function(){setTimeout(function(){upd();setInterval(upd,500)},900)})})();
/* header oscuro sobre secciones oscuras, sin handler de scroll */
if(hd&&'IntersectionObserver' in W){var dkS=[];var dio=new IntersectionObserver(function(es){es.forEach(function(e){var i=dkS.indexOf(e.target);if(e.isIntersecting&&i<0)dkS.push(e.target);if(!e.isIntersecting&&i>=0)dkS.splice(i,1)});hd.classList.toggle('dk',dkS.length>0)},{rootMargin:'-5% 0px -94% 0px',threshold:0});darks.forEach(function(s){dio.observe(s)})}
/* lightbox */
function fmt(t){t=Math.max(0,Math.floor(t||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
function openLb(c){
 var el=D.createElement('div');el.className='lb';
 el.innerHTML='<div class="lbt"><b>'+c.dataset.t+'</b><button aria-label="Cerrar">&times;</button></div><div class="lbs"><div class="lbx"><video playsinline poster="'+c.dataset.p+'"></video><button class="bp" aria-label="Reproducir"></button><div class="ctl"><button data-c="t" aria-label="Pausa">II</button><input type="range" min="0" max="1000" value="0"><span class="tm">0:00</span><button data-c="m" aria-label="Sonido">&#9835;</button><button data-c="f" aria-label="Pantalla completa">&#9974;</button></div></div></div>';
 D.body.appendChild(el);D.body.style.overflow='hidden';
 var x=$('.lbx',el),v=$('video',el),r=$('input',el),tm=$('.tm',el),tg=$('[data-c=t]',el);
 v.src=c.dataset.s;v.autoplay=true;
 function sy(){x.classList.toggle('ps',v.paused);tg.textContent=v.paused?'▶':'II'}
 v.addEventListener('play',sy);v.addEventListener('pause',sy);
 v.addEventListener('timeupdate',function(){if(v.duration&&!r.dataset.d){r.value=Math.round(v.currentTime/v.duration*1000);r.style.setProperty('--p',v.currentTime/v.duration*100+'%')}tm.textContent=fmt(v.currentTime)+' / '+fmt(v.duration)});
 r.oninput=function(){r.dataset.d=1;if(v.duration)v.currentTime=r.value/1000*v.duration;r.style.setProperty('--p',r.value/10+'%')};r.onchange=function(){delete r.dataset.d};
 v.onclick=function(){v.paused?v.play():v.pause()};
 $('.bp',el).onclick=function(){v.play()};
 $('.ctl',el).onclick=function(e){var b=e.target.closest('[data-c]');if(!b)return;var k=b.dataset.c;if(k==='t')v.paused?v.play():v.pause();if(k==='m'){v.muted=!v.muted;b.style.opacity=v.muted?.4:1}if(k==='f'){if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();else if(x.requestFullscreen)x.requestFullscreen()}};
 function close(){v.pause();el.remove();D.body.style.overflow='';W.removeEventListener('keydown',kd)}
 function kd(e){if(e.key==='Escape')close()}W.addEventListener('keydown',kd);
 $('.lbt button',el).onclick=close;
 var p=v.play();if(p&&p.catch)p.catch(sy);sy();
}
D.addEventListener('click',function(e){var c=e.target.closest('.vc[data-s],.xc[data-s]');if(c){e.preventDefault();openLb(c)}});
})();
