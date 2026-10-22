import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const FPS=30, DUR=60, N=FPS*DUR;
const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','video.mp4'],{stdio:['pipe','ignore','inherit']});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+process.cwd()+'/ad.html');await p.evaluate(()=>window.fontsReady);await p.waitForTimeout(800);
for(let i=0;i<N;i++){await p.evaluate(t=>seek(t),i/FPS);const buf=await p.screenshot({type:'jpeg',quality:95});
 if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r)); if(i%150==0)console.log('frame',i);}
ff.stdin.end();await b.close();await new Promise(r=>ff.on('close',r));console.log('done');
