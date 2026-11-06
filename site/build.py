#!/usr/bin/env python3
"""Build the standalone bilingual introduction. Python 3.9+, no app build or env files."""
import argparse,html,json,re,shutil
from pathlib import Path

def inline(s,base):
 s=html.escape(s)
 def link(m):
  label,url=m.groups()
  if not url.startswith(('https://','http://','#','mailto:')):url=base+url
  return '<a href="'+url+'">'+label+'</a>'
 s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',link,s)
 s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s)
 return re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',s)

def markdown(s,base):
 out=[]
 for b in s.strip().split('\n\n'):
  if b.startswith('```'):
   out.append('<pre><code>'+html.escape('\n'.join(b.splitlines()[1:-1]))+'</code></pre>')
  elif b.startswith('- '):out.append('<ul>'+''.join('<li>'+inline(l[2:],base)+'</li>' for l in b.splitlines())+'</ul>')
  elif re.match(r'1\. ',b):out.append('<ol>'+''.join('<li>'+inline(re.sub(r'^\d+\. ','',l),base)+'</li>' for l in b.splitlines())+'</ol>')
  elif b!='---' and not b.startswith('Made by '):out.append('<p>'+inline(b,base)+'</p>')
 return '\n'.join(out)

def parse(s):
 title=re.search(r'^# (.+)$',s,re.M).group(1)
 intro=s.split('\n\n')[3]
 sections=re.split(r'^## .+$',s,flags=re.M)[1:]
 # Remove the family credit from final section.
 sections[-1]=sections[-1].split('\n---')[0]
 return title,intro,sections

