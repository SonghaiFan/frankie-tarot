// The actual API catalog's position labels, captured for a deterministic static build.
const spreads=JSON.parse(document.querySelector('#spread-data').textContent);
const buttons=[...document.querySelectorAll('[data-spread]')];
buttons.forEach(b=>b.addEventListener('click',()=>{buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelector('#positions').replaceChildren(...spreads[Number(b.dataset.spread)].labels.map(label=>{const li=document.createElement('li');li.textContent=label;return li;}));}));
