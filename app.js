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

// Detail photos open full size in a lightbox; Esc, the × or a click anywhere
// outside the photo closes it.
const lightbox = document.querySelector('#detail-lightbox');
const lightboxImage = lightbox.querySelector('img');
const lightboxCaption = lightbox.querySelector('figcaption');
document.querySelectorAll('.detail-open').forEach(button => button.addEventListener('click', () => {
  const image = button.querySelector('img');
  lightboxImage.src = image.currentSrc || image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = button.closest('figure').querySelector('figcaption').textContent;
  lightbox.showModal();
}));
lightbox.addEventListener('click', event => { if (event.target !== lightboxImage) lightbox.close(); });

// The turntable is a video that stays still on its first frame. Dragging over
// the tee (mouse or touch) scrubs through its 120 frames for a tactile
// front/back turn; nothing moves on its own.
const rotator = document.querySelector('#studio');
const video = document.querySelector('#tee-rotator');
const hit = rotator.querySelector('.tee-hit');
const frameCount = 233;
const fps = 24;
// One full loop takes the same 840 px of drag as the original 120-frame turntable.
const pixelsPerFrame = 840 / frameCount;
const videoWidth = 1280;
const videoHeight = 720;
// Where the tee sits inside the video, across its whole turn (floor excluded).
const teeBox = { x: 360, y: 78, width: 560, height: 566 };
let dragStart = 0;
let dragStartY = 0;
let frameAtStart = 0;
let scrubbing = false;
let activePointer = null;
let axis = null; // 'x' scrubs; 'y' is left to the browser as a normal page scroll
let rotating = false;
let pendingFrame = null;
let shownFrame = 0;
const showFrame = index => {
  shownFrame = index;
  // Seek to the middle of the frame so rounding never lands on its neighbour.
  if (video.seeking) { pendingFrame = index; return; }
  video.currentTime = (index + .5) / fps;
};
video.addEventListener('seeked', () => {
  if (pendingFrame === null) return;
  const index = pendingFrame;
  pendingFrame = null;
  showFrame(index);
});
// Keep the drag zone on the tee: follow the video's object-fit: cover crop.
const placeHit = () => {
  const box = rotator.getBoundingClientRect();
  const media = video.getBoundingClientRect();
  const scale = Math.max(media.width / videoWidth, media.height / videoHeight);
  const left = media.left - box.left + (media.width - videoWidth * scale) / 2 + teeBox.x * scale;
  const top = media.top - box.top + (media.height - videoHeight * scale) / 2 + teeBox.y * scale;
  const clipTop = Math.max(top, media.top - box.top);
  const clipBottom = Math.min(top + teeBox.height * scale, media.bottom - box.top);
  Object.assign(hit.style, { left: `${left}px`, top: `${clipTop}px`, width: `${teeBox.width * scale}px`, height: `${Math.max(0, clipBottom - clipTop)}px` });
};
new ResizeObserver(placeHit).observe(rotator);
placeHit();
// Touch decides the gesture from its first pixels: mostly horizontal scrubs,
// mostly vertical is ignored so the page scrolls (CSS touch-action: pan-y).
const axisThreshold = 10;
const beginRotate = event => {
  rotating = true;
  frameAtStart = shownFrame;
  hit.setPointerCapture(event.pointerId);
  rotator.classList.add('dragging');
};
hit.addEventListener('pointerdown', event => {
  if (activePointer !== null) return;
  activePointer = event.pointerId;
  dragStart = event.clientX;
  dragStartY = event.clientY;
  scrubbing = false;
  rotating = false;
  axis = event.pointerType === 'mouse' ? 'x' : null;
  if (axis === 'x') beginRotate(event);
});
hit.addEventListener('pointermove', event => {
  if (event.pointerId !== activePointer) return;
  const distance = event.clientX - dragStart;
  if (axis === null) {
    const dy = event.clientY - dragStartY;
    if (Math.max(Math.abs(distance), Math.abs(dy)) < axisThreshold) return;
    axis = Math.abs(distance) > Math.abs(dy) ? 'x' : 'y';
    if (axis === 'x') beginRotate(event);
  }
  if (axis !== 'x') return;
  if (Math.abs(distance) < 4) return;
  scrubbing = true;
  showFrame(((frameAtStart + Math.round(distance / pixelsPerFrame)) % frameCount + frameCount) % frameCount);
});
const endRotate = event => {
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  axis = null;
  if (!rotating) return;
  rotating = false;
  if (hit.hasPointerCapture(event.pointerId)) hit.releasePointerCapture(event.pointerId);
  rotator.classList.remove('dragging');
  if (scrubbing) event.preventDefault();
};
hit.addEventListener('pointerup', endRotate);
hit.addEventListener('pointercancel', endRotate);
// Fallback: if neither WebM nor MP4 can play, show the still poster instead.
const usePoster = () => {
  const still = new Image();
  still.id = 'tee-rotator';
  still.src = 'assets/tshirt-rotate-banner-poster.jpg?v=4';
  still.alt = 'Faith tee en un estudio';
  still.draggable = false;
  video.replaceWith(still);
  hit.remove();
};
video.addEventListener('error', usePoster);
video.querySelector('source:last-of-type').addEventListener('error', usePoster);
// app.js is deferred, so both sources may have failed before the listeners above existed.
if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) usePoster();
