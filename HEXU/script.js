/* ============================================================
   HEXU — site interactions
   - Header solidifies on scroll
   - IntersectionObserver reveal animations
   - Smooth scroll for in-page anchors
   - Contact form posts to /api/contact
   ============================================================ */

(function () {
  'use strict';

  // ----- Header scroll state -----
  const header = document.getElementById('siteHeader');
  if (header) {
    let lastScrolled = false;
    const update = () => {
      const scrolled = window.scrollY > 8;
      if (scrolled !== lastScrolled) {
        header.classList.toggle('scrolled', scrolled);
        lastScrolled = scrolled;
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  // ----- Reveal on scroll -----
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in-view'));
  }

  // ----- Smooth scroll for in-page links -----
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  });

  // ----- Contact form -----
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  if (form && status) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        industry: form.industry.value.trim(),
        product: form.product.value.trim(),
        quantity: form.quantity.value.trim(),
        timeline: form.timeline.value.trim(),
        requirements: form.requirements.value.trim(),
        additional: form.additional.value.trim(),
      };

      // Client-side validation
      if (!data.email) {
        status.textContent = 'Please provide an email address.';
        status.classList.add('error');
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
        status.textContent = 'Please provide a valid email address.';
        status.classList.add('error');
        return;
      }
      if (!data.requirements) {
        status.textContent = 'Please describe your project requirements.';
        status.classList.add('error');
        return;
      }

      status.classList.remove('error');
      status.textContent = 'Submitting…';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';
      }

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          status.textContent = json.delivered
            ? 'Thank you. Your requirement has been received — we will be in touch within one business day.'
            : 'Thank you. Your requirement has been received and recorded — we will be in touch within one business day.';
          form.reset();
        } else {
          status.textContent = (json && json.error) || 'Submission failed. Please try again or email us directly.';
          status.classList.add('error');
        }
      } catch (err) {
        status.textContent = 'Network error. Please try again or email us directly.';
        status.classList.add('error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Requirement';
        }
      }
    });
  }

  // ----- Feedback form -----
  const fbForm = document.getElementById('feedbackForm');
  const fbStatus = document.getElementById('formStatus');
  if (fbForm && fbStatus) {
    fbForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = fbForm.querySelector('button[type="submit"]');
      const data = {
        name: fbForm.name.value.trim(),
        email: fbForm.email.value.trim(),
        topic: fbForm.topic.value.trim(),
        message: fbForm.message.value.trim(),
      };

      if (!data.message) {
        fbStatus.textContent = 'Please share your feedback before sending.';
        fbStatus.classList.add('error');
        return;
      }
      if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
        fbStatus.textContent = 'Please provide a valid email address.';
        fbStatus.classList.add('error');
        return;
      }

      fbStatus.classList.remove('error');
      fbStatus.textContent = 'Sending…';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          fbStatus.textContent = json.delivered
            ? 'Thank you. Your feedback has been received — we will read it personally.'
            : 'Thank you. Your feedback has been received and recorded.';
          fbForm.reset();
        } else {
          fbStatus.textContent = (json && json.error) || 'Submission failed. Please try again or email us directly.';
          fbStatus.classList.add('error');
        }
      } catch (err) {
        fbStatus.textContent = 'Network error. Please try again or email us directly.';
        fbStatus.classList.add('error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send feedback';
        }
      }
    });
  }
})();
