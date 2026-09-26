const $ = selector => document.querySelector(selector);
const allowedSizes = ['XS','S','M','L','XL'];
let cart = [];
try { const saved = JSON.parse(localStorage.getItem('soul-faith-bag') || '[]'); if(Array.isArray(saved)) cart = [...new Set(saved.filter(s => allowedSizes.includes(s)))]; } catch {}
function persist(){try{localStorage.setItem('soul-faith-bag',JSON.stringify(cart));}catch{}}
function renderBag(){
 $('#bag-count').textContent=`(${cart.length})`; $('#drawer-count').textContent=`(${cart.length})`; $('#bag-items').replaceChildren();
 if(!cart.length){const p=document.createElement('p');p.className='empty-bag';p.textContent='A little room for FAITH.';const s=document.createElement('small');s.textContent='Choose your size to add the tee to your bag.';p.append(s);$('#bag-items').append(p);}
 cart.forEach(size=>{const el=document.createElement('article');el.className='cart-item';el.innerHTML=`<img src="assets/faith-front.png" alt="Faith tee" width="105" height="105"><div><h3>FAITH TEE</h3><p>JET BLACK / ${size} / QTY 1</p><p class="item-price">$75 USD</p><button type="button" aria-label="Remove Faith tee size ${size}">Remove</button></div>`;el.querySelector('button').addEventListener('click',()=>{cart=cart.filter(s=>s!==size);persist();renderBag();});$('#bag-items').append(el);});
 $('#bag-summary').hidden=!cart.length;$('#subtotal').textContent=`$${cart.length*75} USD`;
 const url=cart.length===1?window.SOUL_CHECKOUT?.[cart[0]]:'';const valid=typeof url==='string'&&/^https:\/\//.test(url);
 $('#checkout').setAttribute('aria-disabled',String(!valid));$('#checkout').textContent=valid?'CONTINUE TO CHECKOUT ↗':'CHECKOUT OPENING SOON';
 if(valid)$('#checkout').href=url;else $('#checkout').removeAttribute('href');
 $('#checkout-note').textContent=valid?'You’ll continue to secure checkout to complete your order.':'Your selection is saved in this browser. No order has been placed and no payment has been taken.';
}
$('#open-size').addEventListener('click',()=>$('#size-dialog').showModal());
$('#open-details').addEventListener('click',()=>$('#details-dialog').showModal());
$('#open-bag').addEventListener('click',()=>{renderBag();$('#bag-dialog').showModal();});
$('#add-to-bag').addEventListener('click',()=>{const size=document.querySelector('input[name="size"]:checked')?.value;if(!size){$('#size-error').textContent='Choose your size first.';document.querySelector('input[name="size"]').focus();return;}$('#size-error').textContent='';if(!cart.includes(size))cart.push(size);persist();renderBag();$('#size-dialog').close();$('#bag-dialog').showModal();});
document.querySelectorAll('input[name="size"]').forEach(i=>i.addEventListener('change',()=>$('#size-error').textContent=''));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
renderBag();

document.querySelectorAll('input[name="hero-size"]').forEach(input=>input.addEventListener('change',()=>{document.querySelector(`input[name="size"][value="${input.value}"]`).checked=true;document.querySelector('#hero-buy').innerHTML='ADD TO BAG <span>↗</span>';}));
document.querySelector('#hero-buy').addEventListener('click',()=>{if(document.querySelector('input[name="hero-size"]:checked'))document.querySelector('#add-to-bag').click();else document.querySelector('#size-dialog').showModal();});
