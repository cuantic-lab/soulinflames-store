const $ = selector => document.querySelector(selector);
// EDIT EACH DROP HERE. Inventory is a visual, manual value, not live stock or a reservation.
// Update this only after checking actual sales. Replace sizeGuide when the final blank is chosen.
const DROP_CONFIG = {
  stockLeft: 100, editionSize: 100,
  sizeGuide: [
    ['XXS', 59, 64, 20.5], ['XS', 61, 67, 21.5],
    ['S', 63, 71, 23], ['M', 67, 75, 24.5],
    ['L', 70, 77, 25], ['XL', 73, 79, 25.5],
    ['XXL', 77, 81, 26], ['3XL', 81, 83, 26.5]
  ]
};
// Future tee, hoodie and cap SKUs go here; each owns its own available sizes and price.
const PRODUCTS = {
  'faith-tee': { name: 'FAITH TEE', color: 'JET BLACK', price: 75, image: 'assets/faith-front.png', sizes: ['XS', 'S', 'M', 'L', 'XL'] }
};
const CART_KEY = 'soul-bag-v2';
const MAX_CART_ITEM_QUANTITY = 100;
let cart = [];
function normalizeCart(value) {
  if (!Array.isArray(value)) return [];
  const merged = new Map();
  for (const row of value) {
    const { productId, size, quantity } = row || {};
    if (!PRODUCTS[productId]?.sizes.includes(size) || !Number.isSafeInteger(quantity) || quantity < 1) continue;
    const key = `${productId}:${size}`;
    merged.set(key, { productId, size, quantity: Math.min(MAX_CART_ITEM_QUANTITY, (merged.get(key)?.quantity || 0) + quantity) });
  }
  return [...merged.values()];
}
try {
  const saved = localStorage.getItem(CART_KEY);
  if (saved) cart = normalizeCart(JSON.parse(saved));
  else {
    const legacy = JSON.parse(localStorage.getItem('soul-faith-bag') || '[]');
    if (Array.isArray(legacy)) cart = normalizeCart(legacy.map(size => ({ productId: 'faith-tee', size, quantity: 1 })));
  }
} catch {}
function persist() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} }
function itemNode(tag, className, text) {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
}
function renderBag() {
  const totalCount = cart.reduce((n, item) => n + item.quantity, 0);
  $('#bag-count').textContent = `(${totalCount})`;
  $('#drawer-count').textContent = `(${totalCount})`;
  const container = $('#bag-items'); container.replaceChildren();
  if (!cart.length) {
    const empty = itemNode('p', 'empty-bag', 'A little room for FAITH.');
    empty.append(itemNode('small', '', 'Choose your size to add the tee to your bag.'));
    container.append(empty);
  }
  for (const item of cart) {
    const product = PRODUCTS[item.productId];
    const article = itemNode('article', 'cart-item', '');
    const img = document.createElement('img'); img.src = product.image; img.alt = product.name; img.width = 105; img.height = 105;
    const content = document.createElement('div'); content.className = 'cart-item-content';
    content.append(itemNode('h3', '', product.name), itemNode('p', '', `${product.color} / ${item.size}`), itemNode('p', 'item-price', `$${product.price * item.quantity} USD`));
    const controls = itemNode('div', 'quantity-controls', '');
    for (const [label, delta] of [['−', -1], ['+', 1]]) {
      const button = itemNode('button', '', label);
      button.type = 'button'; button.setAttribute('aria-label', `${delta < 0 ? 'Decrease' : 'Increase'} ${product.name} size ${item.size} quantity`);
      button.disabled = delta < 0 ? item.quantity <= 1 : item.quantity >= MAX_CART_ITEM_QUANTITY;
      button.addEventListener('click', () => { item.quantity += delta; persist(); renderBag(); });
      controls.append(button);
      if (delta < 0) controls.append(itemNode('span', '', String(item.quantity)));
    }
    const remove = itemNode('button', 'remove-item', 'REMOVE'); remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${product.name} size ${item.size}`);
    remove.addEventListener('click', () => { cart = cart.filter(row => row !== item); persist(); renderBag(); });
    content.append(controls, remove); article.append(img, content); container.append(article);
  }
  $('#bag-summary').hidden = !cart.length;
  $('#subtotal').textContent = `$${cart.reduce((n, item) => n + PRODUCTS[item.productId].price * item.quantity, 0)} USD`;
}
function addToBag(productId, size) {
  const product = PRODUCTS[productId];
  if (!product?.sizes.includes(size)) return false;
  const existing = cart.find(item => item.productId === productId && item.size === size);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, MAX_CART_ITEM_QUANTITY);
  else cart.push({ productId, size, quantity: 1 });
  persist(); renderBag(); return true;
}
function showGuide() {
  const origin = document.querySelector('dialog[open]');
  if (origin) { origin.close(); $('#guide-dialog').dataset.returnTo = origin.id; }
  else delete $('#guide-dialog').dataset.returnTo;
  $('#guide-dialog').showModal();
}
$('#guide-dialog').addEventListener('close', () => {
  const id = $('#guide-dialog').dataset.returnTo;
  delete $('#guide-dialog').dataset.returnTo;
  if (id) document.getElementById(id).showModal();
});
document.querySelectorAll('[data-guide]').forEach(button => button.addEventListener('click', showGuide));
const rows = $('#guide-rows');
for (const [size, chest, length, sleeve] of DROP_CONFIG.sizeGuide) {
  const tr = document.createElement('tr');
  for (const [index, value] of [size, chest, length, sleeve].entries()) {
    const cell = document.createElement(index ? 'td' : 'th');
    if (!index) cell.scope = 'row';
    cell.textContent = value; tr.append(cell);
  }
  rows.append(tr);
}
document.querySelectorAll('[data-stock]').forEach(el => {
  el.textContent = `${DROP_CONFIG.stockLeft} of ${DROP_CONFIG.editionSize} pieces remain*`;
});
$('#open-size').addEventListener('click', () => $('#size-dialog').showModal());
$('#open-details').addEventListener('click', () => $('#details-dialog').showModal());
$('#open-bag').addEventListener('click', () => { renderBag(); $('#bag-dialog').showModal(); });
$('#add-to-bag').addEventListener('click', () => {
  const size = document.querySelector('input[name="size"]:checked')?.value;
  if (!size) { $('#size-error').textContent = 'Choose your size first.'; document.querySelector('input[name="size"]').focus(); return; }
  $('#size-error').textContent = '';
  addToBag('faith-tee', size);
  $('#size-dialog').close(); $('#bag-dialog').showModal();
});
document.querySelectorAll('input[name="size"]').forEach(input => input.addEventListener('change', () => $('#size-error').textContent = ''));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
}));
renderBag();
document.querySelectorAll('input[name="hero-size"]').forEach(input => input.addEventListener('change', () => {
  document.querySelector(`input[name="size"][value="${input.value}"]`).checked = true;
  $('#hero-buy').innerHTML = 'ADD TO BAG <span>↗</span>';
}));
$('#hero-buy').addEventListener('click', () => {
  if (document.querySelector('input[name="hero-size"]:checked')) $('#add-to-bag').click();
  else $('#size-dialog').showModal();
});

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
const frameCount = 216;
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
  still.src = 'assets/tshirt-rotate-banner-poster.jpg?v=3';
  still.alt = 'Faith tee en un estudio';
  still.draggable = false;
  video.replaceWith(still);
  hit.remove();
};
video.addEventListener('error', usePoster);
video.querySelector('source:last-of-type').addEventListener('error', usePoster);
// app.js is deferred, so both sources may have failed before the listeners above existed.
if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) usePoster();