def build(repo,out):
 cfg=json.loads((repo/'site/project.json').read_text());out.mkdir(parents=True,exist_ok=True)
 media=out/'media';media.mkdir(exist_ok=True)
 shutil.copy(repo/'site/style.css',out/'style.css')
 shutil.copy(repo/'docs/readme/assets/frankie.svg',media/'signature.svg')
 items=[]
 for i,a in enumerate(cfg['media']):
  source=(repo/a['src']).resolve();assert source.is_relative_to(repo.resolve()),source
  dest=f'{i+1:02d}-{source.name}';shutil.copy(source,media/dest);items.append((dest,a))
 (out/'.nojekyll').touch()
 for lang in ['en','zh']:
  zh=lang=='zh';prefix='../' if zh else './';output=out/'zh' if zh else out;output.mkdir(exist_ok=True)
  s=(repo/('README.zh-CN.md' if zh else 'README.md')).read_text();title,intro,sections=parse(s)
  base='https://github.com/'+cfg['repository']+'/blob/'+cfg['branch']+'/'
  labels=['可以做什么','使用步骤','界面与细节','本地运行','开始之前','开发与指南'] if zh else ['What it does','How to use it','In the app','Run locally','Before you start','Development & guides']
  cta=('打开应用' if zh else 'Open the app') if cfg['kind']=='online' else ('查看接入方式' if zh else 'Integration guide') if cfg['kind']=='api' else ('本地开始' if zh else 'Get started locally')
  target=cfg.get('app_url') or '#start'
  feature_items=re.findall(r'^- (.+)$',sections[0],re.M)
  features=''.join(f'<li><span class="num">0{i+1}</span><p>{inline(t,base)}</p></li>' for i,t in enumerate(feature_items))
  steps=''.join(f'<li>{html.escape(t)}</li>' for t in cfg['steps'][lang])
  gallery=[]
  for i,(dest,a) in enumerate(items):
   caption=a.get('caption',{}).get(lang,a['caption']['en'])
   if dest.endswith('.gif'):
    gallery.append(f'<figure><details><summary>{"播放真实操作动图" if zh else "Play recorded demo"}</summary><img src="{prefix}media/{dest}" alt="{html.escape(caption,quote=True)}" loading="lazy"></details><figcaption><span>0{i+1}</span> {html.escape(caption)}</figcaption></figure>')
   else:
    gallery.append(f'<figure><a href="{prefix}media/{dest}" aria-label="{html.escape(caption,quote=True)}"><img src="{prefix}media/{dest}" alt="{html.escape(caption,quote=True)}" loading="lazy"></a><figcaption><span>0{i+1}</span> {html.escape(caption)}</figcaption></figure>')
  guide=('素材更新指南' if zh else 'Updating screenshots & GIFs')
  body=f'''<!doctype html>
<html lang="{'zh-CN' if zh else 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} — Frankie</title><meta name="description" content="{html.escape(intro,quote=True)}">
<meta name="theme-color" content="{cfg['tint']}"><link rel="canonical" href="{cfg['pages_url']+('zh/' if zh else '')}">
<link rel="alternate" hreflang="en" href="{cfg['pages_url']}"><link rel="alternate" hreflang="zh-CN" href="{cfg['pages_url']}zh/">
<link rel="stylesheet" href="{prefix}style.css"><meta property="og:title" content="{html.escape(title,quote=True)}"><meta property="og:description" content="{html.escape(intro,quote=True)}"><meta property="og:type" content="website">
</head><body style="--accent:{cfg['accent']};--tint:{cfg['tint']}">
<a class="skip" href="#main">{'跳至内容' if zh else 'Skip to content'}</a>
<header class="shell"><a class="brand" href="{prefix}"><img src="{prefix}media/signature.svg" width="96" height="40" alt="Frankie"><span>{html.escape(title)}</span></a>
<nav aria-label="{'页面导航' if zh else 'Page navigation'}"><a href="#use">{labels[1]}</a><a href="https://github.com/{cfg['repository']}">GitHub</a><span class="languages"><a href="{prefix}" lang="en" {'aria-current="page"' if not zh else ''}>EN</a><a href="{prefix}zh/" lang="zh-CN" {'aria-current="page"' if zh else ''}>中文</a></span></nav></header>
<main id="main" class="shell"><section class="hero"><p class="eyebrow">{html.escape(cfg['category'][lang])}</p><h1>{html.escape(title)}</h1><div class="hero-bottom"><p class="intro">{html.escape(intro)}</p><a class="button" href="{target}">{cta}<span aria-hidden="true">↗</span></a></div></section>
<div class="hero-art"><img src="{prefix}media/{items[0][0]}" alt="{html.escape(cfg['art_note'][lang],quote=True)}" fetchpriority="high"></div><p class="art-note">{html.escape(cfg['art_note'][lang])}</p>
<section class="section"><h2><span class="index">01</span>{labels[0]}</h2><ul class="features">{features}</ul></section>
<section id="use" class="section how"><h2><span class="index">02</span>{labels[1]}</h2><ol class="steps">{steps}</ol></section>
<section class="section"><h2><span class="index">03</span>{labels[2]}</h2><div class="gallery">{''.join(gallery)}</div></section>
<section id="start" class="section split"><h2><span class="index">04</span>{labels[3]}</h2><div class="prose">{markdown(sections[1],base)}</div></section>
<section class="section split"><h2><span class="index">05</span>{labels[4]}</h2><div class="prose">{markdown(sections[2],base)}</div></section>
<section class="section split"><h2><span class="index">06</span>{labels[5]}</h2><div class="prose">{markdown(sections[3],base)}<p><a href="{base}site/GUIDE.md">{guide} ↗</a></p></div></section>
</main><footer class="shell"><span>{'由' if zh else 'Made by'} <a href="https://github.com/SonghaiFan">Songhai Fan</a> · {'Frankie 系列项目' if zh else 'A Frankie project'}</span><a href="https://github.com/{cfg['repository']}">{'源代码' if zh else 'Source code'} ↗</a></footer></body></html>'''
  (output/'index.html').write_text(body)
 print(out)
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--out',default='_site');args=ap.parse_args();repo=Path(__file__).resolve().parents[1];build(repo,Path(args.out).resolve())
