(function(){
'use strict';
/* ============================== УТИЛИТЫ ============================== */
var $=function(id){return document.getElementById(id);};
var uid=function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);};
var pad=function(n){return String(n).padStart(2,'0');};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
var LS='perekur.plus.v3';
var BASE_TITLE='Перекур+ — перерывы, обед и разминка';
var DAYS_SHORT=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
var DAYS_ORDER=[1,2,3,4,5,6,0];
var WORKDAYS=[1,2,3,4,5];
var EMOJIS=['☕','🍱','🤸','','👀','🚶','','🧘'];
var COLORS=['#ffb054','#ff6a5c','#a3e635','#38d6f5','#c084fc','#f472b6','#6aa5ff','#4ade80'];

function parseHM(v,fb){var m=/^(\d{1,2}):(\d{2})$/.exec(String(v||'').trim());if(!m)return fb;var h=+m[1],mi=+m[2];if(h>23||mi>59)return fb;return h*60+mi;}
function atMin(day,mins){return new Date(day.getFullYear(),day.getMonth(),day.getDate(),0,mins,0,0);}
function fmtHM(ts){var d=new Date(ts);return pad(d.getHours())+':'+pad(d.getMinutes());}
function fmtClock(ms){var s=Math.max(0,Math.floor(ms/1000));var h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return h>0?h+':'+pad(m)+':'+pad(ss):pad(m)+':'+pad(ss);}
function fmtDur(ms){var min=Math.floor(ms/60000);if(min<1)return'меньше минуты';if(min<60)return min+' мин';var h=Math.floor(min/60);if(h<24)return h+' ч '+(min%60)+' мин';return Math.floor(h/24)+' дн '+(h%24)+' ч';}
function dayLabel(ts,now){var a=new Date(now.getFullYear(),now.getMonth(),now.getDate());var b=new Date(ts);b=new Date(b.getFullYear(),b.getMonth(),b.getDate());var diff=Math.round((b-a)/86400000);if(diff===0)return'сегодня';if(diff===1)return'завтра';return new Date(ts).toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'});}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

/* ============================== РАСПИСАНИЕ ============================== */
function computeBase(r,from){
  if(!r.enabled||!Array.isArray(r.days)||!r.days.length)return null;
  var base=new Date(from.getFullYear(),from.getMonth(),from.getDate());
  var off,day,cand;
  if(r.mode==='daily'){
    var t=parseHM(r.dailyTime,780);
    for(off=0;off<14;off++){day=new Date(base.getFullYear(),base.getMonth(),base.getDate()+off);
      if(r.days.indexOf(day.getDay())<0)continue;
      cand=atMin(day,t);if(cand.getTime()>from.getTime())return cand.getTime();}
    return null;
  }
  var rs=parseHM(r.rangeStart,540),re=parseHM(r.rangeEnd,1080);
  if(re<=rs)return null;
  if(r.mode==='hourly'){
    var minute=clamp(Math.round(r.hourlyMinute),0,59);
    for(off=0;off<14;off++){day=new Date(base.getFullYear(),base.getMonth(),base.getDate()+off);
      if(r.days.indexOf(day.getDay())<0)continue;
      for(var h=0;h<24;h++){var cm=h*60+minute;if(cm<rs)continue;if(cm>=re)break;
        cand=atMin(day,cm);if(cand.getTime()>from.getTime())return cand.getTime();}}
    return null;
  }
  var iv=clamp(Math.round(r.intervalMinutes),1,480);
  for(off=0;off<14;off++){day=new Date(base.getFullYear(),base.getMonth(),base.getDate()+off);
    if(r.days.indexOf(day.getDay())<0)continue;
    var start=atMin(day,rs),end=atMin(day,re);cand=start;
    if(cand.getTime()<=from.getTime()){var k=Math.floor((from.getTime()-start.getTime())/60000/iv)+1;cand=new Date(day.getFullYear(),day.getMonth(),day.getDate(),0,rs+k*iv,0,0);}
    if(cand.getTime()<end.getTime())return cand.getTime();}
  return null;
}
function nextFor(r,from,ignoreSnooze){
  if(!r.enabled)return null;
  if(!ignoreSnooze&&r.snoozeUntil&&r.snoozeUntil>from.getTime())return r.snoozeUntil;
  return computeBase(r,from);
}
function modeSummary(r){
  var days=r.days.length===7?'каждый день':(r.days.length===5&&WORKDAYS.every(function(d){return r.days.indexOf(d)>=0;})?'Пн–Пт':DAYS_ORDER.filter(function(d){return r.days.indexOf(d)>=0;}).map(function(d){return DAYS_SHORT[d];}).join(', '));
  if(r.mode==='daily')return'ежедневно в '+r.dailyTime+' · '+days;
  if(r.mode==='hourly')return'каждый час в :'+pad(r.hourlyMinute)+' · '+r.rangeStart+'–'+r.rangeEnd+' · '+days;
  return'каждые '+r.intervalMinutes+' мин · '+r.rangeStart+'–'+r.rangeEnd+' · '+days;
}

/* ============================== СОСТОЯНИЕ ============================== */
function mk(id,name,emoji,color,over){
  var r={id:id,name:name,emoji:emoji,color:color,enabled:true,mode:'interval',intervalMinutes:60,hourlyMinute:55,dailyTime:'13:00',rangeStart:'09:00',rangeEnd:'18:00',days:WORKDAYS.slice(),sound:'ding',text:'Пора сделать перерыв!',snoozeUntil:0,preset:null};
  if(over)for(var k in over)r[k]=over[k];
  return r;
}
function seed(){return{
  v:3,
  settings:{soundOn:true,volume:0.8,keepAwake:true,wakeLock:true,catchUp:true,paused:false},
  reminders:[
    mk('r-smoke','Перекур','☕','#ffb054',{mode:'hourly',hourlyMinute:55,sound:'chimes',text:'Пора сделать перекур! Оторвитесь от экрана на пару минут.',preset:'smoke'}),
    mk('r-lunch','Обед','🍱','#ff6a5c',{mode:'daily',dailyTime:'13:00',sound:'marimba',text:'Время обеда! Поешьте спокойно, без экрана.',preset:'lunch'}),
    mk('r-warmup','Разминка','🤸','#a3e635',{mode:'interval',intervalMinutes:45,sound:'pulse',text:'Встаньте и разомнитесь 2–3 минуты: шея, плечи, спина.',preset:'warmup'}),
    mk('r-water','Вода','💧','#38d6f5',{mode:'interval',intervalMinutes:30,enabled:false,sound:'ding',text:'Выпейте стакан воды — организм скажет спасибо.',preset:'water'}),
    mk('r-eyes','Глаза','👀','#c084fc',{mode:'interval',intervalMinutes:20,enabled:false,sound:'calm',text:'Правило 20-20-20: посмотрите вдаль на 20 секунд.',preset:'eyes'})
  ],
  history:[]
};}
function normalizeReminder(x){
  var r=mk(x.id||uid(),String(x.name||'Перерыв').slice(0,40),x.emoji||'☕',x.color||COLORS[0],x);
  r.enabled=!!r.enabled;
  r.mode=['interval','hourly','daily'].indexOf(r.mode)>=0?r.mode:'interval';
  r.intervalMinutes=clamp(Math.round(+r.intervalMinutes)||60,1,480);
  r.hourlyMinute=clamp(Math.round(+r.hourlyMinute)||0,0,59);
  r.days=Array.isArray(r.days)?r.days.filter(function(d){return d>=0&&d<=6;}):WORKDAYS.slice();
  r.snoozeUntil=+r.snoozeUntil||0;
  if(!SOUNDS[r.sound])r.sound='ding';
  return r;
}
function load(){
  try{
    var raw=localStorage.getItem(LS);if(!raw)return seed();
    var p=JSON.parse(raw);if(!p||!Array.isArray(p.reminders))return seed();
    var s=seed();
    p.settings=Object.assign(s.settings,p.settings||{});
    p.settings.volume=clamp(+p.settings.volume||0.8,0,1);
    p.reminders=p.reminders.map(normalizeReminder);
    p.history=Array.isArray(p.history)?p.history.slice(0,60):[];
    return p;
  }catch(e){return seed();}
}
var state=load();
var nextMap={};
var persistTimer=null;
function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(function(){persistNow();},80);}
function persistNow(){try{localStorage.setItem(LS,JSON.stringify(state));}catch(e){}}

