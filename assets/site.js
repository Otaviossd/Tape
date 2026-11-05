(function(){
var D=document,W=window,RM=W.matchMedia&&W.matchMedia('(prefers-reduced-motion:reduce)').matches;
function $(s,r){return (r||D).querySelector(s)}function $$(s,r){return [].slice.call((r||D).querySelectorAll(s))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}function lerp(a,b,t){return a+(b-a)*t}function ease(t){return 1-Math.pow(1-t,3)}
/* header, menu */
var hd=$('.hd'),mt=$('.mt'),mm=$('.mm');
if(mt&&mm){mt.onclick=function(){var o=mm.classList.toggle('open');mt.classList.toggle('x',o);D.body.style.overflow=o?'hidden':'';tick()};
 $$('a',mm).forEach(function(a){a.addEventListener('click',function(){mm.classList.remove('open');mt.classList.remove('x');D.body.style.overflow=''})})}
/* whatsapp links */
var WA='https://wa.me/595992149352?text=';
$$('[data-wa]').forEach(function(a){a.href=WA+encodeURIComponent(a.dataset.wa);a.target='_blank';a.rel='noopener'});
/* reveal */
var rv=$$('.rv');
if('IntersectionObserver' in W&&!RM){var io=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.1,rootMargin:'0px 0px -6% 0px'});
 rv.forEach(function(el){var sib=el.parentNode?[].indexOf.call(el.parentNode.children,el):0;el.style.transitionDelay=Math.min(sib%4,3)*80+'ms';io.observe(el)})}
else rv.forEach(function(el){el.classList.add('in')});
/* word reveal */
var wordEls=$$('[data-words]');
wordEls.forEach(function(el){var n=0;
 function walk(node){[].slice.call(node.childNodes).forEach(function(c){
  if(c.nodeType===3){var f=D.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(function(t){if(!t)return;if(/^\s+$/.test(t)){f.appendChild(D.createTextNode(' '))}else{var s=D.createElement('span');s.className='w';s.textContent=t;f.appendChild(s);n++}});node.replaceChild(f,c)}
  else if(c.nodeType===1)walk(c)})}
 walk(el);el._w=$$('.w',el)});
/* tabs */
var tb=$$('.tabs button');
function show(id,push){var ok=false;$$('.pane').forEach(function(p){var on=p.id===id;p.classList.toggle('on',on);if(on)ok=true});if(!ok)return;tb.forEach(function(b){b.classList.toggle('on',b.dataset.t===id)});if(push)history.replaceState(null,'','#'+id)}
if(tb.length){tb.forEach(function(b){b.onclick=function(){show(b.dataset.t,true);var t=$('.pane.on');if(t){var y=t.getBoundingClientRect().top+W.scrollY-150;if(y<W.scrollY)W.scrollTo({top:Math.max(0,y),behavior:'smooth'})}}});
 var h=location.hash.slice(1),he=h&&D.getElementById(h);show(he&&he.classList.contains('pane')?h:tb[0].dataset.t);
 W.addEventListener('hashchange',function(){var h=location.hash.slice(1),he=h&&D.getElementById(h);if(he&&he.classList.contains('pane'))show(h)})}
