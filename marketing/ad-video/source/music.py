import numpy as np, subprocess, wave
SR=44100; D=60.0; N=int(SR*D)
rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
t=np.arange(N)/SR
def f(n): return 440*2**((n-69)/12)
def add(sig,start,gain=1.0,pan=0.0):
    i=int(start*SR); j=min(N,i+len(sig)); s=sig[:j-i]*gain
    L[i:j]+=s*np.sqrt((1-pan)/2)*1.414/1.414*(1-pan*0.5); R[i:j]+=s*(1+pan*0.5)
def lp(x,a):  # one-pole lowpass
    y=np.empty_like(x); acc=0.0
    # vectorized via lfilter-like recursion using cumulative trick is complex; use numpy loop in chunks
    from scipy.signal import lfilter
    return lfilter([a],[1,-(1-a)],x)
def env(n,a=0.01,r=0.3,total=None):
    tt=np.arange(n)/SR; e=np.minimum(1,tt/a)*np.exp(-tt/r); return e
def saw(fr,n,det=0.0):
    tt=np.arange(n)/SR; return 2*((tt*fr*(1+det))%1)-1
def pad(notes,dur,start,gain,bright=0.08):
    n=int(dur*SR); s=np.zeros(n)
    for m in notes:
        for d in (-0.004,0.0,0.005): s+=saw(f(m),n,d)
    s=lp(s,bright); tt=np.arange(n)/SR
    e=np.minimum(1,tt/0.6)*np.minimum(1,(dur-tt)/0.6).clip(0,1)
    add(s*e/len(notes)/3,start,gain)
def pluck(m,start,gain,pan=0.0,r=0.35):
    n=int(0.9*SR); tt=np.arange(n)/SR
    s=(np.sin(2*np.pi*f(m)*tt)+0.35*np.sin(4*np.pi*f(m)*tt)+0.12*np.sin(6*np.pi*f(m)*tt))*env(n,0.004,r)
    add(s,start,gain,pan)
def kick(start,gain):
    n=int(0.45*SR); tt=np.arange(n)/SR; fr=50+110*np.exp(-tt*30)
    s=np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-tt*7); add(s,start,gain)
def noise_hit(start,dur,gain,a=0.001,r=0.05,hp=True,pan=0.0):
    n=int(dur*SR); s=rng.standard_normal(n)
    if hp: s=s-lp(s,0.3)
    add(s*env(n,a,r),start,gain,pan)
def whoosh(start,dur,gain,rise=True):
    n=int(dur*SR); s=rng.standard_normal(n); tt=np.arange(n)/SR
    a=np.linspace(0.01,0.35,n) if rise else np.linspace(0.35,0.01,n)
    y=np.empty(n); acc=0.0
    for i in range(n): acc+=a[i]*(s[i]-acc); y[i]=acc
    e=np.sin(np.pi*np.minimum(1,tt/dur))**2 if not rise else (tt/dur)**2
    add(y*e,start,gain)
def boom(start,gain):
    n=int(2.5*SR); tt=np.arange(n)/SR; fr=30+70*np.exp(-tt*4)
    s=np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-tt*1.6); add(s,start,gain)
    noise_hit(start,1.5,gain*0.25,0.001,0.4,hp=False)

# --- Part A: tension 0-14.2 (A minor, slow) ---
pad([45,52,57],7.4,0.0,0.30,0.03); pad([45,53,57],7.2,7.0,0.30,0.035)
for i in range(28):                       # clock ticks
    tk=0.5*i+0.25
    if tk<14: noise_hit(tk,0.03,0.05*(1+0.5*(i%2==0)),0.0005,0.008,pan=0.4 if i%2 else -0.4)
for i in range(14): kick(i*1.0+0.5,0.22 if i<9 else 0.3)   # heartbeat-like thump
for i,m in enumerate([69,72,71,69,76,72,74,71,69,72,71,69,64,65]): pluck(m-12,0.5+i*1.0,0.06,0.3,0.6)
whoosh(12.2,2.0,0.28,rise=True)
boom(14.2,0.55)
# shimmer at reveal
for i,m in enumerate([72,76,79,84,88,91]): pluck(m,14.25+i*0.06,0.05,(i%3-1)*0.6,1.2)