/* ============================== ЗВУК ============================== */
var audioCtx=null,keepOsc=null,keepGain=null,keepEl=null,audioUnlocked=false;
function ensureAudio(){
  if(!audioCtx){var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioCtx=new AC();}
  if(audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
  return audioCtx;
}
function tone(ctx,out,t,freq,dur,type,vol,glide){
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type||'sine';o.frequency.setValueAtTime(freq,t);
  if(glide)o.frequency.exponentialRampToValueAtTime(glide,t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+0.015);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(out);o.start(t);o.stop(t+dur+0.05);
}
function knock(ctx,out,t){
  var len=Math.floor(ctx.sampleRate*0.09),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
  for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  var src=ctx.createBufferSource();src.buffer=buf;
  var f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=420;
  var g=ctx.createGain();g.gain.value=0.9;
  src.connect(f);f.connect(g);g.connect(out);src.start(t);
}
var SOUNDS={
  chimes:{label:'Колокольчики',fn:function(c,o,t){[880,660,523].forEach(function(f,i){tone(c,o,t+i*0.18,f,0.9,'sine',0.5);});}},
  bell:{label:'Колокол',fn:function(c,o,t){tone(c,o,t,660,2.0,'sine',0.55);tone(c,o,t,1320,1.2,'sine',0.22);tone(c,o,t,1980,0.7,'sine',0.1);}},
  ding:{label:'Динь',fn:function(c,o,t){tone(c,o,t,1245,0.7,'sine',0.5);tone(c,o,t,2490,0.3,'sine',0.14);}},
  marimba:{label:'Маримба',fn:function(c,o,t){[523,659,784,1047].forEach(function(f,i){tone(c,o,t+i*0.12,f,0.3,'triangle',0.5);});}},
  pulse:{label:'Пульс',fn:function(c,o,t){tone(c,o,t,440,0.12,'square',0.22);tone(c,o,t+0.2,440,0.12,'square',0.22);tone(c,o,t+0.4,660,0.16,'square',0.22);}},
  sweep:{label:'Взлёт',fn:function(c,o,t){tone(c,o,t,300,0.55,'sine',0.4,950);}},
  knock:{label:'Тук-тук',fn:function(c,o,t){knock(c,o,t);knock(c,o,t+0.18);knock(c,o,t+0.36);}},
  calm:{label:'Спокойный',fn:function(c,o,t){tone(c,o,t,392,1.4,'sine',0.35);tone(c,o,t+0.25,523,1.4,'sine',0.3);}},
  soft:{label:'Мягкий аккорд',fn:function(c,o,t){[440,554,659].forEach(function(f,i){tone(c,o,t+i*.1,f,1.1,'sine',.3);});}},
  double:{label:'Двойной сигнал',fn:function(c,o,t){tone(c,o,t,880,.22,'triangle',.45);tone(c,o,t+.32,1175,.35,'triangle',.45);}},
  water:{label:'Капли',fn:function(c,o,t){[1046,1318,1568].forEach(function(f,i){tone(c,o,t+i*.24,f,.18,'sine',.35);});}},
  birds:{label:'Высокие ноты',fn:function(c,o,t){[1500,1800,1400,2000].forEach(function(f,i){tone(c,o,t+i*.14,f,.22,'sine',.2);});}},
  low:{label:'Низкий мягкий',fn:function(c,o,t){tone(c,o,t,220,.5,'sine',.45);tone(c,o,t+.2,330,.6,'sine',.3);}}
};
function playSound(id){
  if(!state.settings.soundOn)return;
  var ctx=ensureAudio();if(!ctx)return;
  var master=ctx.createGain();master.gain.value=state.settings.volume;master.connect(ctx.destination);
  (SOUNDS[id]||SOUNDS.ding).fn(ctx,master,ctx.currentTime+0.02);
}
/* почти неслышный поток — вкладка считается «звучащей», браузер её не замораживает */
function startKeepAlive(){
  if(!state.settings.keepAwake||keepOsc)return;
  var ctx=ensureAudio();if(!ctx||ctx.state!=='running')return;
  try{
    keepOsc=ctx.createOscillator();keepOsc.type='sine';keepOsc.frequency.value=40;
    keepGain=ctx.createGain();keepGain.gain.value=0.01;
    keepOsc.connect(keepGain);keepGain.connect(ctx.destination);
    if(ctx.createMediaStreamDestination){
      var dest=ctx.createMediaStreamDestination();keepGain.connect(dest);
      keepEl=new Audio();keepEl.srcObject=dest.stream;keepEl.loop=true;
      keepEl.play().catch(function(){});
    }
    keepOsc.start();
  }catch(e){keepOsc=null;}
  updateChips();
}
function stopKeepAlive(){
  try{if(keepOsc){keepOsc.stop();keepOsc.disconnect();}}catch(e){}
  try{if(keepGain)keepGain.disconnect();}catch(e){}
  if(keepEl){try{keepEl.pause();keepEl.srcObject=null;}catch(e){}keepEl=null;}
  keepOsc=null;keepGain=null;updateChips();
}
function unlockAudio(){
  var ctx=ensureAudio();
  if(ctx&&ctx.state==='running'){audioUnlocked=true;startKeepAlive();}
  updateChips();
}
document.addEventListener('pointerdown',unlockAudio);
document.addEventListener('keydown',unlockAudio);

/* ============================== WAKE LOCK ============================== */
var wakeSentinel=null;
function requestWake(){
  if(!state.settings.wakeLock||!('wakeLock' in navigator)||document.visibilityState!=='visible'){updateChips();return;}
  if(wakeSentinel)return;
  navigator.wakeLock.request('screen').then(function(s){
    wakeSentinel=s;
    s.addEventListener('release',function(){wakeSentinel=null;updateChips();});
    updateChips();
  }).catch(function(){updateChips();});
}
function releaseWake(){if(wakeSentinel){try{wakeSentinel.release();}catch(e){}wakeSentinel=null;}updateChips();}

/* ============================== УВЕДОМЛЕНИЯ ============================== */
var swReg=null;
function makeIcon(size){
  var c=document.createElement('canvas');c.width=c.height=size;var x=c.getContext('2d');
  x.fillStyle='#241b15';var r=size*0.22;
  x.beginPath();x.moveTo(r,0);x.arcTo(size,0,size,size,r);x.arcTo(size,size,0,size,r);x.arcTo(0,size,0,0,r);x.arcTo(0,0,size,0,r);x.fill();
  x.font=Math.floor(size*0.62)+'px serif';x.textAlign='center';x.textBaseline='middle';x.fillText('☕',size/2,size*0.56);
  return c.toDataURL('image/png');
}
var ICON=makeIcon(192);
function notifPermission(){return('Notification' in window)?Notification.permission:'unsupported';}
function showNotif(title,body,tag){
  if(notifPermission()!=='granted')return;
  var opts={body:body,icon:ICON,badge:ICON,tag:tag||'perekur-plus',renotify:true,requireInteraction:false,silent:false};
  try{
    if(swReg&&swReg.showNotification){swReg.showNotification(title,opts).catch(function(){try{new Notification(title,opts);}catch(e){}});}
    else new Notification(title,opts);
  }catch(e){}
}
function updateNotifButtons(){
  var p=notifPermission();
  var b=$('btnNotif');
  if(p==='granted'){b.textContent='🔔';b.classList.add('on');b.classList.remove('warn');b.title='Уведомления разрешены';$('btnNotifPerm').textContent='✓ Уведомления разрешены';}
  else if(p==='denied'){b.textContent='🔕';b.classList.add('warn');b.classList.remove('on');b.title='Уведомления заблокированы в настройках браузера';$('btnNotifPerm').textContent='🔕 Заблокировано — как включить?';}
  else{b.textContent='🔔';b.classList.remove('on','warn');b.title='Разрешить уведомления';$('btnNotifPerm').textContent='Разрешить уведомления';}
  updateChips();
}
function askNotif(){
  var p=notifPermission();
  if(p==='unsupported'){toast('Системные уведомления недоступны в этом браузере','err');return;}
  if(!window.isSecureContext){toast('Для Windows-уведомлений откройте страницу через HTTPS или localhost (file:// не поддерживает полноценные уведомления)','err');}
  if(p==='granted'){showNotif('Перекур+','Уведомления работают отлично ✅','perm-test');toast('Уведомления уже разрешены','ok');return;}
  if(p==='denied'){toast('Откройте настройки сайта (замок в адресной строке) → Уведомления → Разрешить','err');return;}
  Notification.requestPermission().then(function(){updateNotifButtons();if(Notification.permission==='granted'){showNotif('Перекур+','Уведомления включены! Сигналы будут приходить сюда.','perm');toast('Уведомления разрешены','ok');}});
}

/* ============================== FAVICON / ЗАГОЛОВОК ============================== */
var favBase=makeIcon(64),flashTimer=null,flashOn=false;
function favBadge(on){
  var link=$('favicon');
  if(!on){link.href=favBase;return;}
  var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d');
  var img=new Image();img.onload=function(){x.drawImage(img,0,0);x.fillStyle='#ff5d5d';x.beginPath();x.arc(48,16,13,0,7);x.fill();x.fillStyle='#fff';x.font='bold 17px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('!',48,17);link.href=c.toDataURL();};img.src=favBase;
}
function startFlash(name){
  stopFlash();flashOn=true;
  flashTimer=setInterval(function(){flashOn=!flashOn;document.title=flashOn?('🔔 '+name+' — Перекур+'):BASE_TITLE;},800);
  document.title='🔔 '+name+' — Перекур+';favBadge(true);
}
function stopFlash(){if(flashTimer){clearInterval(flashTimer);flashTimer=null;}document.title=BASE_TITLE;favBadge(false);}

/* ============================== ЖУРНАЛ / ТОСТЫ ============================== */
var STATUS={fired:['Сигнал','fired'],done:['Выполнено','done'],snoozed:['Отложено +5','snoozed'],missed:['Пропущен','missed'],skipped:['Тихо пропущен','skipped']};
function pushHistory(e){state.history.unshift(e);if(state.history.length>60)state.history.length=60;persist();renderHistory();}
function renderHistory(){
  var el=$('historyList');
  if(!state.history.length){el.innerHTML='<div class="empty">Пока пусто — здесь появятся сработавшие сигналы</div>';return;}
  el.innerHTML=state.history.slice(0,30).map(function(h){
    var st=STATUS[h.status]||STATUS.fired;
    var late=h.lateMs>90000?' <span style="color:var(--dim);font-size:11px">(+'+fmtDur(h.lateMs)+')</span>':'';
    return'<div class="hist-row"><span class="h-time">'+new Date(h.at).toLocaleTimeString('ru-RU')+'</span><span>'+esc(h.emoji)+'</span><span class="h-name">'+esc(h.name)+late+'</span><span class="h-status '+st[1]+'">'+st[0]+'</span></div>';
  }).join('');
}
function toast(msg,type,undoFn){
  var box=$('toasts'),t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.innerHTML='<span class="t-msg">'+esc(msg)+'</span>'+(undoFn?'<button>Отменить</button>':'');
  if(undoFn)t.querySelector('button').onclick=function(){undoFn();kill();};
  box.appendChild(t);
  var tm=setTimeout(kill,undoFn?7000:4200);
  function kill(){clearTimeout(tm);t.classList.add('out');setTimeout(function(){t.remove();},300);}
}

/* ============================== СИГНАЛЫ ============================== */
var alertQueue=[],currentAlert=null;
function fire(r,lateMs){
  var entry={id:uid(),rid:r.id,name:r.name,emoji:r.emoji,color:r.color,at:Date.now(),status:lateMs>90000?'missed':'fired',lateMs:lateMs};
  pushHistory(entry);
  alertQueue.push({r:r,entryId:entry.id,lateMs:lateMs});
  playSound(r.sound);
  speakReminder(r);
  var lateNote=lateMs>90000?' (сигнал опоздал на '+fmtDur(lateMs)+' — вкладка спала)':'';
  showNotif(r.emoji+' '+r.name,r.text+lateNote,'perekur-'+r.id);
  if(!currentAlert)showNextAlert();
  if(document.visibilityState==='hidden'||alertQueue.length)startFlash(r.name);
}
function showNextAlert(){
  var item=alertQueue.shift();
  if(!item){currentAlert=null;$('alertOverlay').hidden=true;stopFlash();return;}
  currentAlert=item;
  var r=item.r;
  $('alertCard').style.setProperty('--ac',r.color);
  $('alEmoji').textContent=r.emoji;
  $('alName').textContent=r.name+'!';
  $('alText').textContent=r.text;
  var late=$('alLate');
  if(item.lateMs>90000){late.hidden=false;late.textContent='⚠ Опоздал на '+fmtDur(item.lateMs)+' — вкладка спала';}
  else late.hidden=true;
  $('alertOverlay').hidden=false;
  startFlash(r.name);
}
function resolveAlert(status){
  if(!currentAlert)return;
  var item=currentAlert;
  var h=state.history.find(function(x){return x.id===item.entryId;});
  if(h&&status!=='hide'){h.status=status;persist();renderHistory();}
  if(status==='snoozed'){
    var r=state.reminders.find(function(x){return x.id===item.r.id;});
    if(r){r.snoozeUntil=Date.now()+5*60000;nextMap[r.id]=nextFor(r,new Date());persist();renderCards();toast('«'+r.name+'» отложено на 5 минут');}
  }
  currentAlert=null;showNextAlert();updateDynamic(Date.now());
}
$('alDone').onclick=function(){resolveAlert('done');};
$('alSnooze').onclick=function(){resolveAlert('snoozed');};
$('alClose').onclick=function(){resolveAlert('hide');};
document.addEventListener('keydown',function(e){
  if($('alertOverlay').hidden)return;
  if(e.key==='Enter')resolveAlert('done');
  else if(e.key==='s'||e.key==='S'||e.key==='ы'||e.key==='Ы')resolveAlert('snoozed');
  else if(e.key==='Escape')resolveAlert('hide');
});

/* ============================== КАРТОЧКИ ============================== */
var cardRefs={},dragId=null;
function renderCards(){
  var grid=$('grid');grid.innerHTML='';cardRefs={};
  state.reminders.forEach(function(r){
    var card=document.createElement('div');
    card.className='card'+(r.enabled?'':' off');card.style.setProperty('--ac',r.color);
    card.draggable=true;card.dataset.id=r.id;
    card.innerHTML=
      '<div class="card-top"><span class="drag-handle" title="Перетащите, чтобы изменить порядок">⠿</span>'+
      '<span class="card-emoji">'+esc(r.emoji)+'</span>'+
      '<div class="card-title"><b>'+esc(r.name)+'</b><span>'+esc(modeSummary(r))+'</span></div>'+
      '<label class="switch" title="Вкл/выкл"><input type="checkbox" data-act="toggle" '+(r.enabled?'checked':'')+'><i></i></label></div>'+
      '<div class="card-next js-next">—</div>'+
      '<div class="card-actions">'+
      '<button class="mini-btn" data-act="test" title="Проверить звук и уведомление">🔔</button>'+
      '<button class="mini-btn" data-act="edit" title="Редактировать">✎</button>'+
      '<span class="spacer"></span>'+
      '<button class="mini-btn del" data-act="del" title="Удалить">🗑</button></div>';
    grid.appendChild(card);
    cardRefs[r.id]={card:card,next:card.querySelector('.js-next')};
  });
  var add=document.createElement('button');
  add.className='add-card';add.id='addCard';
  add.innerHTML='<span class="plus">＋</span>Новое напоминание';
  add.onclick=function(){openEditor(null);};
  grid.appendChild(add);
  $('remCount').textContent=state.reminders.length;
  updateCardNext(Date.now());
}
function updateCardNext(now){
  state.reminders.forEach(function(r){
    var ref=cardRefs[r.id];if(!ref)return;
    if(!r.enabled){ref.next.innerHTML='<span style="color:var(--dim)">Выключено</span>';return;}
    if(state.settings.paused){ref.next.innerHTML='<span style="color:var(--warn)">⏸ Общая пауза</span>';return;}
    var nr=nextMap[r.id];
    if(!nr){ref.next.innerHTML='<span style="color:var(--dim)">Нет ближайших сигналов</span>';return;}
    var snz=(r.snoozeUntil&&r.snoozeUntil>now)?'<span class="snz">отложено до '+fmtHM(r.snoozeUntil)+'</span>':'';
    ref.next.innerHTML='Следующий: <b>'+dayLabel(nr,new Date(now))+' в '+fmtHM(nr)+'</b> <span class="cd">(через '+fmtDur(nr-now)+')</span>'+snz;
  });
}
$('grid').addEventListener('change',function(e){
  var card=e.target.closest('.card');if(!card)return;
  var r=state.reminders.find(function(x){return x.id===card.dataset.id;});if(!r)return;
  if(e.target.dataset.act==='toggle'){
    r.enabled=e.target.checked;r.snoozeUntil=0;
    nextMap[r.id]=nextFor(r,new Date());
    card.classList.toggle('off',!r.enabled);
    persist();updateDynamic(Date.now());renderTimeline();
    toast(r.name+(r.enabled?' включено':' выключено'));
  }
});
$('grid').addEventListener('click',function(e){
  var btn=e.target.closest('[data-act]');if(!btn||btn.tagName==='INPUT')return;
  var card=e.target.closest('.card');if(!card)return;
  var r=state.reminders.find(function(x){return x.id===card.dataset.id;});if(!r)return;
  var act=btn.dataset.act;
  if(act==='edit')openEditor(r.id);
  else if(act==='test'){playSound(r.sound);showNotif(r.emoji+' '+r.name+' — тест',r.text,'test-'+r.id);toast('Тестовый сигнал: '+r.name,'ok');}
  else if(act==='del')deleteReminder(r.id);
});
$('grid').addEventListener('dragstart',function(e){
  var card=e.target.closest('.card');if(!card)return;
  dragId=card.dataset.id;card.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  try{e.dataTransfer.setData('text/plain',dragId);}catch(err){}
});
$('grid').addEventListener('dragend',function(){
  dragId=null;
  document.querySelectorAll('.card.dragging,.card.drop-target').forEach(function(c){c.classList.remove('dragging','drop-target');});
});
$('grid').addEventListener('dragover',function(e){
  var card=e.target.closest('.card');if(!card||!dragId||card.dataset.id===dragId)return;
  e.preventDefault();card.classList.add('drop-target');
});
$('grid').addEventListener('dragleave',function(e){
  var card=e.target.closest('.card');if(card)card.classList.remove('drop-target');
});
$('grid').addEventListener('drop',function(e){
  var card=e.target.closest('.card');if(!card||!dragId)return;
  e.preventDefault();
  var from=state.reminders.findIndex(function(x){return x.id===dragId;});
  var to=state.reminders.findIndex(function(x){return x.id===card.dataset.id;});
  if(from<0||to<0||from===to)return;
  var moved=state.reminders.splice(from,1)[0];
  state.reminders.splice(to,0,moved);
  persist();renderCards();
});
function deleteReminder(id){
  var idx=state.reminders.findIndex(function(x){return x.id===id;});if(idx<0)return;
  var backup=state.reminders[idx];
  state.reminders.splice(idx,1);delete nextMap[id];
  persist();renderCards();recomputeAll();
  toast('«'+backup.name+'» удалено','err',function(){
    state.reminders.splice(Math.min(idx,state.reminders.length),0,backup);
    persist();renderCards();recomputeAll();
  });
}

/* ============================== РЕДАКТОР ============================== */
var editingId=null,edEmoji=EMOJIS[0],edColor=COLORS[0],edDays=WORKDAYS.slice();
function buildEditorStatics(){
  $('edEmojiRow').innerHTML=EMOJIS.map(function(e){return'<button type="button" class="emoji-opt" data-e="'+e+'">'+e+'</button>';}).join('');
  $('edColorRow').innerHTML=COLORS.map(function(c){return'<button type="button" class="color-opt" data-c="'+c+'" style="background:'+c+'" title="'+c+'"></button>';}).join('');
  $('edDays').innerHTML=DAYS_ORDER.map(function(d){return'<button type="button" class="day-chip" data-d="'+d+'">'+DAYS_SHORT[d]+'</button>';}).join('');
  $('edSound').innerHTML=Object.keys(SOUNDS).map(function(k){return'<option value="'+k+'">'+SOUNDS[k].label+'</option>';}).join('');
}
function syncEditorPickers(){
  document.querySelectorAll('.emoji-opt').forEach(function(b){b.classList.toggle('sel',b.dataset.e===edEmoji);});
  document.querySelectorAll('.color-opt').forEach(function(b){b.classList.toggle('sel',b.dataset.c===edColor);});
  document.querySelectorAll('.day-chip').forEach(function(b){b.classList.toggle('sel',edDays.indexOf(+b.dataset.d)>=0);});
}
function syncModeRows(){
  var m=$('edMode').value;
  $('rowInterval').hidden=m!=='interval';
  $('rowHourly').hidden=m!=='hourly';
  $('rowDaily').hidden=m!=='daily';
  $('rowRange').hidden=m==='daily';
}
$('edEmojiRow').addEventListener('click',function(e){var b=e.target.closest('.emoji-opt');if(b){edEmoji=b.dataset.e;syncEditorPickers();}});
$('edColorRow').addEventListener('click',function(e){var b=e.target.closest('.color-opt');if(b){edColor=b.dataset.c;syncEditorPickers();}});
$('edDays').addEventListener('click',function(e){
  var b=e.target.closest('.day-chip');if(!b)return;
  var d=+b.dataset.d,i=edDays.indexOf(d);
  if(i>=0)edDays.splice(i,1);else edDays.push(d);
  syncEditorPickers();
});
$('edMode').addEventListener('change',syncModeRows);
$('edPreview').onclick=function(){playSound($('edSound').value);};
function openEditor(id,presetOver){
  editingId=id;
  var r=id?state.reminders.find(function(x){return x.id===id;}):null;
  var src=r||mk(uid(),'Новый перерыв','🧘','#6aa5ff',presetOver||{});
  $('edTitle').textContent=r?'Редактировать: '+r.name:'Новое напоминание';
  $('edName').value=src.name;$('edMode').value=src.mode;
  $('edInterval').value=src.intervalMinutes;$('edHourly').value=src.hourlyMinute;$('edDaily').value=src.dailyTime;
  $('edStart').value=src.rangeStart;$('edEnd').value=src.rangeEnd;
  $('edSound').value=src.sound;$('edText').value=src.text;$('edEnabled').checked=src.enabled;
  edEmoji=src.emoji;edColor=src.color;edDays=src.days.slice();
  $('edDelete').hidden=!r;
  syncEditorPickers();syncModeRows();
  $('editorBack').hidden=false;
  setTimeout(function(){$('edName').focus();},60);
}
function closeEditor(){$('editorBack').hidden=true;editingId=null;}
$('edCancel').onclick=closeEditor;
$('editorBack').addEventListener('click',function(e){if(e.target===$('editorBack'))closeEditor();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('editorBack').hidden)closeEditor();});
$('edDelete').onclick=function(){var id=editingId;closeEditor();if(id)deleteReminder(id);};
$('edSave').onclick=function(){
  var name=$('edName').value.trim();
  if(!name){toast('Введите название','err');$('edName').focus();return;}
  var mode=$('edMode').value;
  var rs=$('edStart').value||'09:00',re=$('edEnd').value||'18:00';
  if(mode!=='daily'&&parseHM(re,0)<=parseHM(rs,0)){toast('Конец диапазона должен быть позже начала','err');return;}
  if(!edDays.length){toast('Выберите хотя бы один день недели','err');return;}
  var data={
    name:name,emoji:edEmoji,color:edColor,mode:mode,
    intervalMinutes:clamp(Math.round(+$('edInterval').value)||60,1,480),
    hourlyMinute:clamp(Math.round(+$('edHourly').value)||0,0,59),
    dailyTime:$('edDaily').value||'13:00',
    rangeStart:rs,rangeEnd:re,days:edDays.slice().sort(),
    sound:$('edSound').value,text:$('edText').value.trim()||'Пора сделать перерыв!',
    enabled:$('edEnabled').checked,snoozeUntil:0
  };
  if(editingId){
    var r=state.reminders.find(function(x){return x.id===editingId;});
    if(r)Object.assign(r,data);
  }else{
    state.reminders.push(normalizeReminder(Object.assign({id:uid()},data)));
  }
  persist();renderCards();recomputeAll();closeEditor();
  toast('Сохранено: '+name,'ok');
};
$('btnAdd').onclick=function(){openEditor(null);};

/* ============================== ПРЕСЕТЫ ============================== */
var PRESETS={
  smoke:{name:'Перекур',emoji:'☕',color:'#ffb054',mode:'hourly',hourlyMinute:55,sound:'chimes',text:'Пора сделать перекур! Оторвитесь от экрана на пару минут.'},
  lunch:{name:'Обед',emoji:'🍱',color:'#ff6a5c',mode:'daily',dailyTime:'13:00',sound:'marimba',text:'Время обеда! Поешьте спокойно, без экрана.'},
  warmup:{name:'Разминка',emoji:'🤸',color:'#a3e635',mode:'interval',intervalMinutes:45,sound:'pulse',text:'Встаньте и разомнитесь 2–3 минуты: шея, плечи, спина.'},
  water:{name:'Вода',emoji:'💧',color:'#38d6f5',mode:'interval',intervalMinutes:30,sound:'ding',text:'Выпейте стакан воды — организм скажет спасибо.'},
  eyes:{name:'Глаза',emoji:'👀',color:'#c084fc',mode:'interval',intervalMinutes:20,sound:'calm',text:'Правило 20-20-20: посмотрите вдаль на 20 секунд.'},
  walk:{name:'Прогулка',emoji:'🚶',color:'#4ade80',mode:'interval',intervalMinutes:90,sound:'sweep',text:'Пройдитесь 5 минут — свежая голова гарантирована.'}
};
$('presets').addEventListener('click',function(e){
  var b=e.target.closest('.preset');if(!b)return;
  var key=b.dataset.preset;
  var exist=state.reminders.find(function(r){return r.preset===key;});
  if(exist){openEditor(exist.id);toast('«'+exist.name+'» уже есть — открываю настройки');return;}
  var p=Object.assign({preset:key},PRESETS[key]);
  state.reminders.push(normalizeReminder(Object.assign({id:uid()},p)));
  persist();renderCards();recomputeAll();
  toast('Добавлено: '+p.name,'ok');
});

/* ============================== РАСПИСАНИЕ / ГЕРОЙ ============================== */
var RING_C=552.92,lastMinuteSig='';
function upcoming(count){
  var now=new Date(),cursors={},list=[];
  state.reminders.forEach(function(r){if(r.enabled&&!state.settings.paused){var n=nextFor(r,now);if(n)cursors[r.id]=n;}});
  for(var i=0;i<count;i++){
    var bestId=null,bestTs=Infinity;
    for(var id in cursors){if(cursors[id]<bestTs){bestTs=cursors[id];bestId=id;}}
    if(!bestId)break;
    var r=state.reminders.find(function(x){return x.id===bestId;});
    list.push({ts:bestTs,r:r});
    var nxt=computeBase(r,new Date(bestTs+1000));
    if(nxt)cursors[bestId]=nxt;else delete cursors[bestId];
  }
  return list;
}
function renderTimeline(){
  var now=Date.now(),list=upcoming(48);
  var today=new Date();today=new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime();
  var tomorrow=today+86400000;
  var todayCount=list.filter(function(x){return x.ts>=today&&x.ts<tomorrow;}).length;
  $('statToday').textContent=todayCount;
  $('tlCount').textContent=list.length?'всего '+list.length:'';
  var el=$('timeline');
  if(!list.length){el.innerHTML='<div class="empty">Нет запланированных сигналов.<br>Включите напоминания или снимите паузу.</div>';return;}
  el.innerHTML=list.slice(0,10).map(function(x,i){
    return'<div class="tl-row'+(i===0?' first':'')+'" style="--ac:'+x.r.color+'"><span class="tl-dot"></span><span class="tl-time">'+fmtHM(x.ts)+'</span><span class="tl-name">'+esc(x.r.emoji)+' '+esc(x.r.name)+'</span><span class="tl-when">'+dayLabel(x.ts,new Date(now))+' · через '+fmtDur(x.ts-now)+'</span></div>';
  }).join('');
}
function updateHero(now){
  var best=null;
  if(!state.settings.paused){
    state.reminders.forEach(function(r){
      if(!r.enabled)return;var n=nextMap[r.id];
      if(n&&(!best||n<best.ts))best={ts:n,r:r};
    });
  }
  var ring=$('ringFg');
  if(!best){
    $('heroTime').textContent='--:--';$('heroEmoji').textContent=state.settings.paused?'⏸':'';
    $('heroName').textContent=state.settings.paused?'Все напоминания на паузе':'Нет активных напоминаний';
    $('heroSub').textContent=state.settings.paused?'Нажмите ▶ в шапке, чтобы продолжить':'Включите карточку ниже или добавьте пресет';
    ring.style.stroke='var(--dim)';ring.style.strokeDashoffset=RING_C;
    $('npEmoji').textContent='⏸';$('npName').textContent='пауза';$('npTime').textContent='--:--';
    return;
  }
  var rem=best.ts-now;
  var win=best.r.mode==='interval'?best.r.intervalMinutes*60000:(best.r.mode==='hourly'?3600000:86400000);
  if(best.r.snoozeUntil&&best.r.snoozeUntil>now)win=300000;
  var frac=clamp(1-rem/win,0,1);
  ring.style.stroke=best.r.color;
  ring.style.filter='drop-shadow(0 0 8px '+best.r.color+'88)';
  ring.style.strokeDashoffset=RING_C*(1-frac);
  $('heroTime').textContent=fmtClock(rem);
  $('heroEmoji').textContent=best.r.emoji;
  $('heroName').textContent=best.r.emoji+' '+best.r.name;
  $('heroSub').textContent=dayLabel(best.ts,new Date(now))+' в '+fmtHM(best.ts)+' · '+modeSummary(best.r);
  $('npEmoji').textContent=best.r.emoji;$('npName').textContent=best.r.name;$('npTime').textContent=fmtClock(rem);
}
function updateDynamic(now){
  updateHero(now);
  updateCardNext(now);
  $('heroClock').textContent='сейчас '+new Date(now).toLocaleTimeString('ru-RU');
  var active=state.reminders.filter(function(r){return r.enabled;}).length;
  $('statActive').textContent=active+' из '+state.reminders.length;
  $('statGuard').textContent=state.settings.keepAwake?(keepOsc?'вкл ✅':'ждёт клика'):'выкл';
  var sig=Math.floor(now/60000)+'|'+state.settings.paused+'|'+active;
  if(sig!==lastMinuteSig){lastMinuteSig=sig;renderTimeline();}
}
function recomputeAll(){
  var now=new Date();
  state.reminders.forEach(function(r){nextMap[r.id]=nextFor(r,now);});
  lastMinuteSig='';updateDynamic(Date.now());
}

/* ============================== ТИКЕР ============================== */
function tick(now){
  if(!state.settings.paused){
    var fired=false;
    state.reminders.forEach(function(r){
      if(!r.enabled)return;
      var nr=nextMap[r.id];
      if(nr&&now>=nr){
        var late=now-nr;
        if(r.snoozeUntil&&r.snoozeUntil<=now)r.snoozeUntil=0;
        if(late>90000&&!state.settings.catchUp){
          pushHistory({id:uid(),rid:r.id,name:r.name,emoji:r.emoji,color:r.color,at:now,status:'skipped',lateMs:late});
        }else{
          fire(r,late);fired=true;
        }
        nextMap[r.id]=nextFor(r,new Date(now));
        persist();
      }
    });
    if(fired)renderCards();
  }
  updateDynamic(now);
}
var worker=null;
(function initWorker(){
  try{
    var src='var t=null;onmessage=function(e){if(e.data==="start"){if(!t)t=setInterval(function(){postMessage(Date.now());},1000);postMessage(Date.now());}else if(e.data==="stop"){clearInterval(t);t=null;}};';
    var url=URL.createObjectURL(new Blob([src],{type:'application/javascript'}));
    worker=new Worker(url);
    worker.onmessage=function(e){tick(e.data);};
    worker.postMessage('start');
  }catch(e){worker=null;}
  if(!worker)setInterval(function(){tick(Date.now());},1000);
  setInterval(function(){tick(Date.now());},10000); /* страховка main-thread */
})();

/* ============================== ЧИПЫ СТАТУСА ============================== */
function setChip(id,cls,text){var el=$(id);el.className='chip '+cls;el.innerHTML='<span class="dot"></span>'+text;}
function updateChips(){
  setChip('chipWorker',worker?'ok':'wait',worker?'Воркер: активен':'Воркер: резервный таймер');
  if(!state.settings.keepAwake)setChip('chipAudio','','Аудио-защита: выкл');
  else if(keepOsc)setChip('chipAudio','ok','Аудио-защита: работает');
  else if(audioCtx&&audioCtx.state==='running')setChip('chipAudio','wait','Аудио: запускается…');
  else setChip('chipAudio','wait','Аудио: кликните по странице');
  if(!('wakeLock' in navigator))setChip('chipWake','','Wake Lock: недоступен');
  else if(!state.settings.wakeLock)setChip('chipWake','','Wake Lock: выкл');
  else if(wakeSentinel)setChip('chipWake','ok','Wake Lock: экран бодрствует');
  else setChip('chipWake','wait','Wake Lock: ожидает');
  var p=notifPermission();
  if(p==='granted')setChip('chipNotif','ok','Уведомления: разрешены');
  else if(p==='denied')setChip('chipNotif','bad','Уведомления: заблокированы');
  else if(p==='unsupported')setChip('chipNotif','bad','Уведомления: не поддерживаются');
  else setChip('chipNotif','wait','Уведомления: нужно разрешение');
}
if(navigator.storage&&navigator.storage.persist){
  navigator.storage.persist().then(function(ok){
    setChip('chipStore',ok?'ok':'','Хранилище: '+(ok?'закреплено':'обычное'));
  }).catch(function(){setChip('chipStore','','Хранилище: localStorage');});
}else setChip('chipStore','','Хранилище: localStorage');

/* ============================== ШАБЛОНЫ / ФОН / РЕЧЬ ============================== */
var TEMPLATE_KEY='perekur.plus.templates.v1';
function readTemplates(){try{return JSON.parse(localStorage.getItem(TEMPLATE_KEY)||'[]');}catch(e){return[];}}
function saveTemplates(list){try{localStorage.setItem(TEMPLATE_KEY,JSON.stringify(list));}catch(e){toast('Не удалось сохранить шаблоны: хранилище недоступно','err');}}
function templateDataFromEditor(){return {name:$('edName').value.trim(),emoji:edEmoji,color:edColor,mode:$('edMode').value,intervalMinutes:+$('edInterval').value,hourlyMinute:+$('edHourly').value,dailyTime:$('edDaily').value,rangeStart:$('edStart').value,rangeEnd:$('edEnd').value,days:edDays.slice(),sound:$('edSound').value,text:$('edText').value.trim(),enabled:$('edEnabled').checked};}
function renderTemplates(){var list=readTemplates(),box=$('templateList');box.innerHTML='';if(!list.length){box.innerHTML='<span class="foot-hint">Пока нет шаблонов — откройте напоминание и нажмите «☆ В шаблон».</span>';return;}list.forEach(function(t,i){var b=document.createElement('button');b.className='btn small';b.textContent='＋ '+t.name;b.title='Добавить шаблон';b.onclick=function(){var data=Object.assign({},t.data,{preset:null,snoozeUntil:0});state.reminders.push(normalizeReminder(Object.assign({id:uid()},data)));persistNow();renderCards();recomputeAll();toast('Шаблон добавлен: '+t.name,'ok');};var del=document.createElement('button');del.className='btn small danger';del.textContent='×';del.title='Удалить шаблон';del.onclick=function(){var fresh=readTemplates();fresh.splice(i,1);saveTemplates(fresh);renderTemplates();};box.appendChild(b);box.appendChild(del);});}
$('edSaveTemplate').onclick=function(){var data=templateDataFromEditor();if(!data.name){toast('Введите название шаблона','err');return;}var list=readTemplates();list.push({id:uid(),name:data.name,data:data,savedAt:Date.now()});saveTemplates(list);renderTemplates();toast('Шаблон сохранён в браузере','ok');};
var bgAudio=new Audio();bgAudio.loop=true;bgAudio.preload='auto';bgAudio.volume=.01;
var bgFileObjectUrl=null,bgAudioDb=null,bgGain=null,bgSourceNode=null;
var BGKEY='perekur.plus.background.v1';
function bgFileDB(){return new Promise(function(resolve,reject){var req=indexedDB.open('perekur-plus-audio',1);req.onupgradeneeded=function(){req.result.createObjectStore('audio');};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error);};});}
function bgStoreFile(file){return bgFileDB().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(file,'background');tx.oncomplete=function(){db.close();resolve();};tx.onerror=function(){db.close();reject(tx.error);};});});}
function bgGetFile(){return bgFileDB().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('audio','readonly'),req=tx.objectStore('audio').get('background');req.onsuccess=function(){db.close();resolve(req.result||null);};req.onerror=function(){db.close();reject(req.error);};});});}
function bgLoadConfig(){try{return JSON.parse(localStorage.getItem(BGKEY)||'{}');}catch(e){return{};}}
function bgSaveConfig(c){try{localStorage.setItem(BGKEY,JSON.stringify(c));}catch(e){}}
function bgStatus(msg){$('bgStatus').textContent=msg+' · громкость 1%';}
function bgSetUrl(url){if(!url)return;bgAudio.src=url;bgAudio.volume=.01;bgAudio.load();}
function bgApply(){var mode=$('bgSourceMode').value;if(mode==='url'){var url=$('bgUrl').value.trim();if(!/^https?:\/\//i.test(url)){toast('Введите полный http/https URL аудиофайла','err');return;}bgSetUrl(url);bgSaveConfig({mode:'url',url:url});bgStatus('URL выбран');toast('Фоновый источник применён','ok');}else{$('bgFile').click();}}
$('bgSourceMode').onchange=function(){var isFile=this.value==='file';$('bgUrl').hidden=isFile;$('bgChoose').hidden=!isFile;};
$('bgChoose').onclick=function(){$('bgFile').click();};
$('bgApply').onclick=bgApply;
$('bgFile').onchange=function(){var f=this.files&&this.files[0];if(!f)return;if(bgFileObjectUrl)URL.revokeObjectURL(bgFileObjectUrl);bgFileObjectUrl=URL.createObjectURL(f);bgSetUrl(bgFileObjectUrl);bgSaveConfig({mode:'file',fileName:f.name});bgStoreFile(f).then(function(){bgStatus('Локальный файл сохранён и будет доступен после перезагрузки: '+f.name);toast('Файл сохранён локально','ok');}).catch(function(){bgStatus('Файл подключён, но не удалось сохранить его в IndexedDB');toast('Файл воспроизводится, но не сохранён в хранилище','err');});};
$('bgToggle').onclick=function(){if(!bgAudio.src){toast('Сначала выберите URL или локальный файл','err');return;}bgAudio.volume=.01;bgAudio.play().then(function(){$('bgToggle').textContent='⏸ Пауза';bgStatus('Фоновый звук играет непрерывно');}).catch(function(){toast('Не удалось воспроизвести: нажмите ещё раз или проверьте URL','err');});};
$('bgStop').onclick=function(){bgAudio.pause();$('bgToggle').textContent='▶ Запустить';bgStatus('Фоновый звук остановлен');};
bgAudio.addEventListener('play',function(){$('bgToggle').textContent='⏸ Пауза';});bgAudio.addEventListener('pause',function(){$('bgToggle').textContent='▶ Запустить';});bgAudio.addEventListener('error',function(){bgStatus('Ошибка загрузки аудио — проверьте URL / CORS');});
var bgCfg=bgLoadConfig();if(bgCfg.mode==='url'&&bgCfg.url){$('bgSourceMode').value='url';$('bgUrl').value=bgCfg.url;bgSetUrl(bgCfg.url);}else if(bgCfg.mode==='file'){$('bgSourceMode').value='file';$('bgUrl').hidden=true;$('bgChoose').hidden=false;bgGetFile().then(function(f){if(f){bgFileObjectUrl=URL.createObjectURL(f);bgSetUrl(bgFileObjectUrl);bgStatus('Локальный аудиофайл восстановлен: '+(bgCfg.fileName||f.name||'audio'));}else bgStatus('Локальный файл не найден — выберите его заново');}).catch(function(){bgStatus('Локальный файл недоступен — выберите его заново');});}
var voiceEnabled=localStorage.getItem('perekur.plus.voice')==='1';$('tglVoice').checked=voiceEnabled;
$('tglVoice').onchange=function(){voiceEnabled=this.checked;localStorage.setItem('perekur.plus.voice',voiceEnabled?'1':'0');};
function speakReminder(r){if(!voiceEnabled||!('speechSynthesis' in window))return;try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(r.name+'. '+r.text);u.lang='ru-RU';u.rate=1;u.volume=1;speechSynthesis.speak(u);}catch(e){}}
$('btnVoiceTest').onclick=function(){if(!('speechSynthesis' in window)){toast('Голосовой синтез не поддерживается','err');return;}var u=new SpeechSynthesisUtterance('Перекур плюс. Голосовые уведомления работают.');u.lang='ru-RU';speechSynthesis.speak(u);};

/* ============================== ПАНЕЛЬ / ШАПКА ============================== */
$('tglKeep').checked=state.settings.keepAwake;
$('tglWake').checked=state.settings.wakeLock;
$('tglCatch').checked=state.settings.catchUp;
$('tglKeep').addEventListener('change',function(){
  state.settings.keepAwake=this.checked;persist();
  if(this.checked){unlockAudio();startKeepAlive();toast('Аудио-защита включена — вкладка не уснёт','ok');}
  else{stopKeepAlive();toast('Аудио-защита выключена');}
  updateDynamic(Date.now());
});
$('tglWake').addEventListener('change',function(){
  state.settings.wakeLock=this.checked;persist();
  if(this.checked)requestWake();else releaseWake();
});
$('tglCatch').addEventListener('change',function(){state.settings.catchUp=this.checked;persist();});
$('volRange').value=Math.round(state.settings.volume*100);
$('volVal').textContent=Math.round(state.settings.volume*100)+'%';
$('volRange').addEventListener('input',function(){
  state.settings.volume=+this.value/100;$('volVal').textContent=this.value+'%';persist();
});
$('volRange').addEventListener('change',function(){playSound('ding');});
function syncSoundBtn(){
  var b=$('btnSound');
  b.textContent=state.settings.soundOn?'🔊':'';
  b.classList.toggle('on',state.settings.soundOn);
  b.title=state.settings.soundOn?'Звук сигналов включён — нажмите, чтобы выключить':'Звук сигналов выключен — нажмите, чтобы включить';
}
$('btnSound').onclick=function(){
  state.settings.soundOn=!state.settings.soundOn;persist();syncSoundBtn();
  if(state.settings.soundOn){unlockAudio();playSound('ding');}
  toast(state.settings.soundOn?'Звук сигналов включён':'Звук сигналов выключен');
};
function syncPauseBtn(){
  var b=$('btnPause');
  b.textContent=state.settings.paused?'▶':'⏸';
  b.classList.toggle('warn',state.settings.paused);
  b.title=state.settings.paused?'Возобновить все напоминания':'Поставить все напоминания на паузу';
}
$('btnPause').onclick=function(){
  state.settings.paused=!state.settings.paused;persist();syncPauseBtn();
  if(!state.settings.paused)recomputeAll();else{lastMinuteSig='';updateDynamic(Date.now());}
  toast(state.settings.paused?'Все напоминания на паузе':'Напоминания возобновлены','ok');
};
$('btnNotif').onclick=askNotif;
$('btnNotifPerm').onclick=askNotif;
$('btnTestNotif').onclick=function(){
  unlockAudio();playSound('chimes');
  if(notifPermission()==='granted'){showNotif('☕ Перекур+ — тест','Так будет выглядеть сигнал напоминания. Всё работает!','test');toast('Тестовое уведомление отправлено','ok');}
  else{toast('Сначала разрешите уведомления','err');}
};
$('nextPill').onclick=function(){window.scrollTo({top:0,behavior:'smooth'});};
$('btnClearHistory').onclick=function(){
  if(!state.history.length)return;
  var backup=state.history.slice();
  state.history=[];persist();renderHistory();
  toast('Журнал очищен','err',function(){state.history=backup;persist();renderHistory();});
};

/* ============================== ЭКСПОРТ / ИМПОРТ / СБРОС ============================== */
$('btnExport').onclick=function(){
  var blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='perekur-plus-settings.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
  toast('Настройки экспортированы','ok');
};
$('btnImport').onclick=function(){$('fileImport').click();};
$('fileImport').addEventListener('change',function(){
  var f=this.files[0];this.value='';if(!f)return;
  var reader=new FileReader();
  reader.onload=function(){
    try{
      var p=JSON.parse(reader.result);
      if(!p||!Array.isArray(p.reminders))throw new Error('bad');
      var s=seed();
      state={v:3,settings:Object.assign(s.settings,p.settings||{}),reminders:p.reminders.map(normalizeReminder),history:Array.isArray(p.history)?p.history.slice(0,60):[]};
      persistNow();syncAllControls();renderCards();renderHistory();recomputeAll();
      toast('Настройки импортированы','ok');
    }catch(e){toast('Не удалось импортировать: неверный файл','err');}
  };
  reader.readAsText(f);
});
$('btnReset').onclick=function(){
  var backup=JSON.parse(JSON.stringify(state));
  state=seed();persistNow();syncAllControls();renderCards();renderHistory();recomputeAll();
  toast('Всё сброшено к начальным настройкам','err',function(){
    state=backup;persistNow();syncAllControls();renderCards();renderHistory();recomputeAll();
  });
};
function syncAllControls(){
  $('tglKeep').checked=state.settings.keepAwake;
  $('tglWake').checked=state.settings.wakeLock;
  $('tglCatch').checked=state.settings.catchUp;
  $('volRange').value=Math.round(state.settings.volume*100);
  $('volVal').textContent=Math.round(state.settings.volume*100)+'%';
  syncSoundBtn();syncPauseBtn();
  if(state.settings.keepAwake)startKeepAlive();else stopKeepAlive();
  if(state.settings.wakeLock)requestWake();else releaseWake();
}

/* ============================== PWA ============================== */
var installPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installPrompt=e;$('btnInstall').hidden=false;});
window.addEventListener('appinstalled',function(){$('btnInstall').hidden=true;installPrompt=null;toast('Перекур+ установлен как приложение 🎉','ok');});
$('btnInstall').onclick=function(){
  if(!installPrompt)return;
  installPrompt.prompt();
  installPrompt.userChoice.then(function(c){if(c.outcome==='accepted')$('btnInstall').hidden=true;installPrompt=null;});
};
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){
  /* сбрасываем старый кэш прежней версии, чтобы новая страница не залипла в cache-first */
  try{
    if(!localStorage.getItem(LS+'.swreset')){
      caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf('perekur')===0;}).map(function(k){return caches.delete(k);}));})
        .then(function(){localStorage.setItem(LS+'.swreset','1');}).catch(function(){});
    }
  }catch(e){}
  navigator.serviceWorker.register('./sw.js').then(function(reg){swReg=reg;}).catch(function(){});
}

