import json,re
I=json.load(open('icons.json'))
h=open('ad.tpl.html').read()
h=re.sub(r'__I:([a-z0-9-]+)__',lambda m:f'<svg class="ic" viewBox="0 0 24 24">{I[m.group(1)]}</svg>',h)
h=h.replace('__BRAND_HTML__','Argo<span class="g">Firm</span>').replace('__BRAND_TEXT__','ArgoFirm').replace('__BRAND_UP__','ARGOFIRM')
h=h.replace('<script>\n','<script>\nconst ICONS='+json.dumps(I)+';const ICON=n=>`<svg class="ic" viewBox="0 0 24 24">${ICONS[n]}</svg>`;\n',1)
open('ad.html','w').write(h)
