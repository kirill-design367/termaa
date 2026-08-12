import { chromium } from 'playwright'
import sharp from 'sharp'
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
for (const [w,h] of [[1920,1080],[2560,1440],[390,844]]) {
  const force = w>860
  const ctx=await b.newContext({viewport:{width:w,height:h},reducedMotion:'no-preference',
    ...(w<=860?{isMobile:true,hasTouch:true}:{})})
  const p=await ctx.newPage(); p.setDefaultTimeout(900000)
  const q = force ? '?steam=force&manual=1' : '?steam=off'
  await p.goto('http://127.0.0.1:8099/termaa/'+q,{waitUntil:'networkidle'})
  if (force) { await p.waitForFunction(()=>!!window.__steam,null,{timeout:30000}); await p.evaluate(()=>window.__steam.run(2,10)) }
  else await p.waitForTimeout(2500)
  const f=`/workspace/shots/rep/_wm-${w}.png`
  await p.screenshot({path:f})
  const r=await sharp(f).greyscale().raw().toBuffer({resolveWithObject:true})
  const W=r.info.width, H=r.info.height
  let minX=1e9,maxX=-1,minY=1e9
  const thr = 244
  for(let y=Math.floor(H*0.62);y<H;y++)for(let x=0;x<W;x++){
    if(r.data[y*W+x]>=thr){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y }
  }
  const vis=H-minY
  console.log(`${w}×${h}: очко ${minX}…${maxX} (поля ${minX}/${W-1-maxX}) · видно ${vis}px · полная литера ${(vis/0.85).toFixed(0)}px · срез ${((1-0.85)*100).toFixed(0)}% расчётный, замер ${(100*(vis/0.85-vis)/(vis/0.85)).toFixed(1)}%`)
  await ctx.close()
}
await b.close()
