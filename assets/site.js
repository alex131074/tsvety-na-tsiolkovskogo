/* Поведение страницы: вывеска на прокрутке, выбор бюджета, появление блоков, отзывы, форма, панель на телефоне. */
(function () {
  var TEL = '<a href="tel:+79331860187">+7 (933) 186-01-87</a>';
  var FORM_ENDPOINT = ''; /* {{адрес приёма заявок}} */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  var hero = $('hero'), bar = $('bar'), contacts = $('contacts');

  function update() {
    var H = innerHeight, hr = hero.getBoundingClientRect(), cr = contacts.getBoundingClientRect();
    if (window.ZV) { ZV.live(hr.bottom > 0); ZV.scroll(-hr.top / Math.max(1, hr.height)); }
    bar.classList.toggle('on', hr.bottom < H * .3 && cr.top > H * .6);
  }
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
  addEventListener('resize', update);
  update();

  /* бюджет: гасим букеты дороже выбранной суммы */
  var chips = document.querySelectorAll('.chip'), tags = document.querySelectorAll('#tags li'), out = $('budgetN'), fill = $('railFill');
  var MIN = 1500, MAX = 7500;
  function word(n) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'вариант' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'варианта' : 'вариантов'; }
  function pick(max) {
    var n = 0;
    tags.forEach(function (li) { var ok = +li.getAttribute('data-p') <= max; li.classList.toggle('off', !ok); if (ok) n++; });
    chips.forEach(function (c) { var on = +c.getAttribute('data-max') === max; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
    out.textContent = max > MAX ? n + ' ' + word(n) + ' от 1700 до 7500 ₽' : n + ' ' + word(n) + ' до ' + max + ' ₽';
    fill.style.width = Math.min(100, (Math.min(max, MAX) - MIN) / (MAX - MIN) * 100) + '%';
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { pick(+c.getAttribute('data-max')); }); });
  pick(99999);

  if (!reduce && 'IntersectionObserver' in window) {
    var rise = document.querySelectorAll('.sec h2,.sec .sub,.side-q,.budget,.tags li,.steps li,.qs blockquote,.poster figure,.night-f,.extras li,.score,.rev-g:not(.rev-more) .rev,.maplink,.form');
    rise.forEach(function (el, i) { el.classList.add('rise'); });
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rise.forEach(function (el) { seen.observe(el); });
  }

  var more = $('revMore'), btn = $('revBtn');
  btn.addEventListener('click', function () {
    var o = more.classList.toggle('open');
    btn.setAttribute('aria-expanded', o);
    btn.textContent = o ? 'Свернуть отзывы' : 'Показать ещё отзывы';
  });

  var form = $('form'), msg = $('formMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ph = form.elements.phone, ok = ph.value.replace(/\D/g, '').length >= 10;
    ph.classList.toggle('invalid', !ok);
    if (!ok) { msg.textContent = 'Укажите телефон, чтобы флорист мог перезвонить.'; ph.focus(); return; }
    if (!FORM_ENDPOINT) { msg.innerHTML = 'Заявки с сайта пока не подключены, поэтому ваш номер не отправлен. Позвоните – мы на связи круглосуточно: ' + TEL; return; }
    fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) })
      .then(function (r) { if (!r.ok) throw 0; msg.textContent = 'Заявка принята, флорист скоро перезвонит.'; form.reset(); })
      .catch(function () { msg.innerHTML = 'Заявка не отправилась. Позвоните: ' + TEL; });
  });
})();