# --- Part B: uplifting 14.2-60, 100 bpm ---
beat=0.6; bar=4*beat; t0=14.2
prog=[[48,55,60,64],[43,55,59,62],[45,52,57,60],[41,53,57,60]]  # C G Am F
nb=int((D-t0)/bar)+1
for b in range(nb):
    s=t0+b*bar
    if s>=58.6: break
    ch=prog[b%4]
    pad([n+12 for n in ch[1:]],bar+0.5,s,0.22 if s<17 else 0.26,0.06)
    # bass
    n=int(bar*SR); tt=np.arange(n)/SR
    for q in range(4):
        add(np.sin(2*np.pi*f(ch[0]-12)*tt[:int(beat*SR)])*env(int(beat*SR),0.005,0.4),s+q*beat,0.16 if s>=16.8 else 0.0)
    # arpeggio 8ths from 16.8
    if s>=16.6:
        arp=[ch[1]+12,ch[2]+12,ch[3]+12,ch[2]+24,ch[3]+12,ch[2]+12,ch[1]+24,ch[3]+12]
        for q,m in enumerate(arp): pluck(m,s+q*beat/2,0.055,0.5 if q%2 else -0.5,0.25)
    # drums from 22.6
    if s>=22.5:
        for q in range(4):
            if q in (0,2): kick(s+q*beat,0.42)
            if q in (1,3): noise_hit(s+q*beat,0.25,0.10,0.001,0.07,hp=True)
        for q in range(8): noise_hit(s+q*beat/2+0.0,0.06,0.03 if q%2 else 0.02,0.0005,0.015,pan=0.3)
# final chord ring
pad([60,64,67,72],2.6,57.4,0.25,0.05); pluck(72,57.45,0.08,0,1.6); pluck(79,57.5,0.06,0.3,1.6); pluck(84,57.55,0.05,-0.3,1.6)
kick(57.4,0.35); boom(57.4,0.18)
for s in (22.55,30.6,35.85,42.15,47.15,51.9): whoosh(s,0.6,0.18,rise=False)

mus=np.stack([L,R],1)
np.save('mus.npy',mus)
# load VO
starts=[0.8,5.9,14.2,22.7,30.8,36.0,42.3,47.3,52.2]
vo=np.zeros(N)
for i,s in enumerate(starts):
    raw=subprocess.run(['ffmpeg','-v','error','-i',f'vo/{i+1}.mp3','-f','s16le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
    x=np.frombuffer(raw,np.int16)/32768.0; a=int(s*SR); b=min(N,a+len(x)); vo[a:b]+=x[:b-a]
vo*=0.9/(np.abs(vo).max()+1e-9)
mus*=0.11/np.sqrt((mus**2).mean())
# ducking envelope
e=np.abs(vo); w=int(0.25*SR); e=np.convolve(e,np.ones(w)/w,'same'); act=(e>0.01).astype(float)
act=np.convolve(act,np.ones(int(0.3*SR))/int(0.3*SR),'same')
g=1.0-0.55*act
# fade in/out
fade=np.minimum(1,t/0.8)*np.minimum(1,(D-t)/1.2).clip(0,1)
mix=mus*(g*fade)[:,None] + vo[:,None]
pk=np.abs(mix).max(); print('peak',pk)
mix=np.where(np.abs(mix)>0.8,np.sign(mix)*(0.8+0.2*np.tanh((np.abs(mix)-0.8)/0.2)),mix)
mix*=0.97/np.abs(mix).max()
print('vo rms',np.sqrt((vo[vo!=0]**2).mean()),'mus rms',np.sqrt((mus**2).mean()))
out=(mix*32767).astype(np.int16)
with wave.open('audio.wav','wb') as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(out.tobytes())
print('ok')
