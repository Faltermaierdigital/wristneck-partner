/**
 * Muse-Szene „Wrist & Neck“: Scroll-Ablauf in 4 Schritten (GSAP + ScrollTrigger, defer).
 * Das Markup zeigt ohne Skript das Endbild; hier werden nur die Startzustände gesetzt und per Scroll aufgelöst.
 * Mit eigenen Bildern statt Zeichnung fahren die Bilder als Ganzes ein.
 */
(() => {
  const instances = new Map();
  const me = document.currentScript;

  // GSAP nur nachladen, wenn noch keine andere Section es eingebunden hat (sonst liefe es doppelt)
  const load = (src) => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = fail;
    document.head.appendChild(s);
  });
  const ready = (async () => {
    if (!window.gsap && me) await load(me.dataset.gsap);
    if (!window.ScrollTrigger && me) await load(me.dataset.scrolltrigger);
  })();

  function init(root) {
    if (!root || instances.has(root) || !window.gsap || !window.ScrollTrigger) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // Endbild reicht

    gsap.registerPlugin(ScrollTrigger);
    // iPhone: Ein-/Ausfahren der Adressleiste ist kein echtes Resize -> nicht jedes Mal alles neu berechnen (ruckelte, Josef 06.10.2026)
    ScrollTrigger.config({ ignoreMobileResize: true });
    const q = (s) => root.querySelector(s);
    const qa = (s) => [...root.querySelectorAll(s)];
    const intro = q('.muse-split__intro');
    const chain = q('.muse-split__chain');
    const hand = q('.muse-split__hand');
    const loop = qa('.muse-split__loop');
    const bust = q('.muse-split__bust');
    const necklace = q('.muse-split__necklace');
    const closeWrist = q('.muse-split__panel--wrist .muse-split__close');
    const closeNeck = q('.muse-split__panel--neck .muse-split__close');
    const imgs = qa('.muse-split__img');
    const copies = qa('.muse-split__copy');
    const cta = q('.muse-split__cta');

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      // Bühne steht fest, solange die Sektion durchscrollt (Extra-Weg 140vh); weiches Nachziehen, damit es nicht ruckt
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true },
    });

    // Zeitplan (Anteil des Scrollwegs): Hand und Kette bekommen den größten Teil, damit man das Einfädeln sieht (Josef 02.10.: „zu schnell“)
    // 1. Muse von vorn (steht schon), 2. Kette fällt, Muse tritt zurück
    if (intro) {
      gsap.set(intro, { autoAlpha: 1 });
      tl.to(intro, { autoAlpha: 0, scale: 0.6, duration: 0.12 }, 0.06);
    }
    if (chain) tl.fromTo(chain, { scaleY: 0 }, { scaleY: 1, duration: 0.14, ease: 'none' }, 0.04);

    // 3. links: Muse mit Schlaufe erscheint, dann kommt die Hand langsam von unten durch die Schlaufe; rechts: Kette sinkt langsam auf den Hals
    if (bust) tl.fromTo(bust, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.14);
    if (loop.length) tl.fromTo(loop, { autoAlpha: 0, y: -40 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.16);
    if (hand) tl.fromTo(hand, { y: 520 }, { y: 0, duration: 0.42, ease: 'power1.out' }, 0.24);
    if (necklace) tl.fromTo(necklace, { y: -480 }, { y: 0, duration: 0.42, ease: 'power1.out' }, 0.24);
    imgs.forEach((img, k) => tl.fromTo(img, { autoAlpha: 0, y: k ? -60 : 60 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.2));
    // Schlaufe/Kette kommen geschlossen; der Teil hinter Handgelenk bzw. Nacken blendet langsam aus, während Hand bzw. Kette ankommen
    if (closeWrist) tl.fromTo(closeWrist, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: 'none' }, 0.46);
    if (closeNeck) tl.fromTo(closeNeck, { opacity: 1 }, { opacity: 0, duration: 0.18, ease: 'none' }, 0.5);

    // 4. Texte und Button
    if (copies.length) tl.fromTo(copies, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.08, stagger: 0.03 }, 0.7);
    if (cta) tl.fromTo(cta, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.07 }, 0.8);
    tl.to({}, { duration: 0.12 }, 0.88); // kurz stehen lassen, bevor die Seite weiterscrollt

    instances.set(root, tl);
  }

  function destroy(root) {
    const tl = instances.get(root);
    if (!tl) return;
    tl.scrollTrigger && tl.scrollTrigger.kill();
    tl.kill();
    instances.delete(root);
  }

  // Startpunkte neu berechnen, wenn sich die Seite danach noch verschiebt (nachladende Bilder darüber, Schriften, Handy-Leisten).
  // Sonst ist die Animation am Handy schon „durch“, bevor man ankommt, und man sieht nur das Endbild (Josef 02.10.)
  let watching = false;
  const watchLayout = () => {
    if (watching || !window.ScrollTrigger) return;
    watching = true;
    let t;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 150); };
    window.addEventListener('load', refresh, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    // Seitenhöhe geändert? Beim Scrollen und per ResizeObserver prüfen (doppelt hält besser, RO feuert nicht in jeder Umgebung)
    let lastH = document.documentElement.scrollHeight;
    const check = () => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastH) > 2) { lastH = h; refresh(); }
    };
    // nachgeladene Bilder (auch lazy) melden sich per load-Event (Capture-Phase).
    // Nur neu rechnen, wenn sich die Seitenhöhe wirklich ändert – vorher lief bei JEDEM Bild ein refresh mitten im Scrollen (Ruckeln, 06.10.2026)
    document.addEventListener('load', (e) => { if (e.target && e.target.tagName === 'IMG') check(); }, true);
    window.addEventListener('scroll', check, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(check).observe(document.body);
  };

  const boot = () => ready.then(() => { document.querySelectorAll('[data-muse-split]').forEach(init); watchLayout(); }).catch(() => {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Theme-Editor: Section neu laden / entfernen sauber behandeln
  document.addEventListener('shopify:section:load', (e) => ready.then(() => e.target.querySelectorAll('[data-muse-split]').forEach(init)));
  document.addEventListener('shopify:section:unload', (e) => e.target.querySelectorAll('[data-muse-split]').forEach(destroy));
})();
