/* Ölçüm: Google Analytics + Google Ads etiketi, çerez izni çubuğu, WhatsApp / e-posta / form
   dönüşümleri ve iletişim formunun gönderimi. Kimlikler aşağıdaki IDS bloğunda; başka yerde geçmez.
   Google Ads'te yeni bir dönüşüm açılırsa etiketini (AW-…/ işaretinden sonraki kısım) buraya yazın. */
(function () {
  'use strict';
  var IDS = {
    GA_ID: 'G-V7QE4T0NH4',                 // Google Analytics ölçüm kimliği (analytics.google.com → Yönetici → Veri akışları)
    AW_ID: 'AW-18511430201',               // Google Ads etiket kimliği (Hedefler → Dönüşümler → Google etiketi)
    LABELS: {                              // Google Ads dönüşüm etiketleri (Etkinlik snippet'ini göster → send_to, "/" sonrası)
      whatsapp: 'G3ilCIGD45sdELmE-PpE',
      email: 'kSRHCISD45sdELmE-PpE',
      form: 'uUi3CIeD45sdELmE-PpE'
    },
    FORM_ENDPOINT: 'https://formspree.io/f/mvkzwbeb'                    // Formspree form adresi, ör. 'https://formspree.io/f/abcdwxyz' (boşsa form gizlenir)
  };
  var KEY = 'senkon-consent';              // localStorage: 'granted' | 'denied'

  // --- Google tag with consent mode: nothing is stored until the visitor says yes -------------------
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode: ask every visit */ }
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 });
  if (saved === 'granted') grant();
  gtag('js', new Date());
  gtag('config', IDS.GA_ID, { transport_type: 'beacon' });
  gtag('config', IDS.AW_ID, { transport_type: 'beacon' });
  var s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + IDS.GA_ID;
  document.head.appendChild(s);

  function grant() { gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' }); }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } }

  // --- consent bar ----------------------------------------------------------------------------------
  function bar() {
    var el = document.createElement('div');
    el.className = 'consent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Çerez izni');
    el.innerHTML = '<p>Ziyaretçi sayısını ölçmek için çerez kullanıyoruz. <a href="/kvkk/">Ayrıntılar</a></p>' +
      '<div class="consent-btns"><button type="button" class="btn btn-line consent-no">Reddet</button><button type="button" class="btn btn-main consent-yes">Kabul et</button></div>';
    el.querySelector('.consent-yes').addEventListener('click', function () { grant(); remember('granted'); el.remove(); });
    el.querySelector('.consent-no').addEventListener('click', function () { remember('denied'); el.remove(); });
    document.body.appendChild(el);
  }

  // --- enquiries ------------------------------------------------------------------------------------
  function conversion(label, name) {
    if (label) gtag('event', 'conversion', { send_to: IDS.AW_ID + '/' + label });
    gtag('event', name);
  }
  function onClick(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (h.indexOf('https://wa.me/') === 0) conversion(IDS.LABELS.whatsapp, 'contact_whatsapp');
    else if (h.indexOf('mailto:') === 0) conversion(IDS.LABELS.email, 'contact_email');
    else if (h.indexOf('tel:') === 0) conversion(null, 'contact_phone');
  }

  // --- contact form (Formspree, without leaving the page) -------------------------------------------
  function form() {
    var f = document.querySelector('.lead-form');
    if (!f) return;
    if (!IDS.FORM_ENDPOINT) { f.hidden = true; return; }
    f.action = IDS.FORM_ENDPOINT;
    var btn = f.querySelector('button[type="submit"]'), done = document.querySelector('.lead-done'), err = f.querySelector('.lead-err');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }   // the form is novalidate: without this, an empty phone still sends
      btn.disabled = true; if (err) err.hidden = true;
      fetch(IDS.FORM_ENDPOINT, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function () { conversion(IDS.LABELS.form, 'generate_lead'); f.hidden = true; if (done) done.hidden = false; })
        .catch(function () { btn.disabled = false; if (err) err.hidden = false; });
    });
  }

  function start() {
    if (saved !== 'granted' && saved !== 'denied') bar();
    document.addEventListener('click', onClick, true);
    form();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
