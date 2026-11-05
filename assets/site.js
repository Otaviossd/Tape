(function(){
var hd=document.querySelector('.hd');
function sc(){hd&&hd.classList.toggle('sc',window.scrollY>8)}sc();addEventListener('scroll',sc,{passive:true});
var mt=document.querySelector('.mt'),mm=document.querySelector('.mm');
if(mt)mt.onclick=function(){var o=mm.classList.toggle('open');document.body.style.overflow=o?'hidden':''};
if(mm)mm.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){mm.classList.remove('open');document.body.style.overflow=''})});
/* reveal */
var els=[].slice.call(document.querySelectorAll('.rv'));
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12,rootMargin:'0px 0px -40px 0px'});els.forEach(function(el,i){el.style.transitionDelay=(i%4)*70+'ms';io.observe(el)})}else els.forEach(function(el){el.classList.add('in')});
/* tabs */
var tb=document.querySelectorAll('.tabs button');
function show(id,push){var ok=false;document.querySelectorAll('.pane').forEach(function(p){var on=p.id===id;p.classList.toggle('on',on);if(on)ok=true});if(!ok)return;tb.forEach(function(b){b.classList.toggle('on',b.dataset.t===id)});if(push)history.replaceState(null,'','#'+id)}
if(tb.length){tb.forEach(function(b){b.onclick=function(){show(b.dataset.t,true);var t=document.querySelector('.pane.on');if(t){var y=t.getBoundingClientRect().top+scrollY-130;if(y<scrollY)scrollTo({top:Math.max(0,y),behavior:'smooth'})}}});var h=location.hash.slice(1);show(document.getElementById(h)&&document.getElementById(h).classList.contains('pane')?h:tb[0].dataset.t)}
/* whatsapp */
var WA='https://wa.me/595992149352?text=';
document.querySelectorAll('[data-wa]').forEach(function(a){a.href=WA+encodeURIComponent(a.dataset.wa);a.target='_blank';a.rel='noopener'});
var fm=document.getElementById('waForm');
if(fm)fm.addEventListener('submit',function(e){e.preventDefault();var n=fm.n.value.trim(),i=fm.i.value,m=fm.m.value.trim();var t='Hola, soy '+n+'. Me interesa: '+i+'.'+(m?' '+m:'');window.open(WA+encodeURIComponent(t),'_blank','noopener')});
/* lightbox */
function fmt(t){t=Math.max(0,Math.floor(t||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
document.querySelectorAll('.vc').forEach(function(c){c.onclick=function(){
 var el=document.createElement('div');el.className='lb';
 el.innerHTML='<div class="lbt"><b>'+c.dataset.t+'</b><button aria-label="Cerrar">&times;</button></div><div class="lbs"><div class="lbx"><video playsinline poster="'+c.dataset.p+'"></video><button class="bp" aria-label="Reproducir"></button><div class="ctl"><button data-c="t" aria-label="Pausa">II</button><input type="range" min="0" max="1000" value="0"><span class="tm">0:00</span><button data-c="m" aria-label="Sonido">&#9835;</button><button data-c="f" aria-label="Pantalla completa">&#9974;</button></div></div></div>';
 document.body.appendChild(el);document.body.style.overflow='hidden';
 var x=el.querySelector('.lbx'),v=el.querySelector('video'),r=el.querySelector('input'),tm=el.querySelector('.tm'),tg=el.querySelector('[data-c=t]');
 v.src=c.dataset.s;v.autoplay=true;
 function sy(){x.classList.toggle('ps',v.paused);tg.textContent=v.paused?'▶':'II'}
 v.addEventListener('play',sy);v.addEventListener('pause',sy);
 v.addEventListener('timeupdate',function(){if(v.duration&&!r.dataset.d){r.value=Math.round(v.currentTime/v.duration*1000);r.style.setProperty('--p',v.currentTime/v.duration*100+'%')}tm.textContent=fmt(v.currentTime)+' / '+fmt(v.duration)});
 r.oninput=function(){r.dataset.d=1;if(v.duration)v.currentTime=r.value/1000*v.duration;r.style.setProperty('--p',r.value/10+'%')};r.onchange=function(){delete r.dataset.d};
 v.onclick=function(){v.paused?v.play():v.pause()};
 el.querySelector('.bp').onclick=function(){v.play()};
 el.querySelector('.ctl').onclick=function(e){var b=e.target.closest('[data-c]');if(!b)return;var k=b.dataset.c;if(k==='t')v.paused?v.play():v.pause();if(k==='m'){v.muted=!v.muted;b.style.opacity=v.muted?.4:1}if(k==='f'){if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();else if(x.requestFullscreen)x.requestFullscreen()}};
 function close(){v.pause();el.remove();document.body.style.overflow='';removeEventListener('keydown',kd)}
 function kd(e){if(e.key==='Escape')close()}addEventListener('keydown',kd);
 el.querySelector('.lbt button').onclick=close;
 var p=v.play();if(p&&p.catch)p.catch(sy);sy();
}});
})();