/* hero lazy videos */
function lazyVideos(){$$('video[data-src]').forEach(function(v){if(v._l)return;v._l=1;var s=D.createElement('source');s.src=v.dataset.src;s.type='video/mp4';var s2=D.createElement('source');s2.src=v.dataset.src.replace('.mp4','.webm');s2.type='video/webm';v.appendChild(s);v.appendChild(s2);v.load();var p=v.play();if(p&&p.catch)p.catch(function(){})})}
if(D.readyState==='complete')setTimeout(lazyVideos,300);else W.addEventListener('load',function(){setTimeout(lazyVideos,300)});
/* scroll engine */
var pgb=$('.pgb'),xv=$('.xv'),dbs=$$('.db .trk'),w3=$('.w3 .stage'),tlw=$('.tlw'),pars=$$('[data-par]'),tilts=$$('[data-tilt]');
var vh=W.innerHeight,vw=W.innerWidth,mx=0,my=0,ticking=false;
function sizeX(){vh=W.innerHeight;vw=W.innerWidth;if(xv){var h0=Math.min(vh*.52,520),w0=h0*9/16;xv.style.setProperty('--w0',w0+'px');xv.style.setProperty('--h0',h0+'px');xv._h0=h0;xv._w0=w0;var c=$('.xc',xv);if(c)c.classList.toggle('ct',vw/vh>.62)}}
function tick(){ticking=false;var y=W.scrollY||D.documentElement.scrollTop,H=D.documentElement.scrollHeight-vh;
 if(pgb)pgb.style.transform='scaleX('+(H>0?clamp(y/H,0,1):0)+')';
 if(hd){var dk=false;if(!(mm&&mm.classList.contains('open'))){$$('.hero,.xv,.db,.lz,.fin,.sec.dk,.ft').forEach(function(s){var r=s.getBoundingClientRect();if(r.top<=40&&r.bottom>=40)dk=true})}hd.classList.toggle('dk',dk)}
 if(RM)return;
 wordEls.forEach(function(el){var r=el.getBoundingClientRect();var p=clamp((vh*.86-r.top)/(vh*.86-vh*.38+r.height),0,1);var n=el._w.length,k=Math.floor(p*n*1.04);el._w.forEach(function(w,i){var on=i<k;if(w._o!==on){w._o=on;w.classList.toggle('on',on)}})});
 if(xv){var r=xv.getBoundingClientRect();var p=clamp(-r.top/(r.height-vh),0,1);var e=ease(clamp(p/.62,0,1));
  var c=$('.xc',xv),w0=xv._w0,h0=xv._h0;c.style.width=lerp(w0,vw,e)+'px';c.style.height=lerp(h0,vh,e)+'px';c.style.borderRadius=lerp(6,0,e)+'px';
  var f=1-clamp(e*1.7,0,1);$$('.xs',xv).forEach(function(s){s.style.opacity=f});
  var xh=$('.xh',xv);if(xh){xh.style.opacity=1-clamp(e*2.6,0,1);xh.style.transform='translateY('+(-e*40)+'px)'}
  var xo=$('.xo',xv);if(xo){var o=clamp((p-.58)/.2,0,1);xo.style.opacity=o;xo.classList.toggle('show',o>.5)}}
 dbs.forEach(function(t){var sec=t.closest('.db'),r=sec.getBoundingClientRect();var p=clamp((vh-r.top)/(vh+r.height),0,1);var max=Math.max(0,t.scrollWidth-vw*.9);var dir=t.dataset.dir==='r'?-1:1;var x=dir>0?-max*p:-max*(1-p);t.style.transform='translate3d('+x+'px,0,0)'});
 if(w3){var r=w3.getBoundingClientRect();var p=clamp((vh-r.top)/(vh+r.height),0,1);var s=$('.scene',w3);
  s.style.setProperty('--ry',(lerp(-36,-6,ease(p))+mx*7)+'deg');s.style.setProperty('--rx',(lerp(18,6,ease(p))-my*5)+'deg');s.style.setProperty('--rz',lerp(5,1,p)+'deg')}
 if(tlw){var r=tlw.getBoundingClientRect();var p=clamp((vh*.62-r.top)/r.height,0,1);$('.fl',tlw).style.transform='scaleY('+p+')';$$('.it',tlw).forEach(function(it){var ir=it.getBoundingClientRect();it.classList.toggle('on',ir.top<vh*.64)})}
 pars.forEach(function(el){var r=el.getBoundingClientRect();var k=parseFloat(el.dataset.par)||.1;el.style.transform='translate3d(0,'+((r.top+r.height/2-vh/2)*-k)+'px,0)'})}
function req(){if(!ticking){ticking=true;requestAnimationFrame(tick)}}
W.addEventListener('scroll',req,{passive:true});W.addEventListener('resize',function(){sizeX();req()});
if(w3&&matchMedia('(hover:hover)').matches){D.addEventListener('mousemove',function(e){mx=(e.clientX/vw-.5);my=(e.clientY/vh-.5);req()})}
tilts.forEach(function(el){if(!matchMedia('(hover:hover)').matches)return;el.addEventListener('mousemove',function(e){var r=el.getBoundingClientRect();var x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform='perspective(1200px) rotateY('+(x*10)+'deg) rotateX('+(-y*8)+'deg)'});el.addEventListener('mouseleave',function(){el.style.transform=''})});
sizeX();tick();W.addEventListener('load',function(){sizeX();tick()});
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
D.addEventListener('click',function(e){var c=e.target.closest('.vc[data-s]');if(c){e.preventDefault();openLb(c)}});
})();
