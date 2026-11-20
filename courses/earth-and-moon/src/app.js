"use strict";
(() => {
  const $=id=>document.getElementById(id), video=$('film'), domCanvas=(w,h)=>{let c=document.createElement('canvas');c.width=w;c.height=h;return c};
  const raw=domCanvas(Astro.W,Astro.H),space=$('space'),ground=$('ground'),left=space.getContext('2d'),right=ground.getContext('2d');
  const qr=window.matchMedia('(prefers-reduced-motion: reduce)'), choiceState=Array(6).fill(null);
  const state={i:0,lang:'en',mode:'film',p:.19,v:0,yaw:0,labPlaying:false,cap:'single',speed:1,muted:false,mediaId:'',rev:0,seek:0,idx:-1,ready:false,raf:0,timePrev:0,full:false,activeUrl:null,wantPlay:false};
  let render=null, oldScript=-1, uiFilmTime=-1;
  const iconPaths={
    play:'<path d="M8 5l11 7-11 7z" fill="currentColor" stroke-width="0"/>',
    pause:'<path d="M8 5v14M16 5v14" stroke-width="3.7"/>',
    next:'<path d="M4 12h15m-6-6 6 6-6 6"/>',prev:'<path d="M20 12H5m6-6-6 6 6 6"/>',
    jump:'<path d="M6 18 18 6M6 6h12v12"/>', orbit:'<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="11" ry="3.8" transform="rotate(-32 12 12)"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 6v6l4 2"/>', screen:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="m10 8 5 3-5 3zM8 21h8"/>',
    volume:'<path d="M3 9h4l5-4v14l-5-4H3zM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/>',mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8l5 8m0-8-5 8"/>',
    fs:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',exit:'<path d="M9 3v6H3m18 0h-6V3m0 18v-6h6M3 15h6v6"/>',
    reset:'<path d="M4 6v5h5M4 11a8 8 0 1 1 1.5 6"/>',layers:'<path d="m3 8 9-5 9 5-9 5zM4 12l8 5 8-5M4 16l8 5 8-5"/>',
    lab:'<path d="M9 3h6m-5 0v6l-6 9c-.8 1.2 0 3 1.5 3h13c1.5 0 2.3-1.8 1.5-3l-6-9V3M7.5 14h9"/>',
    text:'<path d="M4 4h16v16H4zM7 8h10M7 12h10M7 16h6"/>'
  };
  function ico(n){return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'+iconPaths[n]+'</svg>'}
  const en=()=>state.lang==='en', tr=(a,b)=>en()?b:a, both=pair=>pair[en()?1:0], pad=n=>String(n).padStart(2,'0');
  const fmt=t=>{t=Math.max(0,Math.floor(t+.000001));return pad(Math.floor(t/60))+':'+pad(t%60)};
  const lens=()=>DUR[state.lang][state.i], total=()=>lens().reduce((a,b)=>a+b,0), chapter=()=>COURSE[state.i];
  function timeNow(){return state.ready&&Number.isFinite(video.currentTime)?video.currentTime:state.seek}
  function setText(id,s){$(id).textContent=s}
  function button(id,s,icoName,pos='left'){const b=$(id);b.replaceChildren();if(pos==='left'&&icoName)b.insertAdjacentHTML('beforeend',ico(icoName));b.append(document.createTextNode(s));if(pos==='right'&&icoName)b.insertAdjacentHTML('beforeend',ico(icoName));b.setAttribute('aria-label',s)}
  function ib(id,n,s){const b=$(id);if(b.dataset.ico!==n){b.innerHTML=ico(n);b.dataset.ico=n}b.title=s;b.setAttribute('aria-label',s)}
  function tt(id,s){$(id).setAttribute('aria-label',s);$(id).title=s}
  function selButton(b,on){b.setAttribute('aria-pressed',String(on))}
  const pdef=[.25,.25,.25,0,.25,.5],vdef=[0,0,1,0,0,0];
  const presets=[
    [[.25,'日出','Sunrise'],[.5,'正午','Noon'],[.75,'日落','Sunset'],[0,'午夜','Midnight']],
    [[0,'三月分','Mar equinox'],[.25,'六月至','Jun solstice'],[.5,'九月分','Sep equinox'],[.75,'十二月至','Dec solstice']],
    [[0,'三月分','Mar equinox'],[.25,'六月至','Jun solstice'],[.5,'九月分','Sep equinox'],[.75,'十二月至','Dec solstice']],
    [[0,'起点','Start'],[.25,'¼ 圈','¼ orbit'],[.5,'½ 圈','½ orbit'],[1,'一整圈','Full orbit']],
    [[0,'新月','New'],[.25,'上弦','First quarter'],[.5,'满月','Full'],[.75,'下弦','Third quarter']],
    [[0,'开始前','Before'],[.3,'接近','Approach'],[.5,'最接近','Closest'],[1,'结束后','After']]
  ];
  const spaceNames=[['地轴与晨昏线','Spin axis and terminator'],['日心轨道','Heliocentric orbit'],['直射纬度','Subsolar latitude'],['相对固定星空','Relative to distant stars'],['日光从右侧射入','Sunlight from the right'],['日地月侧视示意','Side-view alignment']];
  const groundNames=[['杭州 · 当地太阳时','Hangzhou · local solar time'],['北纬 / 南纬 30°','30° north / south'],['正午 · 一米竖杆','Solar noon · 1 m pole'],['月面地标 · 均匀补光','Surface landmark · even light'],['月面北方朝上','Lunar north up'],['食带或月面模拟','Simulated Sun or Moon']];
  function translate(){
    const E=en();document.documentElement.lang=E?'en':'zh-CN';document.documentElement.classList.toggle('english',E);
    document.title=tr('轨道图志 · 地球与月球','Orbit Atlas · Earth & Moon');
    setText('skip',tr('跳到观测台','Skip to the observatory'));setText('brand',tr('轨道图志','Orbit Atlas'));document.querySelector('.brand small').textContent=tr('ORBIT ATLAS','ASTRONOMY');
    setText('navCh',tr('课程目录','Chapters'));setText('navLab',tr('观测台','Observatory'));tt('langgroup',tr('界面与旁白语言','Interface and narration language'));
    selButton($('langZh'),!E);selButton($('langEn'),E);
    setText('eyebrow',tr('双语天文互动课','INTERACTIVE ASTRONOMY'));setText('title',tr('地球与月球','Earth & Moon'));setText('sub',tr('Earth & Moon','地球与月球'));
    setText('heroDesc',tr('从杭州的一次日出，到月影划过地球。在太空与地面之间切换，看懂头顶的天空。','Follow a sunrise in Hangzhou and a shadow across Earth. See the same sky from the ground and from space.'));
    button('startFilm',tr('播放第一章','Play chapter one'),'play');button('startLab',tr('进入互动实验','Explore the lab'),'orbit');
    setText('catalogTitle',tr('课程目录','Chapters'));let all=DUR[state.lang].flat().reduce((a,b)=>a+b,0);$('totals').innerHTML=ico('clock')+'<span>'+tr('6 章 · 视频 '+fmt(all),'6 chapters · '+fmt(all)+' of film')+'</span>';
    ib('railPrev','prev',tr('向前浏览章节','Scroll chapters left'));ib('railNext','next',tr('向后浏览章节','Scroll chapters right'));tt('rail',tr('章节列表','Chapter list'));
    button('filmMode',tr('视频讲解','Guided film'),'screen');button('labMode',tr('互动实验','Interactive lab'),'lab');tt('modegroup',tr('学习方式','Learning mode'));
    tt('seek',tr('视频进度','Film position'));tt('speed',tr('播放速度','Playback speed'));tt('captions',tr('字幕方式','Caption mode'));
    $('captions').replaceChildren(...[['single',tr('本语字幕','Captions')],['dual',tr('中英双字幕','Bilingual CC')],['off',tr('关闭字幕','CC off')]].map(v=>new Option(v[1],v[0])));$('captions').value=state.cap;
    button('camera',tr('换视角','View'),'layers');tt('camera',tr('切换太空视角，也可在左图左右拖动','Switch space view, or drag the space scene horizontally'));ib('reset','reset',tr('重置本章实验','Reset this experiment'));
    $('challenge').innerHTML=ico('lab')+tr('观测挑战','Observation challenge');$('scriptTitle').innerHTML=ico('text')+tr('逐句讲稿','Narration transcript');
    const help=tr('点击时间点可跳到对应画面。','Select a timestamp to jump to that scene.');setText('scriptHelp',help);setText('scriptClosedHelp',tr('展开查看本章讲稿，按时间点回看画面。','Open the transcript to revisit a scene by timestamp.'));
    button('tryLab',tr('用实验验证','Test it in the lab'),'jump','right');button('previous',tr('上一章','Previous chapter'),'prev');button('next',tr('下一章','Next chapter'),'next','right');
    setText('scaleNote',tr('天体大小与轨道距离采用示意比例','Body sizes and orbital distances are shown at illustrative scales.'));
    setText('sourcesTitle',tr('模型说明、科学资料与制作署名','Model notes, science references, and credits'));sources();railBuild();lessonText();controls();
  }
  function sources(){
    let h=tr('模型说明','Model notes'),ref=tr('科学资料与制作','References and production');
    let n=tr('天体大小、距离和阴影宽度分别缩放，便于观察。四季采用圆轨道、匀速公转和 23.44° 地轴倾角。分至点按轨道四分之一圈设置。高度、昼长、杆影忽略大气折射和地形。','Sizes, distances, and shadow widths are scaled separately. The seasons model uses a circular, uniform orbit with a 23.44° axial tilt. Equinoxes and solstices are quarter-orbit steps. Altitudes, shadows and day lengths ignore atmospheric refraction and terrain.');
    let m=tr('经纬剖面只追踪直射纬度。同步自转实验为跟踪地标采用均匀补光。月相使用月北向上的地心示意，日月食是对准交点与错过交点的几何对照，适用于理解成因。','The meridian view tracks subsolar latitude. The spin experiment uses even light to reveal the landmark. Phases are geocentric, lunar north up. Eclipse views compare near-node and off-node geometry.');
    const a=(url,label)=>'<a target="_blank" rel="noopener noreferrer" href="'+url+'">'+label+'</a>';
    let refs=[['https://science.nasa.gov/earth/facts/',tr('地球','Earth')],['https://spaceplace.nasa.gov/seasons/en/',tr('四季','Seasons')],['https://science.nasa.gov/moon/moon-phases/',tr('月相','Moon phases')],['https://science.nasa.gov/moon/eclipses/',tr('日月食','Eclipses')]].map(x=>a(...x)).join(' · ');
    let assets=a('https://github.com/mrdoob/three.js/tree/r160/examples/textures/planets',tr('地球与月面纹理','Planet textures'))+' · '+a('https://huggingface.co/rhasspy/piper-voices',tr('中英合成旁白','Bilingual synthesized voices'))+' · '+a('https://github.com/google/fonts',tr('字体','Typefaces'));
    $('sourceBody').innerHTML='<div><h3>'+h+'</h3><p>'+n+'</p><p>'+m+'</p></div><div><h3>'+ref+'</h3><p>NASA Science / Space Place · '+refs+'</p><p>'+tr('六章影片由本课件的三维模型逐帧渲染。普通话使用 Huayan 音色，英语使用 Lessac 音色。','The films are rendered from the same 3D models as the labs. The Mandarin voice is Huayan, and the English voice is Lessac.')+'</p><p>'+assets+'</p></div>';
  }
  function railBuild(){
    const rail=$('rail');rail.replaceChildren();COURSE.forEach((c,i)=>{const b=document.createElement('button');b.className='chcard';b.setAttribute('aria-current',String(i===state.i));b.setAttribute('aria-label',tr('第 '+(i+1)+' 章 ','Chapter '+(i+1)+' · ')+both(c.title));
      b.innerHTML='<img alt="" src="'+IMG.cards[i]+'"><span class="chapter-time">'+fmt(DUR[state.lang][i].reduce((a,b)=>a+b,0))+'</span><span class="cardinfo"><span class="chno">'+pad(i+1)+'</span><span class="chtitle"></span></span>';b.querySelector('.chtitle').textContent=both(c.short);
      b.onclick=()=>chooseChapter(i,true);rail.append(b)
    })
  }
  function transcript(){let root=$('scriptlist');root.replaceChildren();let elapsed=0;chapter().beats.forEach((b,j)=>{let at=elapsed,li=document.createElement('li'),bt=document.createElement('button'),tm=document.createElement('time'),sp=document.createElement('span');tm.textContent=fmt(at);sp.textContent=b[state.lang];bt.append(tm,sp);
    if(state.cap==='dual'){let other=document.createElement('small');other.textContent=b[en()?'zh':'en'];sp.append(other)}
    bt.onclick=()=>{if(state.mode!=='film')setMode('film');seekTo(at+.015);scrollLesson()};li.append(bt);root.append(li);elapsed+=lens()[j]});oldScript=-1
  }
  function choicePaint(){const root=$('choices'),chosen=choiceState[state.i],c=chapter();root.replaceChildren();c.choices.forEach((pair,i)=>{let b=document.createElement('button');b.className='choice';selButton(b,chosen===i);b.textContent=both(pair);if(chosen===i)b.classList.add(i===c.correct?'right':'wrong');b.onclick=()=>{choiceState[state.i]=i;choicePaint()};root.append(b)});
    setText('feedback',chosen===null?'':chosen===c.correct?tr('答对了。','Correct. ')+both(c.answer):tr('再试一次。可以切到互动实验，对照两幅画面再作答。','Try again. Compare both views in the interactive lab, then choose another answer.'))
  }
  function lessonText(){
    const c=chapter();setText('chapterIndex',tr('第 '+pad(state.i+1)+' / 06 章','CHAPTER '+pad(state.i+1)+' / 06'));
    setText('lessonTitle',both(c.title));setText('question',both(c.question));setText('spaceLabel',tr('太空视角','Space view'));setText('groundLabel',tr('地面观测','Earth view'));setText('spaceName',both(spaceNames[state.i]));setText('groundName',both(groundNames[state.i]));
    $('space').setAttribute('aria-label',both(spaceNames[state.i])+' · '+both(c.summary));$('ground').setAttribute('aria-label',both(groundNames[state.i])+' · '+both(c.question));
    setText('tasktext',both(c.task));$('previous').disabled=state.i===0;$('next').disabled=state.i===5;
    Array.from($('rail').children).forEach((b,i)=>b.setAttribute('aria-current',String(i===state.i)));transcript();choicePaint();labUI();controls();updateTime(true);
  }
  function scrollLesson(){requestAnimationFrame(()=>$('lesson').scrollIntoView({behavior:qr.matches?'instant':'smooth',block:'start'}))}
  function stopLab(){state.labPlaying=false;state.timePrev=0}
  function chooseChapter(i,scroll=false,forceMode){
    if(i<0||i>5)return;video.pause();state.wantPlay=false;stopLab();state.i=i;state.mode=forceMode||state.mode;state.p=pdef[i];state.v=vdef[i];state.yaw=0;state.idx=-1;
    const url=new URL(location.href);url.searchParams.set('chapter',COURSE[i].id);history.replaceState(null,'',url);
    loadMovie(0,false);lessonText();modeUI();if(scroll)scrollLesson()
  }
  function loadMovie(at,play){
    const id=state.lang+state.i,rev=++state.rev;video.pause();state.mediaId=id;state.ready=false;state.seek=Math.max(0,Math.min(at,total()-.02));state.wantPlay=play;state.idx=-1;uiFilmTime=-1;oldScript=-1;$('mediaError').hidden=true;
    video.src='assets/audio/'+state.lang+'-'+(state.i+1)+'.m4a';video.load();video.muted=state.muted;video.playbackRate=state.speed;
    function meta(){if(rev!==state.rev)return;state.ready=true;video.currentTime=Math.min(state.seek,video.duration||total());video.playbackRate=state.speed;updateTime(true);paint();if(state.wantPlay&&state.mode==='film')playFilm()}
    video.addEventListener('loadedmetadata',meta,{once:true});if(play&&state.mode==='film')playFilm();paint();updateTime(true)
  }
  function playFilm(){state.wantPlay=true;const rev=state.rev;if(video.ended||timeNow()>=total()-.13)seekTo(0);let promise=video.play();if(promise)promise.catch(e=>{if(rev!==state.rev||e.name==='AbortError')return;state.wantPlay=false;controls();if(e.name!=='NotAllowedError')mediaFail()})}
  function toggleFilm(){if(!video.paused||state.wantPlay){video.pause();state.wantPlay=false}else playFilm();controls()}
  function seekTo(n){let v=Math.max(0,Math.min(n,total()));state.seek=v;if(state.ready){try{video.currentTime=Math.min(v,video.duration||v)}catch(e){/* Metadata will apply the seek. */}}state.idx=-1;updateTime(true);paint()}
  function mediaFail(){if(!video.error)return;$('mediaError').hidden=false;setText('mediaError',tr('此章节语音未能载入。可重新选择此章，或切到互动实验阅读讲稿。','The narration could not load. Reopen this chapter or explore the lab and transcript.'));controls()}
  function switchLang(lang){
    if(lang===state.lang)return;const phase=Astro.beatAt(chapter(),lens(),timeNow()),playing=state.mode==='film'&&(!video.paused||state.wantPlay),memory={p:state.p,v:state.v,yaw:state.yaw};
    state.lang=lang;let times=lens(),at=times.slice(0,phase.index).reduce((a,b)=>a+b,0)+phase.u*times[phase.index];Object.assign(state,memory);
    loadMovie(at,playing);translate();modeUI();
  }
  function stateAtFilm(){return Astro.beatAt(chapter(),lens(),timeNow())}
  function setMode(mode){
    if(mode===state.mode)return;
    if(mode==='lab'){const q=stateAtFilm();state.p=q.p>1?Astro.wrap(q.p):q.p;state.v=q.v;state.yaw=0;video.pause();state.wantPlay=false;stopLab()}
    else stopLab();state.mode=mode;modeUI();
  }
  function modeUI(){
    const lab=state.mode==='lab';selButton($('filmMode'),!lab);selButton($('labMode'),lab);$('filmControls').hidden=lab;$('labControls').hidden=!lab;$('capbox').hidden=lab||state.cap==='off';
    $('space').classList.toggle('can-drag',lab&&state.i<5);$('camera').hidden=state.i===5;labUI();controls();paint();updateTime(true)
  }
  function controls(){
    const playing=(!video.paused||state.wantPlay)&&!video.ended;ib('filmPlay',playing?'pause':'play',playing?tr('暂停影片','Pause film'):tr('播放影片','Play film'));ib('mute',state.muted?'mute':'volume',state.muted?tr('开启旁白','Unmute narration'):tr('静音','Mute narration'));selButton($('mute'),state.muted);
    ib('labPlay',state.labPlaying?'pause':'play',state.labPlaying?tr('暂停实验','Pause simulation'):tr('播放实验','Animate simulation'));
    const fs=Boolean(document.fullscreenElement)||state.full;for(let id of ['fs1','fs2'])ib(id,fs?'exit':'fs',fs?tr('退出全屏','Exit full screen'):tr('全屏观测','Full screen'));$('speed').value=String(state.speed);
  }
  function labUI(){
    let i=state.i,pre=$('presets');pre.replaceChildren();for(const [p,z,e] of presets[i]){
      let b=document.createElement('button');b.className='chip';b.textContent=tr(z,e);b.dataset.pos=String(p);b.onclick=()=>{stopLab();state.p=p;syncLab();controls();paint()};pre.append(b)
    }
    let out=$('options');out.replaceChildren();
    const selector=(txt,values,val,doIt)=>{let l=document.createElement('label');l.className='field';l.append(document.createTextNode(txt));let s=document.createElement('select');s.setAttribute('aria-label',txt);for(let j=0;j<values.length;j++)s.add(new Option(both(values[j]),String(j)));s.value=String(val);s.onchange=()=>{doIt(Number(s.value));syncLab();paint()};l.append(s);out.append(l)};
    if(i===1)selector(tr('地轴倾角','Axial tilt'),[['23.4°','23.4°'],['0°','0°']],state.v,v=>state.v=v);
    if(i===2)selector(tr('观测纬度','Observe from'),[['赤道','Equator'],['北回归线','Tropic of Cancer'],['南回归线','Tropic of Capricorn']],state.v,v=>state.v=v);
    if(i===3)selector(tr('月球自转','Moon spin'),[['同步自转','Synchronous'],['关闭自转','Spin off']],state.v,v=>state.v=v);
    if(i===5){selector(tr('月球位置','Moon position'),[['新月 · 日食条件','New · solar geometry'],['满月 · 月食条件','Full · lunar geometry']],state.v%2,v=>state.v=(state.v>=2?2:0)+v);
      selector(tr('对齐位置','Alignment'),[['交点附近','Near a node'],['远离交点','Far from a node']],state.v>=2?1:0,v=>state.v=(state.v%2)+2*v)}
    setText('axisName',both([['当地太阳时','Local solar time'],['公转进度','Orbital position'],['一年中的直射纬度','Subsolar latitude over a year'],['绕地公转角','Orbital angle'],['朔望月进度','Phase cycle'],['对齐进度','Alignment progress']][i]));syncLab()
  }
  function syncLab(){
    const i=state.i,p=state.p;$('axis').value=String(Math.round(p*1000));let s='';
    if(i===0){const mins=Math.round(p*1440);s=pad(Math.floor(mins/60))+':'+pad(mins%60)}
    if(i===1)s=Math.round(p*360)+'°';
    if(i===2)s=Astro.latString(Astro.decl(p),en());
    if(i===3)s=Math.round(p*360)+'°';
    if(i===4)s=(p*29.53).toFixed(1)+tr(' 天 · ',' d · ')+Astro.phaseName(p,en());
    if(i===5)s=Math.round(p*100)+'%';setText('axisValue',s);$('axis').setAttribute('aria-valuetext',s);
    for(let b of $('presets').children)selButton(b,Math.abs(Number(b.dataset.pos)-p)<.003);
    if(i===2)setText('groundName',both([['赤道 · 一米竖杆','Equator · 1 m pole'],['北回归线 · 一米竖杆','Tropic of Cancer · 1 m pole'],['南回归线 · 一米竖杆','Tropic of Capricorn · 1 m pole']][state.mode==='lab'?state.v:stateAtFilm().v]||groundNames[2]));
  }
  function updateTime(force=false){
    if(!$('scriptlist').children.length)return;
    const now=timeNow(),q=stateAtFilm();
    if(state.mode==='film'&&(force||uiFilmTime!==Math.floor(now*5))){$('seek').max=String(total());$('seek').value=String(now);setText('filmTime',fmt(now)+' / '+fmt(total()));uiFilmTime=Math.floor(now*5)}
    if(force||q.index!==state.idx){
      state.idx=q.index;let b=chapter().beats[q.index];setText('capPrimary',b[state.lang]);setText('capAlt',b[en()?'zh':'en']);$('capAlt').hidden=state.cap!=='dual';
      if(oldScript!==q.index||force){for(const [j,li] of [...$('scriptlist').children].entries())li.firstElementChild.setAttribute('aria-current',String(j===q.index));oldScript=q.index}
      if(state.mode==='film'&&state.i===2)syncLab();
    }
  }
  function blit(source){left.drawImage(source,0,0,Astro.L,Astro.H,0,0,Astro.L,Astro.H);right.drawImage(source,Astro.L,0,Astro.R,Astro.H,0,0,Astro.R,Astro.H)}
  function paint(){
    if(!render)return;let f=state.mode==='film'?stateAtFilm():state;render.draw(state.i,f.p,f.v,state.lang,state.mode==='lab'?state.yaw:0);blit(raw)
  }
  let dirtyAt=0;
  function loop(tm){
    state.raf=0;
    if(state.mode==='lab'&&state.labPlaying){if(!state.timePrev)state.timePrev=tm;if(tm-dirtyAt>42){let step=(tm-state.timePrev)/1000/(state.i===5?11:23);state.p=(state.p+Math.min(step,.06))%1;state.timePrev=tm;dirtyAt=tm;syncLab();paint()}}
    else if(state.mode==='film'&&!video.paused&&!video.ended){if(tm-dirtyAt>35){paint();updateTime();dirtyAt=tm}}
    if((state.labPlaying&&state.mode==='lab')||(!video.paused&&state.mode==='film'&&!video.ended))state.raf=requestAnimationFrame(loop)
  }
  function kick(){if(!state.raf)state.raf=requestAnimationFrame(loop)}
  function toggleLab(){state.labPlaying=!state.labPlaying;state.timePrev=0;controls();kick()}
  function resetLab(){stopLab();state.p=pdef[state.i];state.v=vdef[state.i];state.yaw=0;labUI();controls();paint()}
  async function fullscreen(){const stage=$('stage');try{if(document.fullscreenElement){await document.exitFullscreen();return}if(state.full){state.full=false;stage.classList.remove('fsexpand');controls();return}if(stage.requestFullscreen){await stage.requestFullscreen();return}}catch(e){}state.full=!state.full;stage.classList.toggle('fsexpand',state.full);controls()}
  $('startFilm').onclick=()=>{chooseChapter(0,false,'film');scrollLesson();playFilm();controls()};
  $('startLab').onclick=()=>{setMode('lab');scrollLesson()};$('langZh').onclick=()=>switchLang('zh');$('langEn').onclick=()=>switchLang('en');
  $('filmMode').onclick=()=>setMode('film');$('labMode').onclick=()=>setMode('lab');$('tryLab').onclick=()=>{setMode('lab');scrollLesson()};
  $('filmPlay').onclick=toggleFilm;$('labPlay').onclick=toggleLab;$('mute').onclick=()=>{state.muted=!state.muted;video.muted=state.muted;controls()};
  $('speed').onchange=e=>{state.speed=+e.target.value;video.playbackRate=state.speed};
  $('captions').onchange=e=>{state.cap=e.target.value;$('capbox').hidden=state.cap==='off';transcript();updateTime(true)};
  $('seek').oninput=e=>seekTo(Number(e.target.value));$('axis').oninput=e=>{stopLab();state.p=Number(e.target.value)/1000;syncLab();controls();paint()};
  $('reset').onclick=resetLab;$('camera').onclick=()=>{state.yaw=state.yaw>.65?-.72:state.yaw<-.55?0:1;paint()};
  $('previous').onclick=()=>chooseChapter(state.i-1,true);$('next').onclick=()=>chooseChapter(state.i+1,true);
  $('railPrev').onclick=()=>$('rail').scrollBy({left:-180,behavior:qr.matches?'instant':'smooth'});$('railNext').onclick=()=>$('rail').scrollBy({left:180,behavior:qr.matches?'instant':'smooth'});
  $('fs1').onclick=fullscreen;$('fs2').onclick=fullscreen;document.addEventListener('fullscreenchange',controls);
  $('transDetails').ontoggle=()=>{$('scriptClosedHelp').hidden=$('transDetails').open};
  let drag=null;
  space.addEventListener('pointerdown',e=>{if(state.mode!=='lab'||state.i===5)return;drag={id:e.pointerId,x:e.clientX,y:state.yaw};space.setPointerCapture(e.pointerId)});
  space.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;state.yaw=Math.max(-1,Math.min(1,drag.y+(e.clientX-drag.x)/(space.clientWidth*.37)));paint()});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])space.addEventListener(ev,()=>{drag=null});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.full){state.full=false;$('stage').classList.remove('fsexpand');controls();return}
    if(e.code==='Space'&&!e.repeat&&!['INPUT','SELECT','BUTTON','A','SUMMARY','TEXTAREA'].includes(e.target.tagName)){const r=$('stage').getBoundingClientRect();if(r.top<innerHeight&&r.bottom>65){e.preventDefault();state.mode==='film'?toggleFilm():toggleLab()}}});
  video.addEventListener('playing',()=>{state.wantPlay=false;controls();kick()});video.addEventListener('pause',controls);
  video.addEventListener('ended',()=>{state.wantPlay=false;controls();paint();updateTime(true)});
  for(let ev of ['loadeddata','canplay','seeked','timeupdate'])video.addEventListener(ev,()=>{if(state.mode==='film'){paint();updateTime(ev!=='timeupdate')}});
  video.addEventListener('error',mediaFail);window.addEventListener('pagehide',()=>stopLab());
  function loadImg(url){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url})}
  const hero=document.querySelector('.hero');
  if(matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches){
    hero.addEventListener('pointermove',e=>{const rect=hero.getBoundingClientRect();hero.style.setProperty('--hx',((e.clientX-rect.left)/rect.width-.5)*9+'px');hero.style.setProperty('--hy',((e.clientY-rect.top)/rect.height-.5)*5+'px')});
    hero.addEventListener('pointerleave',()=>{hero.style.removeProperty('--hx');hero.style.removeProperty('--hy')});
  }
  const params=new URLSearchParams(location.search);
  const requested=COURSE.findIndex(ch=>ch.id===params.get('chapter'));
  if(requested>=0){state.i=requested;state.p=pdef[requested];state.v=vdef[requested]}
  if(params.get('lang')==='zh')state.lang='zh';
  if(requested>=0)scrollLesson();
  $('cover').src=IMG.cover;translate();loadMovie(0,false);modeUI();Promise.all([loadImg(IMG.earth),loadImg(IMG.moon)]).then(([earth,moon])=>{render=Astro.build(raw,{earth,moon},domCanvas);paint()});
})();
