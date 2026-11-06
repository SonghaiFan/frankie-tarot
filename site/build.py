#!/usr/bin/env python3
"""Build the independent Aura introduction. No app build, environment or live API needed."""
import argparse,html,json,shutil
from pathlib import Path
H=html.escape

def build(repo,out):
 cfg=json.loads((repo/'site/project.json').read_text());content=json.loads((repo/'site/content.json').read_text());catalog=json.loads((repo/'site/catalog-sample.json').read_text());out.mkdir(parents=True,exist_ok=True);media=out/'media';media.mkdir(exist_ok=True)
 for n in ['style.css','spreads.js']:shutil.copy(repo/'site'/n,out/n)
 for src,dest in [('docs/readme/assets/frankie.svg','signature.svg'),('docs/readme/banner.png','banner.png'),('docs/readme/assets/fool.webp','fool.webp'),('docs/readme/assets/star.webp','star.webp')]:shutil.copy(repo/src,media/dest)
 shots=['home-current.png','spreads-current.png','picking-current.png','library-current.png']
 for n in shots:shutil.copy(repo/'site/assets'/n,media/n)
 shutil.copy(repo/'site/assets/demo.gif',media/'demo.gif');(out/'.nojekyll').touch()
 for lang,c in content.items():
  zh=lang=='zh';locale='zh-CN' if zh else 'en';pre='../' if zh else './';dest=out/'zh' if zh else out;dest.mkdir(exist_ok=True)
  articles=lambda xs:''.join('<article><h3>'+H(a)+'</h3><p>'+H(b)+'</p></article>' for a,b in xs)
  samples=[{'name':s['names'][locale],'labels':s['labelsByLocale'][locale]} for s in catalog['spreads']]
  data=json.dumps(samples,ensure_ascii=False).replace('<','\\u003c')
  controls=''.join(f'<button type="button" data-spread="{i}" aria-pressed="{str(i==0).lower()}">{H(s["name"])}</button>' for i,s in enumerate(samples))
  gallery=''.join(f'<figure><a href="{pre}media/{n}"><img src="{pre}media/{n}" alt="{H(cap)}" width="1468" height="1247" loading="lazy"></a><figcaption>{H(cap)}</figcaption></figure>' for n,cap in zip(shots,c['captions']))
  title='Frankie Tarot | '+('亲手抽牌，换个角度看问题' if zh else 'A question, a spread, your cards')
  body=f'''<!doctype html><html lang="{locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{H(title)}</title><meta name="description" content="{H(c['intro'])}"><meta name="theme-color" content="#030308"><link rel="stylesheet" href="{pre}style.css"><link rel="canonical" href="{cfg['pages_url']+('zh/' if zh else '')}"><link rel="alternate" hreflang="en" href="{cfg['pages_url']}"><link rel="alternate" hreflang="zh-CN" href="{cfg['pages_url']}zh/"><meta property="og:type" content="website"><meta property="og:url" content="{cfg['pages_url']+('zh/' if zh else '')}"><meta property="og:title" content="Frankie Tarot"><meta property="og:description" content="{H(c['intro'])}"><meta property="og:image" content="{cfg['pages_url']}media/banner.png"></head><body>
<a class="skip" href="#main">{H(c['skip'])}</a><header class="shell"><a class="brand" href="{pre}"><img src="{pre}media/signature.svg" alt="Frankie" width="96" height="40"><span>TAROT</span></a><nav aria-label="{'页面导航' if zh else 'Page navigation'}"><a href="#table">{H(c['nav'][0])}</a><a href="#use">{H(c['nav'][1])}</a><a href="#screens">{H(c['nav'][2])}</a><a href="{pre}" lang="en" {'aria-current="page"' if not zh else ''}>EN</a><a href="{pre}zh/" lang="zh-CN" {'aria-current="page"' if zh else ''}>中文</a></nav></header>
<main id="main" class="shell"><section class="hero"><div><p class="eyebrow">AURA / TAROT</p><h1>{H(c['headline']).replace(chr(10),'<br>')}</h1><p class="lead">{H(c['intro'])}</p><a class="button" href="{cfg['app_url']}">{H(c['open'])} ↗</a></div><figure class="hero-screen"><img src="{pre}media/home-current.png" alt="{H(c['captions'][0])}" width="1468" height="1247" fetchpriority="high"></figure></section>
<section class="section concept" id="table"><div><h2>{H(c['concept_title'])}</h2><p class="lead">{H(c['concept'])}</p></div><div class="spread-demo"><h3>{H(c['demo_title'])}</h3><div class="spread-controls">{controls}</div><ol id="positions" aria-live="polite">{''.join('<li>'+H(x)+'</li>' for x in samples[0]['labels'])}</ol><p class="small">{H(c['demo_note'])}</p></div></section>
<section class="section"><h2>{H(c['features_title'])}</h2><div class="features">{articles(c['features'])}</div></section>
<section class="section" id="use"><h2>{H(c['workflow_title'])}</h2><ol class="steps">{''.join('<li><h3>'+H(a)+'</h3><p>'+H(b)+'</p></li>' for a,b in c['steps'])}</ol></section>
<section class="section library"><div><h2>{H(c['library_title'])}</h2><p class="lead">{H(c['library'])}</p><p class="small">{H(c['art_note'])}</p></div><div class="art"><img src="{pre}media/fool.webp" alt="{'迷幻极光的愚人牌原始图像' if zh else 'Original Dreamy Aura Fool artwork'}" width="700" height="1200" loading="lazy"><img src="{pre}media/star.webp" alt="{'迷幻极光的星星牌原始图像' if zh else 'Original Dreamy Aura Star artwork'}" width="700" height="1200" loading="lazy"></div></section>
<section class="section" id="screens"><h2>{H(c['gallery_title'])}</h2><div class="gallery">{gallery}</div><details><summary>{'播放此前录制的真实 Aura 首页动画' if zh else 'Play the previously recorded Aura homepage animation'}</summary><img src="{pre}media/demo.gif" alt="{'此前录制的真实首页动画，压缩并调整播放速度' if zh else 'Real homepage frames, compressed and retimed in an earlier recording'}" loading="lazy"></details></section>
<section class="section" id="recovery"><h2>{H(c['data_title'])}</h2><div class="features data">{articles(c['data'])}</div></section>
<section class="section runtime" id="start"><div><h2>{H(c['run_title'])}</h2><p>{H(c['run_note'])}</p><pre><code>npm ci\nnpm run dev</code></pre></div><div class="links"><a href="https://github.com/{cfg['repository']}/blob/main/site/GUIDE.md">{H(c['guide'])} ↗</a><a href="https://github.com/{cfg['repository']}/blob/main/site/AUDIT.md">{H(c['audit'])} ↗</a><a href="https://songhaifan.github.io/frankie-tarot-api/">Tarot API ↗</a></div></section></main><footer class="shell"><span>{H(c['footer'])}</span><a href="https://github.com/{cfg['repository']}">{H(c['source'])} ↗</a></footer><script id="spread-data" type="application/json">{data}</script><script src="{pre}spreads.js" defer></script></body></html>'''
  (dest/'index.html').write_text(body)
 print(out)
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--out',default='_site');a=ap.parse_args();build(Path(__file__).resolve().parents[1],Path(a.out).resolve())