/* ============================== ВИДИМОСТЬ / ЖИЗНЕННЫЙ ЦИКЛ ============================== */
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'){
    tick(Date.now()); /* догоняем пропущенное сразу */
    unlockAudio();requestWake();
    if(!alertQueue.length&&!currentAlert)stopFlash();
  }
});
window.addEventListener('focus',function(){tick(Date.now());});
window.addEventListener('pageshow',function(){tick(Date.now());});
window.addEventListener('beforeunload',persistNow);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')persistNow();});
var errShown=false;
window.addEventListener('error',function(){
  if(!errShown){errShown=true;toast('Произошла ошибка скрипта — перезагрузите страницу, если что-то не работает','err');}
});

/* ============================== SCROLL-REVEAL / НАВИГАЦИЯ ============================== */
var io=new IntersectionObserver(function(entries){entries.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{threshold:0.1});
document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
var navIo=new IntersectionObserver(function(entries){
  entries.forEach(function(en){
    if(en.isIntersecting){
      document.querySelectorAll('[data-navlink]').forEach(function(a){a.classList.toggle('active',a.dataset.navlink===en.target.dataset.nav);});
    }
  });
},{rootMargin:'-35% 0px -55% 0px'});
document.querySelectorAll('[data-nav]').forEach(function(s){navIo.observe(s);});

/* ============================== СТАРТ ============================== */
buildEditorStatics();
renderTemplates();
renderCards();
renderHistory();
syncSoundBtn();
syncPauseBtn();
updateNotifButtons();
recomputeAll();
updateChips();
unlockAudio();
requestWake();
setInterval(updateChips,4000);
tick(Date.now());
})();
