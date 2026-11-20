/* Shared, orthographic teaching scenes. All model angles are in radians internally. */
const Astro = (() => {
  const W = 1088, L = 688, R = 400, H = 400, PI = Math.PI, T = PI*2, D = PI/180;
  const C = {ink:'#eaf0eb', pale:'#b7cbd3', dim:'#8aa1b1', line:'#4b677c', mint:'#a3e6d4', gold:'#f6c987', blue:'#87bcf3', rust:'#e59789'};
  const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const wrap = p => ((p%1)+1)%1;
  const modEnd = p => p===1?1:wrap(p);
  const t = (en,zh,eng) => en?eng:zh;
  function path(ctx,pts,color,width=1,dash=[]) {
    if(pts.length<2)return;
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(dash);ctx.beginPath();
    pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.restore();
  }
  function area(ctx,pts,color){ctx.fillStyle=color;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}
  function ellipse(ctx,x,y,rx,ry,color,width=0,dash=[]){if(rx<=0||ry<=0)return;ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,T);if(width){ctx.strokeStyle=color;ctx.setLineDash(dash);ctx.lineWidth=width;ctx.stroke()}else{ctx.fillStyle=color;ctx.fill()}ctx.restore()}
  function glow(ctx,x,y,r,stops){if(r<1)return;let g=ctx.createRadialGradient(x,y,0,x,y,r);for(const [v,c] of stops)g.addColorStop(v,c);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
  function label(ctx,s,x,y,opt={}) {
    ctx.save();ctx.font=(opt.weight||500)+' '+(opt.size||19)+'px '+(opt.mono?'"DejaVu Sans Mono",monospace':'"Atlas Chinese","Noto Sans CJK SC","Microsoft YaHei","PingFang SC",Arial,sans-serif');
    ctx.fillStyle=opt.color||C.pale;ctx.textAlign=opt.align||'left';ctx.textBaseline='middle';
    if(opt.halo){ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle='#091423';ctx.strokeText(s,x,y)}
    ctx.fillText(s,x,y);ctx.restore();
  }
  function arrow(ctx,x,y,x2,y2,color,width=1.6,tip=7){path(ctx,[[x,y],[x2,y2]],color,width);const a=Math.atan2(y2-y,x2-x);area(ctx,[[x2,y2],[x2-tip*Math.cos(a-.53),y2-tip*Math.sin(a-.53)],[x2-tip*Math.cos(a+.53),y2-tip*Math.sin(a+.53)]],color)}
  function sun(ctx,x,y,r){glow(ctx,x,y,r*3.2,[[0,'#ffdf9cbb'],[.25,'#ffc16670'],[.55,'#f5a2481c'],[1,'#f5a24800']]);const g=ctx.createRadialGradient(x-r*.25,y-r*.38,0,x,y,r);g.addColorStop(0,'#fff9d5');g.addColorStop(.55,'#ffe5a1');g.addColorStop(.93,'#f9b866');g.addColorStop(1,'#f5a24f');ellipse(ctx,x,y,r,r,g)}
  function drawRing(ctx,cx,cy,rx,ry,color,width=1.5,dash=[]){ellipse(ctx,cx,cy,rx,ry,color,width,dash)}
  function point3(lat,rel,tilt=0,beta=0){
    const cp=Math.cos(lat),x=cp*Math.sin(rel),y=Math.sin(lat),z=cp*Math.cos(rel);
    const py=y*Math.cos(beta)-z*Math.sin(beta),pz=y*Math.sin(beta)+z*Math.cos(beta);
    return [x*Math.cos(tilt)+py*Math.sin(tilt),-x*Math.sin(tilt)+py*Math.cos(tilt),pz];
  }
  const mapCache=new Map();
  function sphereMap(r,tilt,beta){
    const key=[r,tilt.toFixed(3),beta.toFixed(3)].join('/');if(mapCache.has(key))return mapCache.get(key);
    const n=r*2+2,len=n*n;
    const nX=new Float32Array(len),nY=new Float32Array(len),nZ=new Float32Array(len),u=new Float32Array(len),v=new Float32Array(len),rim=new Float32Array(len),aa=new Uint8Array(len);
    const ct=Math.cos(tilt),st=Math.sin(tilt),cb=Math.cos(beta),sb=Math.sin(beta);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const k=j*n+i,x=(i+.5-n/2)/r,y=(n/2-j-.5)/r,rr=x*x+y*y;if(rr>=1.012/r+1)continue;
      const z=Math.sqrt(Math.max(0,1-rr)),tx=x*ct-y*st,ty=x*st+y*ct,cy=ty*cb+z*sb,cz=-ty*sb+z*cb;
      nX[k]=x;nY[k]=y;nZ[k]=z;u[k]=Math.atan2(tx,cz)/T+.5;v[k]=.5-Math.asin(clamp(cy,-1,1))/PI;
      rim[k]=(1-z)**3.1;aa[k]=Math.round(255*clamp((1-Math.sqrt(rr))*r+.5));
    }
    const m={n,nX,nY,nZ,u,v,rim,aa};if(mapCache.size>=48)mapCache.delete(mapCache.keys().next().value);mapCache.set(key,m);return m;
  }
  function readTexture(im,create){const cv=create(im.width,im.height),ctx=cv.getContext('2d');ctx.drawImage(im,0,0);return {w:im.width,h:im.height,d:ctx.getImageData(0,0,im.width,im.height).data}}
  function decl(p,flat=false){return Math.asin(Math.sin(flat?0:23.44*D)*Math.sin(T*p))/D}
  function daylight(lat,dec){return 24/PI*Math.acos(clamp(-Math.tan(lat*D)*Math.tan(dec*D),-1,1))}
  function latString(a,en){return Math.abs(a)<.049?'0.0°':Math.abs(a).toFixed(1)+'° '+(a>0?'N':'S')}
  function phaseName(p,en){
    const f=wrap(p),nearest=Math.round(f*4),near=Math.abs(f-nearest/4)<.002;
    const id=near?(nearest%4)*2:Math.floor(f*4)*2+1;
    return (en?['New Moon','Waxing crescent','First quarter','Waxing gibbous','Full Moon','Waning gibbous','Third quarter','Waning crescent']:['新月','娥眉月','上弦月','盈凸月','满月','亏凸月','下弦月','残月'])[id];
  }
  function build(canvas,images,create){
    const ctx=canvas.getContext('2d'),tex=images.earth.d?images:{earth:readTexture(images.earth,create),moon:readTexture(images.moon,create)};
    const mini=new Map(),back=[];
    const rndSeed=n=>()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296};
    function bg(w,which){
      const b=create(w,H),c=b.getContext('2d');let g=c.createLinearGradient(0,0,w,H);g.addColorStop(0,which?'#0b1927':'#071321');g.addColorStop(1,which?'#0a1421':'#101e30');c.fillStyle=g;c.fillRect(0,0,w,H);
      glow(c,w*.54,H*.52,w*.58,[[0,'#16415c30'],[1,'#18314600']]);const rn=rndSeed(which?113:152);
      for(let i=0;i<(which?77:162);i++){const x=rn()*w,y=rn()*H,r=rn();c.globalAlpha=.23+rn()*.56;ellipse(c,x,y,r>.92?1.25:.4+r*.46,r>.92?1.25:.4+r*.46,'#c4d7cf')}
      c.globalAlpha=1;return b
    }
    back.push(bg(L,false),bg(R,true));
    function ball(c,x,y,r,kind,lon,light,o={}){
      r=Math.round(r);const tilt=o.tilt||0,beta=o.beta||0,texture=tex[kind],earth=kind==='earth',m=sphereMap(r,tilt,beta);let buf=mini.get(m.n);
      if(!buf){let cv=create(m.n,m.n),cx=cv.getContext('2d');buf={cv,cx,im:cx.createImageData(m.n,m.n)};mini.set(m.n,buf)}
      const d=buf.im.data,td=texture.d,tw=texture.w,th=texture.h,shift=lon/T,lit=o.even,dim=o.dim??1,Lx=light[0],Ly=light[1],Lz=light[2],w=m.n;
      for(let k=0;k<w*w;k++){
        let a=m.aa[k],i=k*4;if(!a){d[i+3]=0;continue}
        let lu=m.u[k]+shift;lu-=Math.floor(lu);let ix=(lu*tw)|0,iy=Math.min(th-1,(m.v[k]*th)|0),q=(iy*tw+ix)*4;
        const dot=m.nX[k]*Lx+m.nY[k]*Ly+m.nZ[k]*Lz,lightVal=Math.max(0,dot);
        let b=lit?.52+.53*Math.sqrt(Math.max(0,.37*m.nX[k]+.13*m.nY[k]+.88*m.nZ[k])):(earth?.098: .045)+(earth?1.02:1.20)*Math.sqrt(lightVal);
        const rim=m.rim[k]*(earth?(.18+.7*clamp(dot+.3)):0);
        d[i]=(td[q]*b*(earth?.96:1.05)+57*rim)*dim;
        d[i+1]=(td[q+1]*b*(earth?1.04:1.03)+137*rim)*dim;
        d[i+2]=(td[q+2]*b*(earth?1.12:1.0)+210*rim)*dim;
        d[i+3]=a;
      }
      buf.cx.putImageData(buf.im,0,0);
      if(earth){const gf=c.createRadialGradient(x,y,Math.max(0,r-1),x,y,r+Math.max(3,r*.10));gf.addColorStop(0,'#72bbf095');gf.addColorStop(.20,'#4287ce55');gf.addColorStop(1,'#3e74a800');c.fillStyle=gf;c.fillRect(x-r*1.15-3,y-r*1.15-3,r*2.3+6,r*2.3+6)}
      c.drawImage(buf.cv,x-w/2,y-w/2);
    }
    function globeLine(c,x,y,r,lat,tilt,beta,col,opts={}){
      let sec=[];for(let i=-180;i<=180;i+=2){const n=point3(lat*D,i*D,tilt,beta);if(n[2]>=-.001)sec.push([x+r*n[0],y-r*n[1]]);else{if(sec.length>1)path(c,sec,col,opts.w||1.2,opts.dash||[]);sec=[]}}if(sec.length>1)path(c,sec,col,opts.w||1.2,opts.dash||[])
    }
    function pin(c,x,y,hidden=false){ellipse(c,x,y,9,9,hidden?'#dfb8818a':C.gold,1.6,hidden?[2,3]:[]);ellipse(c,x,y,3,3,hidden?'#c8ad8290':'#fff4ce')}
    function earthDay(c,p,en,yaw){
      const h=wrap(p)*24,ha=(h-12)*15*D,sa=.16-.96*Math.sin(ha)-yaw*.7,rel=sa+ha,beta=.11,lon=120.16*D-rel;
      const x=316,y=201,r=140,light=point3(0,sa,0,beta);
      ball(c,x,y,r,'earth',lon,light,{beta});globeLine(c,x,y,r,0,0,beta,'#9be5ccbd',{w:1.45});
      const np=point3(PI/2,0,0,beta);path(c,[[x,y-r*np[1]],[x,y-r*np[1]-26]],C.mint,2);path(c,[[x,y+r*np[1]],[x,y+r*np[1]+22]],C.mint,2);
      label(c,t(en,'北极','N'),x+11,y-r-18,{color:C.mint,size:17});label(c,t(en,'南极','S'),x+11,y+r+17,{color:C.mint,size:17});
      const q=point3(30.27*D,rel,0,beta),mx=x+r*q[0],my=y-r*q[1],left=mx<x,ex=left?x-r-12:x+r+14,ey=my-24;
      pin(c,mx,my,q[2]<0);path(c,[[mx+(left?-9:9),my],[ex,ey],[ex+(left?-15:15),ey]],'#f3c88bc9',1.3,q[2]<0?[3,4]:[]);
      label(c,t(en,'杭州','Hangzhou')+(q[2]<0?t(en,' · 背面',' · far side'):''),ex+(left?-19:19),ey,{align:left?'right':'left',color:C.gold,size:19,halo:true});
      const aa=point3(0,64*D,0,beta);path(c,[[x+r*aa[0],y-r*aa[1]],[x+r+29,y+39],[x+r+53,y+39]],'#82b7acc4');
      label(c,t(en,'赤道','Equator'),x+r+57,y+39,{color:C.mint,size:18});
      arrow(c,x-40,y+r+39,x+35,y+r+39,'#9bc5bd',1.3,7);label(c,t(en,'自西向东','West to east'),x-51,y+r+38,{size:16,align:'right'});
    }
    function sky(c,p,en){
      const hour=wrap(p)*24,ha=(hour-12)*PI/12,sinAlt=Math.cos(30.27*D)*Math.cos(ha),alt=Math.asin(sinAlt)/D;
      const day=clamp((alt+7)/37),tw=Math.exp(-((alt-2)**2)/215);
      const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),col=a=>'rgb('+a.map(i=>Math.round(clamp(i,0,255))).join(',')+')';
      const upper=mix([12,22,43],[30,71,112],day),low=mix(mix([28,38,62],[137,188,202],day),[235,154,107],tw*.83);
      let grad=c.createLinearGradient(0,0,0,305);grad.addColorStop(0,col(upper));grad.addColorStop(1,col(low));c.fillStyle=grad;c.fillRect(0,0,R,H);
      let rn=rndSeed(301);for(let i=0;i<58;i++){let x=rn()*R,y=rn()*216;if(day<.95){c.globalAlpha=(1-day)*.7;ellipse(c,x,y,1,1,'#dae1e4')}}c.globalAlpha=1;
      const horizon=278,mid=200;
      let trace=[];for(let i=0;i<=90;i++){const a=(i/90-.5)*PI;trace.push([mid+161*Math.sin(a),horizon-201*Math.cos(30.27*D)*Math.cos(a)])}
      path(c,trace,'#fae8bc72',1.1,[3,5]);
      const sx=mid+161*Math.sin(ha),sy=horizon-201*sinAlt;
      if(alt>-6)sun(c,sx,sy,11);
      const profile=(base,amp,shift)=>{let a=[[0,H],[0,base]];for(let x=0;x<=R+4;x+=3){let y=base+amp*(.49*Math.sin(x/43+shift)+.29*Math.sin(x/22+shift)+.19*Math.sin(x/12+shift)+.12*Math.sin(x/6));a.push([x,y])}return a.concat([[R,H]])};
      area(c,profile(288,15,3),col(mix([17,32,48],[76,110,122],day)));area(c,profile(302,9,7),col(mix([14,28,41],[57,82,90],day)));
      let water=c.createLinearGradient(0,299,0,400);water.addColorStop(0,col(mix([23,39,52],[85,126,136],day)));water.addColorStop(1,col(mix([10,20,34],[23,49,66],day)));c.fillStyle=water;c.fillRect(0,307,R,93);
      for(let k=0;k<82;k++){let x=rn()*R,y=309+rn()*88;c.globalAlpha=.12+rn()*.14;path(c,[[x,y],[x+3+rn()*15,y]],'#bbd5d4',.8)}c.globalAlpha=1;
      // A small lakeside pagoda situates the horizon in Hangzhou.
      const a=83,b=293;for(let i=0;i<4;i++){const by=b-i*5,w=9-i*1.3;area(c,[[a-w,by],[a,by-4],[a+w,by],[a+4,by+1],[a+4,by+4],[a-4,by+4],[a-4,by+1]],'#223948')}
      arrow(c,a,b-18,a,b-23,'#223948',1,2);
      label(c,t(en,'东','E'),35,259,{color:'#fff0d0',size:15,halo:true});label(c,t(en,'西','W'),366,259,{color:'#fff0d0',size:15,halo:true});
      const shade=alt<=.001?'—':(1/Math.tan(alt*D)).toFixed(1)+' m';
      label(c,t(en,'太阳高度','Solar altitude'),20,340,{color:'#d5e2e2',size:17,halo:true});label(c,(alt>0?'+':'')+alt.toFixed(0)+'°',R-20,338,{align:'right',color:'#ffde9a',size:25,halo:true,mono:true});
      label(c,t(en,'一米杆影长','Shadow of a 1 m pole'),20,374,{color:'#d5e2e2',size:17,halo:true});label(c,shade,R-20,374,{align:'right',color:C.ink,size:20,halo:true,mono:true});
    }
    function orbitPos(p,rx,ry,cx,cy,solar){let a=T*p;return solar?[cx-rx*Math.sin(a),cy-ry*Math.cos(a),-Math.cos(a)]:[cx+rx*Math.cos(a),cy-ry*Math.sin(a),-Math.sin(a)]}
    function seasonSpace(c,p,en,flat,yaw){
      const x=344,y=202,rx=235,ry=80+yaw*36,eps=flat?0:23.44*D;drawRing(c,x,y,rx,ry,'#526f82',1.6);drawRing(c,x,y,rx+8,ry+4,'#253b4d',.8,[2,7]);
      const quarterNames=en?['Mar','Jun','Sep','Dec']:['三月','六月','九月','十二月'];for(let i=0;i<4;i++){const q=orbitPos(i/4,rx,ry,x,y,true);ellipse(c,q[0],q[1],3.4,3.4,C.gold);if(i%2===0)label(c,quarterNames[i],q[0]+20,q[1]+(i===0?-14:16),{size:17,color:C.pale});else label(c,quarterNames[i],q[0]+(i===1?-25:27),q[1]+50,{size:17,align:'center',color:C.pale})}
      for(const u of [.087,.59]){const f=orbitPos(u,rx,ry,x,y,true),v=orbitPos(u+.014,rx,ry,x,y,true);arrow(c,f[0],f[1],v[0],v[1],C.mint,1.5,8)}
      sun(c,x,y,30);label(c,t(en,'太阳','Sun'),x,y+49,{align:'center',size:17,color:C.gold});
      const q=orbitPos(p,rx,ry,x,y,true),r=38,beta=Math.asin(ry/rx),s=Math.sin(p*T),z=Math.cos(p*T),cs=Math.cos(beta),ss=Math.sin(beta);
      const light=[s,-ss*z,cs*z];ball(c,q[0],q[1],r,'earth',1.9,light,{tilt:eps,beta:.07});
      let dx=Math.sin(eps)*59,dy=-Math.cos(eps)*59;path(c,[[q[0]-dx,q[1]-dy],[q[0]+dx,q[1]+dy]],C.mint,1.7);path(c,[[q[0],q[1]-r-1],[q[0],q[1]-71]],'#bdc9d588',1,[3,4]);
      label(c,flat?'0°':'23.4°',q[0]+18,q[1]-70,{size:18,color:C.mint,halo:true});
      label(c,t(en,'轨道面','Orbital plane'),x+182,y+122,{size:17,color:C.dim});
    }
    function site(c,y,lat,de,en){
      const lens=daylight(lat,de),alt=90-Math.abs(lat-de),tone=lat>0?C.mint:C.gold,tx=25,rx=179;
      label(c,lat>0?t(en,'北纬 30°','30° north'):t(en,'南纬 30°','30° south'),tx,y+4,{size:22,color:tone,weight:600});
      const start=24,end=167,groundY=y+84;path(c,[[start,groundY],[end,groundY]],'#879ba9',1.3);
      const track=[];for(let i=0;i<=48;i++){let u=i/48;track.push([start+(end-start)*u,groundY-67*Math.sin(PI*u)*Math.sin(alt*D)])}
      path(c,track,tone,1.5);sun(c,(start+end)/2,groundY-67*Math.sin(alt*D),6.4);
      label(c,t(en,'正午高度','Noon altitude'),rx+13,y+5,{size:15,color:C.dim});label(c,alt.toFixed(1)+'°',376,y+5,{size:20,align:'right',mono:true,color:C.ink});
      label(c,t(en,'白昼时长','Daylight'),rx+13,y+43,{size:15,color:C.dim});label(c,lens.toFixed(1)+' h',376,y+43,{size:20,align:'right',mono:true,color:C.ink});
      c.fillStyle='#213449';c.fillRect(rx+13,y+74,183,5);c.fillStyle=tone;c.fillRect(rx+13,y+74,183*lens/24,5);
    }
    function seasonsGround(c,p,en,flat){let de=decl(p,flat);site(c,59,30,de,en);path(c,[[23,197],[377,197]],'#304354',1);site(c,245,-30,de,en)}
    function tropicSpace(c,p,en,yaw){
      const x=301,y=216,r=122,at=23.44*D,beta=.01,view=yaw*.6,ds=decl(p)*D,light=point3(ds,-view,at,beta);
      path(c,[[98,y],[502,y]],'#6f839255',1,[4,6]);path(c,[[x,y+139],[x,y-175]],'#acbec2a0',1.4,[3,5]);
      ball(c,x,y,r,'earth',.38+view,light,{tilt:at,beta});
      const axis=[Math.sin(at),-Math.cos(at)];
      path(c,[[x-axis[0]*159,y-axis[1]*159],[x+axis[0]*162,y+axis[1]*162]],'#a6e4d0',1.65);
      const arc=[];for(let n=0;n<=26;n++){let a=at*n/26;arc.push([x+151*Math.sin(a),y-151*Math.cos(a)])}path(c,arc,C.gold,2.4);
      label(c,'23.4°',x+35,y-163,{align:'center',size:19,color:C.gold,mono:true});
      label(c,t(en,'轨道面垂线','Orbit normal'),x-12,39,{align:'right',size:16,color:C.dim});label(c,t(en,'地轴','Spin axis'),x+86,62,{size:17,color:C.mint});
      const names=en?['Cancer','Equator','Capricorn']:['北回归线','赤道','南回归线'];
      [23.44,0,-23.44].forEach((lat,i)=>{let color=i===1?C.mint:'#b7cddd';globeLine(c,x,y,r,lat,at,beta,color,{w:i===1?1.9:1.5,dash:i===1?[]:[4,3]});
        let n=point3(lat*D,70*D,at,beta),ax=x+r*n[0],ay=y-r*n[1],ey=195+i*47;
        path(c,[[ax,ay],[455,ey],[477,ey]],color,1);label(c,names[i],486,ey,{color,size:18});});
      const v=point3(ds,-view,at,beta);pin(c,x+r*v[0],y-r*v[1]);label(c,t(en,'直射纬度','Subsolar latitude'),102,365,{size:17,color:C.pale});label(c,latString(ds/D,en),279,365,{size:22,color:C.gold,mono:true});
    }
    function tropicGround(c,p,en,v){
      const lat=[0,23.44,-23.44][v]??0,de=decl(p),z=lat-de,alt=90-Math.abs(z),x=196,y=288,len=109,scale=1.08;
      const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#102237');g.addColorStop(.7,'#173348');g.addColorStop(.72,'#192e3b');g.addColorStop(1,'#0a1a29');c.fillStyle=g;c.fillRect(0,0,R,H);
      for(let i=-4;i<=4;i++)path(c,[[x+i*15,274],[x+i*67,352]],'#88abc01f',1);for(const yy of [284,298,320,351])path(c,[[15,yy],[385,yy]],'#95b2c024',1);
      const topY=y-len,ax=-Math.sin(z*D),ay=-Math.cos(z*D),sx=x+ax*187,sy=y+ay*187;
      path(c,[[x,y],[x,61]],'#b5c6d488',1,[3,5]);label(c,t(en,'天顶','Zenith'),x+13,43,{size:16,color:C.pale});
      for(let i=-1;i<2;i++)arrow(c,sx+i*15,sy,sx-ax*50+i*15,sy-ay*50,'#e9bb72a8',1.4,6);
      sun(c,sx,sy,10);const shadow=len*Math.tan(z*D);
      path(c,[[x,y],[x+shadow*scale,y]],'#09131b',8);path(c,[[x,y],[x+shadow*scale,y]],'#7eb0bd',1.6);
      path(c,[[x,y],[x,topY]],'#d8e7de',4);path(c,[[x,topY],[x+shadow*scale,y]],'#fac8879c',1.1,[3,4]);pin(c,x,y);ellipse(c,x,topY,3,3,C.ink);
      label(c,t(en,'南','S'),22,273,{color:C.dim,size:16});label(c,t(en,'北','N'),377,273,{color:C.dim,align:'right',size:16});
      label(c,t(en,'正午高度','Noon altitude'),23,337,{color:C.dim,size:16});label(c,alt.toFixed(1)+'°',374,337,{size:20,mono:true,align:'right',color:C.ink});
      label(c,t(en,'一米杆的影长','Shadow of a 1 m pole'),23,371,{color:C.dim,size:16});label(c,Math.abs(Math.tan(z*D)).toFixed(2)+' m',374,371,{size:21,mono:true,align:'right',color:C.gold});
    }
    function orbitMoon(c,p,en,locked,isPhase,yaw){
      const x=336,y=205,rx=224,ry=85+yaw*32,a=p*T,q=orbitPos(p,rx,ry,x,y,false),elev=Math.asin(clamp(ry/rx)),co=Math.cos(elev),si=Math.sin(elev);
      drawRing(c,x,y,rx,ry,'#526b80',1.65);drawRing(c,x,y,rx+9,ry+3,'#2c4153',.85,[2,6]);
      for(let i=0;i<4;i++){const k=orbitPos(i/4,rx,ry,x,y,false);ellipse(c,k[0],k[1],2.8,2.8,'#a9bfd1')}
      for(let f of [.106,.615]){const h=orbitPos(f,rx,ry,x,y,false),l=orbitPos(f+.012,rx,ry,x,y,false);arrow(c,h[0],h[1],l[0],l[1],C.mint,1.3,8)}
      if(isPhase){label(c,t(en,'太阳光','Sunlight'),647,68,{align:'right',color:C.gold,size:18});for(const h of [112,185,258])arrow(c,666,h,618,h,C.gold,1.35,7)}
      else{label(c,t(en,'固定星空','Fixed stars'),44,43,{size:17,color:C.dim});for(const b of [[124,77],[73,92],[156,53]]){path(c,[[b[0]-4,b[1]],[b[0]+4,b[1]]],'#abbdc1',.9);path(c,[[b[0],b[1]-4],[b[0],b[1]+4]],'#abbdc1',.9)}}
      const earthR=48,moonR=32;
      path(c,[[x,y],[q[0],q[1]]],isPhase?'#73899a64':'#c4ad825e',1.3,[4,6]);
      ball(c,x,y,earthR,'earth',1.84,[1,0,0],{beta:elev,even:!isPhase});
      label(c,t(en,'地球','Earth'),x,y+earthR+24,{align:'center',size:17,color:C.pale,halo:true});
      const moonSpin=locked?-a:0;ball(c,q[0],q[1],moonR,'moon',moonSpin,[1,0,0],{beta:elev,even:!isPhase});
      if(!isPhase){const wx=locked?-Math.cos(a):-1,wz=locked?Math.sin(a):0;let dx=wx,dy=wz*si,depth=wz*co;
        const fx=q[0]+dx*moonR*.85,fy=q[1]+dy*moonR*.85;pin(c,fx,fy,depth<-.2);arrow(c,q[0],q[1],q[0]+dx*54,q[1]+dy*54,C.gold,1.8,7);
        label(c,t(en,'公转角','Orbit')+'  '+Math.round(modEnd(p)*360)+'°',48,354,{size:19,color:C.pale});
        label(c,t(en,'自转角','Spin')+'  '+(locked?Math.round(modEnd(p)*360):0)+'°',362,354,{size:19,color:C.gold});
      }else{const n=phaseName(p,en);label(c,n,42,353,{color:C.gold,size:22});label(c,t(en,'月龄','Moon age')+'  '+(modEnd(p)*29.53).toFixed(1)+(en?' d':' 天'),644,354,{align:'right',size:18,color:C.pale})}
    }
    function diskView(c,p,en,locked,ph){
      const a=T*p,x=200,y=192,r=112;
      drawRing(c,x,y,r+15,r+15,'#486074',.85,[1,6]);for(const u of [0,.25,.5,.75]){let co=Math.cos(u*T),si=Math.sin(u*T);path(c,[[x+(r+12)*co,y+(r+12)*si],[x+(r+23)*co,y+(r+23)*si]],'#91a9b6',1)}
      label(c,'N',200,46,{align:'center',size:15,color:C.dim,mono:true});
      if(ph){
        ball(c,x,y,r,'moon',0,[Math.sin(a),0,-Math.cos(a)]);const frac=(1-Math.cos(a))*.5;
        label(c,t(en,'可见圆盘受光','Visible disk illuminated'),23,354,{size:17,color:C.pale});label(c,Math.round(frac*100)+'%',375,352,{align:'right',size:28,color:C.gold,mono:true});
      }else{
        const rlon=locked?0:-a;
        ball(c,x,y,r,'moon',rlon,[.5,.4,.7],{even:true});
        const z=locked?1:Math.cos(a);if(z>=0){let mx=x+Math.sin(-rlon)*r;pin(c,mx,y);if(z>.15){ellipse(c,mx,y,15,15,'#ffe0a3',1.1)}}
        const txt=z>.05?t(en,'标记朝向地球','Marker faces Earth'):z<-.05?t(en,'标记位于背面','Marker on far side'):t(en,'标记位于月缘','Marker at the limb');
        label(c,txt,x,352,{align:'center',size:20,color:z>=0?C.gold:C.dim});
      }
    }
    function shadow(c,x,y,half,x2,core,pen,y2=y){
      area(c,[[x,y-half],[x2,y2-pen],[x2,y2+pen],[x,y+half]],'#8296b735');
      area(c,[[x,y-half],[x2,y2-core],[x2,y2+core],[x,y+half]],'#02070fce');
      path(c,[[x,y-half],[x2,y2-pen]],'#b1b6ac70',1,[3,4]);path(c,[[x,y+half],[x2,y2+pen]],'#b1b6ac70',1,[3,4]);
      path(c,[[x,y-half],[x2,y2-core]],'#9faeb473',1);path(c,[[x,y+half],[x2,y2+core]],'#9faeb473',1);
    }
    function eclipseSpace(c,p,en,v){
      const lunar=v%2===1,off=v>=2,mid=167,sx=63,ex=lunar?321:505,mx=lunar?529:322,sr=36,er=33,mr=16;
      const sepX=(p-.5)*4.8,sepY=off?2.6:0,offset=Math.hypot(sepX,sepY)*(lunar?19:14)*(off||p>=.5?-1:1),my=mid+offset;
      path(c,[[84,mid],[640,mid]],'#7592a35e',1,[5,6]);
      for(let yy of [mid-37,mid+37])arrow(c,100,yy,167,yy,'#e0b8759c',1.4,6);
      sun(c,sx,mid,sr);if(lunar){shadow(c,ex,mid,er,647,22,64);ball(c,ex,mid,er,'earth',1.3,[-1,0,0]);ball(c,mx,my,mr,'moon',0,[-1,0,0],{even:true,dim:off?1:.55+.45*clamp(Math.abs(sepX)/2)})}
      else{shadow(c,mx,my,mr,587,3,59,my+(my-mid)*(587-mx)/(mx-sx));ball(c,ex,mid,er,'earth',1.65,[-1,0,0]);const landY=offset*(ex-sx)/(mx-sx);if(Math.abs(landY)<er*.92){let px=ex-er*.62*Math.sqrt(1-(landY/er)**2);ellipse(c,px,mid+landY,3.0,5.5,'#040a0ede');}ball(c,mx,my,mr,'moon',0,[-1,0,0])}
      [[sx,sr,t(en,'太阳','Sun'),C.gold],[ex,er,t(en,'地球','Earth'),C.mint],[mx,mr,t(en,'月球','Moon'),C.pale]].forEach(a=>label(c,a[2],a[0],(a[0]===mx?my:mid)+a[1]+26,{align:'center',size:18,color:a[3],halo:true}));
      label(c,t(en,'半影','Penumbra'),lunar?577:429,lunar?110:89,{align:'center',size:15,color:C.dim,halo:true});
      const px=130,py=323,dl=168;path(c,[[45,py],[371,py]],'#86a3b4',1,[3,4]);path(c,[[45,py+85*Math.tan(5.145*D)],[px+dl,py-dl*Math.tan(5.145*D)]],C.mint,2);
      path(c,[[px+112,py],[px+112,py-112*Math.tan(5.145*D)]],C.gold,1.5);pin(c,px,py);
      label(c,t(en,'交点','Node'),px,py+28,{size:16,align:'center',color:C.mint});label(c,'5.1°',px+139,py-28,{size:18,color:C.gold,mono:true});
      label(c,t(en,'月球轨道面','Lunar orbital plane'),361,299,{size:17,color:C.mint});label(c,t(en,'地球公转轨道面','Earth’s orbital plane'),361,335,{size:17,color:C.dim});
    }
    function eclipseRight(c,p,en,v){
      const lunar=v%2===1,off=v>=2,x=200,y=183,r=lunar?72:66,sepX=(p-.5)*4.8,sepY=off?2.6:0,dist=Math.hypot(sepX,sepY),rad=lunar?1.82:1.07;
      let status;
      if(lunar){
        ball(c,x,y,r,'moon',0,[0,0,1]);
        c.save();c.beginPath();c.arc(x,y,r,0,T);c.clip();
        let shadowX=x-sepX*r*1.55,shadowY=y-sepY*r*1.55,sh=r*rad;
        let g=c.createRadialGradient(shadowX,shadowY,sh*.45,shadowX,shadowY,sh*1.27);g.addColorStop(0,'#3c1713dc');g.addColorStop(.42,'#5f2a1ce3');g.addColorStop(.66,'#322325cf');g.addColorStop(1,'#473b3a00');ellipse(c,shadowX,shadowY,sh*1.27,sh*1.27,g);c.restore();
        status=dist*1.55<rad-1?t(en,'月全食','Total lunar eclipse'):dist*1.55<rad+1?t(en,'月偏食','Partial lunar eclipse'):t(en,'满月','Full Moon');
      }else{
        const total=dist<rad-1,partial=dist<rad+1;
        if(total){for(let i=0;i<90;i++){let a=i*T/90,f=1.2+.43*(.5+.5*Math.sin(i*13.38))+.28*Math.cos(2*a);path(c,[[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(a)*r*f,y+Math.sin(a)*r*f]],'#f1dfba50',1.1)}}
        glow(c,x,y,r*2.0,[[0,'#fff4d4b5'],[.5,'#ffda9fa0'],[.65,'#ffcc7e28'],[1,'#ffc07900']]);sun(c,x,y,r);
        // The silhouetted Moon is only visible against the solar disk or its immediate corona.
        c.save();c.beginPath();c.arc(x,y,r*(total?1.55:1.008),0,T);c.clip();ellipse(c,x+sepX*r,y+sepY*r,r*rad,r*rad,'#0a1320');c.restore();
        status=total?t(en,'日全食','Total solar eclipse'):partial?t(en,'日偏食','Partial solar eclipse'):t(en,'太阳无遮挡','Uncovered Sun');
      }
      label(c,status,x,330,{align:'center',size:23,color:lunar?C.mint:C.gold});label(c,off?t(en,'远离交点','Far from a node'):t(en,'交点附近','Near a node'),x,365,{align:'center',size:17,color:C.dim})
    }
    function panel(c,x,w,f){c.save();c.translate(x,0);c.beginPath();c.rect(0,0,w,H);c.clip();f();c.restore()}
    function draw(i,p,v=0,lang='zh',yaw=0){
      const e=lang==='en';ctx.drawImage(back[0],0,0);ctx.drawImage(back[1],L,0);
      panel(ctx,0,L,()=>{if(i===0)earthDay(ctx,p,e,yaw);else if(i===1)seasonSpace(ctx,p,e,Boolean(v),yaw);else if(i===2)tropicSpace(ctx,p,e,yaw);else if(i===3||i===4)orbitMoon(ctx,p,e,!v,i===4,yaw);else eclipseSpace(ctx,p,e,v)});
      panel(ctx,L,R,()=>{if(i===0)sky(ctx,p,e);else if(i===1)seasonsGround(ctx,p,e,Boolean(v));else if(i===2)tropicGround(ctx,p,e,v);else if(i===3||i===4)diskView(ctx,p,e,!v,i===4);else eclipseRight(ctx,p,e,v)});
      ctx.fillStyle='#344958';ctx.fillRect(L-1,0,1,H);
    }
    function thumbnail(i) {
      const b=create(420,154),c=b.getContext('2d');c.drawImage(back[i%2],0,0,420,154);
      const x=210,y=76;
      if(i===0){ball(c,x,y,60,'earth',1.99,[.74,.13,.46],{beta:.06});globeLine(c,x,y,60,0,0,.06,'#9be5cb99');path(c,[[x,y-73],[x,y-61]],C.mint,1.2);pin(c,x+19,y-26)}
      if(i===1){drawRing(c,x,y,125,39,'#6b8596',1.5);drawRing(c,x,y,131,42,'#35495b',1,[2,5]);sun(c,x,y,24);ball(c,x-91,y-26,21,'earth',1.4,[.88,0,.45],{tilt:.41});path(c,[[x-101,y-4],[x-80,y-52]],C.mint,1.3)}
      if(i===2){ball(c,x,y,58,'earth',.8,[-.42,.3,.74],{tilt:.41});for(let q of [-23.44,0,23.44])globeLine(c,x,y,58,q,.41,0,q?C.gold:C.mint,{w:1.9});path(c,[[x-27,y+63],[x+27,y-63]],'#bad6d1b0',1)}
      if(i===3){drawRing(c,x,y+22,99,29,'#5c7489',1.3);ball(c,x+10,y-2,53,'moon',0,[.74,.25,.57]);pin(c,x+27,y-13);ball(c,x-92,y+27,12,'earth',1.8,[.7,.3,.6]);}
      if(i===4){for(let k=0;k<5;k++){let a=(k+1)*T/8;ball(c,70+k*70,77,k===2?29:22,'moon',0,[Math.sin(a),0,-Math.cos(a)]);}}
      if(i===5){glow(c,x,y,87,[[0,'#fff6dc'],[.48,'#fff4cbe8'],[.58,'#e6ab6c6e'],[.79,'#c77b4a18'],[1,'#b8846d00']]);ellipse(c,x,y,43,43,'#f5d4a9');ellipse(c,x+1.4,y-1,42.7,42.7,'#09111c');glow(c,x-31,y+29,12,[[0,'#fffbea'],[.22,'#ffedcdcc'],[1,'#ffc49600']])}
      return b;
    }
    return {draw,thumbnail,textures:tex};
  }
  function beatAt(ch,times,time){
    let elapsed=0;for(let j=0;j<times.length;j++){const len=times[j];if(time<elapsed+len||j===times.length-1){const u=clamp((time-elapsed)/len),v=u*u*(3-2*u),b=ch.beats[j];return {index:j,u,p:b.a+(b.b-b.a)*v,v:b.v}}elapsed+=len}
  }
  return {W,L,R,H,build,beatAt,decl,daylight,phaseName,latString,wrap,modEnd};
})();
if(typeof module!=='undefined' && module.exports)module.exports=Astro;
