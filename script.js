/* ============================================
   PBG Officials — Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ---------- NAVBAR SCROLL EFFECT ----------
  const navbar = document.getElementById('navbar');
  const handleNavScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  };
  window.addEventListener('scroll', handleNavScroll);

  // ---------- MOBILE NAV ----------
  const hamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  // Close mobile nav on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  // ---------- ACTIVE NAV LINK ----------
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a:not(.nav-cta)');

  const updateActiveLink = () => {
    const scrollY = window.scrollY + 200;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navAnchors.forEach(a => {
          a.classList.remove('active');
          if (a.getAttribute('href') === '#' + id) {
            a.classList.add('active');
          }
        });
      }
    });
  };
  window.addEventListener('scroll', updateActiveLink);

  // ---------- HERO PARTICLES ----------
  const particlesContainer = document.getElementById('heroParticles');
  const colors = [
    'rgba(34, 211, 238, 0.6)',   // cyan
    'rgba(167, 139, 250, 0.4)',  // purple
    'rgba(45, 212, 191, 0.5)',   // teal
    'rgba(244, 114, 182, 0.3)',  // pink
  ];

  function createParticle() {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    const size = Math.random() * 6 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const duration = Math.random() * 8 + 6;
    const delay = Math.random() * 4;

    particle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${left}%;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      box-shadow: 0 0 ${size * 2}px ${color};
    `;

    particlesContainer.appendChild(particle);

    // Clean up after animation
    setTimeout(() => {
      particle.remove();
    }, (duration + delay) * 1000);
  }

  // Initial burst
  for (let i = 0; i < 30; i++) {
    createParticle();
  }

  // Continuous particles
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      createParticle();
    }
  }, 500);

  // ---------- SCROLL REVEAL ----------
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
  );

  revealElements.forEach(el => revealObserver.observe(el));

  // ---------- STAT COUNTER ANIMATION ----------
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target'));
          animateCounter(el, target);
          counterObserver.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  statNumbers.forEach(el => counterObserver.observe(el));

  function animateCounter(element, target) {
    const duration = 2000;
    const start = performance.now();
    const startVal = 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startVal + (target - startVal) * eased);
      element.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = target;
      }
    }

    requestAnimationFrame(update);
  }

  // ---------- SMOOTH SCROLL ----------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ---------- CONTACT FORM (GMAIL DISPATCH) ----------
  const contactForm = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const formStatus = document.getElementById('formStatus');

  if (contactForm && submitBtn) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = (document.getElementById('name')?.value || '').trim();
      const email = (document.getElementById('email')?.value || '').trim();
      const subject = (document.getElementById('subject')?.value || '').trim();
      const message = (document.getElementById('message')?.value || '').trim();

      if (!name || !email || !message) {
        if (formStatus) {
          formStatus.className = 'form-status error';
          formStatus.style.display = 'flex';
          formStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> <div>Please fill in all required fields (Name, Email, Message).</div>';
        }
        return;
      }

      // Button loading state
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending to Gmail...';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';
      if (formStatus) formStatus.style.display = 'none';

      try {
        const response = await fetch('https://formsubmit.co/ajax/pbgofficial143@gmail.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            email: email,
            _replyto: email,
            _subject: subject ? `[PBG Officials] ${subject}` : `New Message from ${name} (PBG Officials)`,
            message: message,
            _template: 'table',
            _captcha: 'false'
          })
        });

        const data = await response.json();

        if (response.ok && (data.success === 'true' || data.success === true || data.message)) {
          submitBtn.innerHTML = '<i class="fas fa-check"></i> Message Sent!';
          submitBtn.style.background = 'linear-gradient(135deg, #34d399, #14b8a6)';

          if (formStatus) {
            formStatus.className = 'form-status success';
            formStatus.style.display = 'flex';
            formStatus.innerHTML = '<i class="fas fa-check-circle"></i> <div><strong>Success!</strong> Your message was sent to <strong>pbgofficial143@gmail.com</strong>. We will get back to you shortly!</div>';
          }

          contactForm.reset();

          setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.background = '';
          }, 3500);
        } else {
          throw new Error(data.message || 'Submission failed');
        }
      } catch (err) {
        console.error('Contact form submission error:', err);
        submitBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to Send';
        submitBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

        const mailtoUrl = `mailto:pbgofficial143@gmail.com?subject=${encodeURIComponent(subject || 'Inquiry from PBG Officials Website')}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;

        if (formStatus) {
          formStatus.className = 'form-status error';
          formStatus.style.display = 'flex';
          formStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> <div>Automatic send error. <a href="${mailtoUrl}">Click here to open Gmail and send directly</a>.</div>`;
        }

        setTimeout(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.background = '';
        }, 4000);
      }
    });
  }

  // ---------- CARD TILT EFFECT ----------
  const cards = document.querySelectorAll('.project-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      card.style.transform = `translateY(-8px) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // ---------- TYPING EFFECT ON HERO (subtle) ----------
  const badge = document.querySelector('.hero-badge');
  if (badge) {
    const texts = [
      'Building the Future of Entertainment',
      'Anime · Manga · TV · Games · Chat',
      'Multi-Platform Digital Hub',
    ];
    let textIndex = 0;

    setInterval(() => {
      textIndex = (textIndex + 1) % texts.length;
      badge.style.opacity = '0';
      badge.style.transform = 'translateY(-10px)';

      setTimeout(() => {
        // Keep the pulse dot, update text
        badge.innerHTML = `<span class="pulse-dot"></span>${texts[textIndex]}`;
        badge.style.opacity = '1';
        badge.style.transform = 'translateY(0)';
      }, 400);
    }, 4000);
  }

  // ============================================================
  // PBG AI CHAT WIDGET CONTROLLER (NVIDIA NIM)
  // ============================================================
  const initPbgAi = () => {
    const trigger = document.getElementById('pbgAiTrigger');
    const chatWindow = document.getElementById('pbgAiChatWindow');
    const closeBtn = document.getElementById('pbgAiCloseBtn');
    const settingsBtn = document.getElementById('pbgAiSettingsBtn');
    const settingsPanel = document.getElementById('pbgAiSettingsPanel');
    const settingsClose = document.getElementById('pbgAiSettingsClose');
    const keyInput = document.getElementById('pbgAiKeyInput');
    const keyToggle = document.getElementById('pbgAiKeyToggle');
    const modelSelect = document.getElementById('pbgAiModelSelect');
    const saveSettingsBtn = document.getElementById('pbgAiSaveSettings');
    const modelLabel = document.getElementById('pbgAiModelLabel');
    const clearBtn = document.getElementById('pbgAiClearBtn');
    const messagesContainer = document.getElementById('pbgAiMessages');
    const welcomeScreen = document.getElementById('pbgAiWelcome');
    const typingIndicator = document.getElementById('pbgAiTyping');
    const inputForm = document.getElementById('pbgAiInputForm');
    const input = document.getElementById('pbgAiInput');
    const sendBtn = document.getElementById('pbgAiSendBtn');

    if (!trigger || !chatWindow) return;

    // Load Settings
    let apiKey = localStorage.getItem('pbg_ai_nvidia_key') || '';
    let currentModel = localStorage.getItem('pbg_ai_model') || 'meta/llama-3.2-11b-vision-instruct';

    // Auto-migrate if user has deprecated 410 model saved in localStorage
    if (currentModel.includes('llama-3.3') || currentModel.includes('llama-3.1') || currentModel.includes('deepseek-r1')) {
      currentModel = 'meta/llama-3.2-11b-vision-instruct';
      localStorage.setItem('pbg_ai_model', currentModel);
    }
    let conversation = [];

    // Initialize fields
    if (keyInput) keyInput.value = apiKey;
    if (modelSelect) modelSelect.value = currentModel;
    const updateModelLabel = () => {
      if (modelLabel) {
        const option = modelSelect?.querySelector(`option[value="${currentModel}"]`);
        modelLabel.textContent = option ? option.textContent.split(' (')[0] : 'Llama 3.2';
      }
    };
    updateModelLabel();

    // Toggle Chat Window
    const toggleChat = (open) => {
      const isOpen = open !== undefined ? open : !chatWindow.classList.contains('open');
      chatWindow.classList.toggle('open', isOpen);
      if (isOpen) {
        setTimeout(() => input?.focus(), 150);
      } else {
        settingsPanel?.classList.remove('open');
      }
    };

    trigger.addEventListener('click', () => toggleChat());
    closeBtn?.addEventListener('click', () => toggleChat(false));

    // Toggle Settings Panel
    settingsBtn?.addEventListener('click', () => {
      settingsPanel?.classList.toggle('open');
    });
    settingsClose?.addEventListener('click', () => {
      settingsPanel?.classList.remove('open');
    });

    // Toggle Key Visibility
    keyToggle?.addEventListener('click', () => {
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      keyToggle.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });

    // Save Settings
    saveSettingsBtn?.addEventListener('click', () => {
      apiKey = (keyInput?.value || '').trim();
      currentModel = modelSelect?.value || 'meta/llama-3.3-70b-instruct';
      localStorage.setItem('pbg_ai_nvidia_key', apiKey);
      localStorage.setItem('pbg_ai_model', currentModel);
      updateModelLabel();
      settingsPanel?.classList.remove('open');
      
      // Temporary confirmation feedback
      const originalText = saveSettingsBtn.textContent;
      saveSettingsBtn.textContent = 'Saved! ✓';
      setTimeout(() => { saveSettingsBtn.textContent = originalText; }, 1500);
    });

    // Auto-grow textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        inputForm?.dispatchEvent(new Event('submit'));
      }
    });

    // Escape HTML helper
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Lightweight Markdown Formatter
    const formatMarkdown = (rawText) => {
      let text = escapeHtml(rawText);

      // Code blocks ```lang ... ```
      text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
        const language = lang || 'code';
        return `<pre><div class="pbg-ai-code-header"><span>${language}</span><button class="pbg-ai-copy-btn" type="button" onclick="navigator.clipboard.writeText(this.closest('pre').querySelector('code').innerText); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy', 1500)"><i class="fas fa-copy"></i> Copy</button></div><code>${code.trim()}</code></pre>`;
      });

      // Inline code `code`
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Bold **text**
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Italic *text*
      text = text.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');

      // Bullet lists
      const lines = text.split('\n');
      let inList = false;
      let html = '';

      for (let line of lines) {
        const listMatch = line.match(/^\s*[\-\*]\s+(.*)$/);
        const numMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);

        if (listMatch) {
          if (!inList) { html += '<ul>'; inList = true; }
          html += `<li>${listMatch[1]}</li>`;
        } else if (numMatch) {
          if (!inList) { html += '<ol>'; inList = true; }
          html += `<li>${numMatch[2]}</li>`;
        } else {
          if (inList) { html += '</ul>'; inList = false; }
          if (line.trim().length > 0) {
            html += `<p>${line}</p>`;
          }
        }
      }
      if (inList) html += '</ul>';

      return html;
    };

    // Append Message to UI
    const appendMessage = (role, text) => {
      if (welcomeScreen) welcomeScreen.style.display = 'none';

      const msgDiv = document.createElement('div');
      msgDiv.className = `pbg-ai-msg ${role}`;

      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'pbg-ai-msg-avatar';
      avatarDiv.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-brain"></i>';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'pbg-ai-msg-content';

      if (role === 'ai') {
        contentDiv.innerHTML = formatMarkdown(text);
      } else {
        contentDiv.textContent = text;
      }

      msgDiv.appendChild(avatarDiv);
      msgDiv.appendChild(contentDiv);
      messagesContainer.appendChild(msgDiv);

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return msgDiv;
    };

    // Send message to backend
    const sendMessage = async (userText) => {
      const text = (userText || input.value || '').trim();
      if (!text) return;

      appendMessage('user', text);
      conversation.push({ role: 'user', content: text });

      input.value = '';
      input.style.height = 'auto';
      sendBtn.disabled = true;
      if (typingIndicator) typingIndicator.style.display = 'flex';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        const payload = {
          messages: conversation.slice(-10), // keep context window compact
          model: currentModel,
        };
        if (apiKey) payload.apiKey = apiKey;

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (typingIndicator) typingIndicator.style.display = 'none';
        sendBtn.disabled = false;

        if (!res.ok) {
          const errMsg = data.error || 'Failed to get response from PBG AI.';
          appendMessage('ai', `⚠️ **Error:** ${errMsg}`);
          if (res.status === 401) {
            // Open settings panel automatically so user can enter key
            settingsPanel?.classList.add('open');
          }
          return;
        }

        const reply = data.reply || 'No response received.';
        appendMessage('ai', reply);
        conversation.push({ role: 'assistant', content: reply });

      } catch (err) {
        if (typingIndicator) typingIndicator.style.display = 'none';
        sendBtn.disabled = false;
        appendMessage('ai', `⚠️ **Network Error:** Could not reach the server (${err.message}).`);
      }
    };

    // Submit handler
    inputForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage();
    });

    // Chips click handler
    document.querySelectorAll('.pbg-ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) sendMessage(prompt);
      });
    });

    // Clear Chat
    clearBtn?.addEventListener('click', () => {
      conversation = [];
      const messages = messagesContainer.querySelectorAll('.pbg-ai-msg');
      messages.forEach(m => m.remove());
      if (welcomeScreen) welcomeScreen.style.display = 'flex';
    });
  };

  initPbgAi();

});

