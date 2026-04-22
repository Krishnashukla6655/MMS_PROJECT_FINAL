/* ═══════════════════════════════════════════════════════════════
   MMS Ultra Visual Engine — 24/7 Background Animations
   RTX-style particles, glow trails, scroll effects
   ═══════════════════════════════════════════════════════════════ */

(function() {
  // ── 1. PARTICLE CANVAS (24/7 Background) ──────────────────
  const canvas  = document.createElement('canvas');
  canvas.id     = 'mms-particles';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, particles = [], connections = [], mouse = { x: -999, y: -999 };

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Track mouse for interactive glow
  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r  = Math.random() * 2 + 0.5;
      // RTX-style colors: purple, cyan, green
      const colors = [
        [139,92,246],  // purple
        [6,182,212],   // cyan
        [16,185,129],  // emerald
        [99,102,241],  // indigo
        [244,114,182], // pink
      ];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.alpha = Math.random() * 0.5 + 0.2;
      this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.pulse += 0.015;

      // Mouse repulsion
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 120) {
        const force = (120 - dist) / 120 * 0.02;
        this.vx += dx/dist * force;
        this.vy += dy/dist * force;
      }

      // Boundary wrap
      if (this.x < -10) this.x = W + 10;
      if (this.x > W + 10) this.x = -10;
      if (this.y < -10) this.y = H + 10;
      if (this.y > H + 10) this.y = -10;

      // Damping
      this.vx *= 0.999;
      this.vy *= 0.999;
    }
    draw() {
      const glowAlpha = this.alpha * (0.6 + 0.4 * Math.sin(this.pulse));
      const [r,g,b] = this.color;

      // Glow
      ctx.beginPath();
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 8);
      grad.addColorStop(0, `rgba(${r},${g},${b},${glowAlpha * 0.4})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.arc(this.x, this.y, this.r * 8, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha})`;
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Spawn particles
  const particleCount = Math.min(80, Math.floor(W * H / 15000));
  for (let i = 0; i < particleCount; i++) particles.push(new Particle());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 150) {
          const alpha = (1 - dist/150) * 0.12;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(139,92,246,${alpha})`;
          ctx.lineWidth   = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  // Mouse glow effect
  function drawMouseGlow() {
    if (mouse.x < 0) return;
    const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200);
    grad.addColorStop(0, 'rgba(139,92,246,0.06)');
    grad.addColorStop(0.5, 'rgba(6,182,212,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(mouse.x - 200, mouse.y - 200, 400, 400);
  }

  function animateParticles() {
    ctx.clearRect(0, 0, W, H);
    drawMouseGlow();
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
  }
  animateParticles();

  // ── 2. SCROLL ANIMATIONS (Intersection Observer) ──────────
  const scrollStyle = document.createElement('style');
  scrollStyle.textContent = `
    .scroll-reveal {
      opacity: 0;
      transform: translateY(40px);
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .scroll-reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .scroll-reveal-left {
      opacity: 0;
      transform: translateX(-60px);
      transition: opacity 0.8s ease, transform 0.8s ease;
    }
    .scroll-reveal-left.visible { opacity:1; transform:translateX(0); }
    .scroll-reveal-right {
      opacity: 0;
      transform: translateX(60px);
      transition: opacity 0.8s ease, transform 0.8s ease;
    }
    .scroll-reveal-right.visible { opacity:1; transform:translateX(0); }
    .scroll-reveal-scale {
      opacity: 0;
      transform: scale(0.85);
      transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .scroll-reveal-scale.visible { opacity:1; transform:scale(1); }

    /* Parallax scroll background layers */
    .parallax-bg {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -2; pointer-events: none;
    }
    .parallax-layer {
      position: absolute; width: 100%; height: 100%;
    }
    .parallax-layer-1 {
      background: radial-gradient(ellipse at 20% 50%, rgba(139,92,246,.08) 0%, transparent 50%);
    }
    .parallax-layer-2 {
      background: radial-gradient(ellipse at 80% 30%, rgba(6,182,212,.06) 0%, transparent 50%);
    }
    .parallax-layer-3 {
      background: radial-gradient(ellipse at 50% 80%, rgba(16,185,129,.05) 0%, transparent 50%);
    }

    /* Mirror/Glass UI */
    .glass-card {
      background: rgba(21, 24, 30, 0.65) !important;
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255,255,255,0.08) !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
      position: relative;
      overflow: hidden;
    }
    .glass-card::before {
      content:'';
      position:absolute;
      top:-50%;left:-50%;width:200%;height:200%;
      background:linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.02) 100%);
      pointer-events:none;
      animation: mirrorSheen 8s ease infinite;
    }
    @keyframes mirrorSheen {
      0%,100% { transform:translateX(-30%) translateY(-30%) rotate(0deg); }
      50% { transform:translateX(30%) translateY(30%) rotate(5deg); }
    }

    /* Glow border on hover */
    .glass-card:hover {
      border-color: rgba(139,92,246,0.3) !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.08);
    }

    /* Floating orbs */
    .floating-orb {
      position: fixed; border-radius: 50%; pointer-events: none; z-index: -1;
      filter: blur(60px);
      animation: orbFloat linear infinite;
    }
    @keyframes orbFloat {
      0% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(100px, -80px) scale(1.1); }
      50% { transform: translate(-50px, -160px) scale(0.9); }
      75% { transform: translate(-100px, -60px) scale(1.05); }
      100% { transform: translate(0, 0) scale(1); }
    }
  `;
  document.head.appendChild(scrollStyle);

  // Create parallax background layers
  const parallaxBg = document.createElement('div');
  parallaxBg.className = 'parallax-bg';
  parallaxBg.innerHTML = '<div class="parallax-layer parallax-layer-1"></div><div class="parallax-layer parallax-layer-2"></div><div class="parallax-layer parallax-layer-3"></div>';
  document.body.prepend(parallaxBg);

  // Parallax scroll effect
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    const layers  = parallaxBg.querySelectorAll('.parallax-layer');
    if (layers[0]) layers[0].style.transform = `translateY(${scrollY * 0.1}px)`;
    if (layers[1]) layers[1].style.transform = `translateY(${scrollY * 0.15}px)`;
    if (layers[2]) layers[2].style.transform = `translateY(${scrollY * 0.2}px)`;
  });

  // Create floating orbs
  const orbColors = ['rgba(139,92,246,0.12)', 'rgba(6,182,212,0.1)', 'rgba(16,185,129,0.08)'];
  orbColors.forEach((color, i) => {
    const orb = document.createElement('div');
    orb.className = 'floating-orb';
    orb.style.cssText = `
      width:${200+i*100}px; height:${200+i*100}px; background:${color};
      top:${20+i*30}%; left:${10+i*30}%;
      animation-duration:${20+i*8}s; animation-delay:${i*3}s;
    `;
    document.body.appendChild(orb);
  });

  // Intersection Observer for scroll reveals
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), idx * 80);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  // Auto-apply scroll-reveal to product cards, stat cards, etc.
  setTimeout(() => {
    document.querySelectorAll('.product-card, .stat-card, .order-card, .card').forEach(el => {
      if (!el.classList.contains('scroll-reveal')) {
        el.classList.add('scroll-reveal');
      }
    });
    
    // Apply glass-card to existing cards
    document.querySelectorAll('.stat-card, .card').forEach(el => {
      el.classList.add('glass-card');
    });

    // Observe all elements that have reveal classes
    document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale').forEach(el => {
      observer.observe(el);
    });
  }, 500);

  // Re-observe after dynamic content loads
  const contentObserver = new MutationObserver(() => {
    document.querySelectorAll('.product-card:not(.scroll-reveal)').forEach(el => {
      el.classList.add('scroll-reveal');
      observer.observe(el);
    });
  });
  const grid = document.getElementById('productsGrid');
  if (grid) contentObserver.observe(grid, { childList: true });

})();
