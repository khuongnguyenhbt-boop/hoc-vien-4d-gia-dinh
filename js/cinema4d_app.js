/**
 * Học Viện 4D Cinema Gia Đình — Bộ điều khiển Rạp Chiếu 4D Song Não (cinema4d_app.js)
 * Dùng chung kho bài học, API Key và điểm sao với index.html (localStorage).
 */
(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    SETTINGS: 'hocvien4d_settings_v1',
    LESSONS: 'hocvien4d_lessons_v1',
    STARS: 'hocvien4d_stars_v1',
    JOURNAL: 'hocvien4d_journal_v1',
    CINEMA_PREFS: 'hocvien4d_cinema_prefs_v1'
  };

  const TUTOR_PERSONAS = {
    co_giao: {
      name: '👩‍🏫 Cô Giáo Dịu Dàng',
      prompt:
        'Bạn là cô giáo tiểu học/THCS Việt Nam vô cùng dịu dàng, kiên nhẫn. Hãy giải thích thật dễ hiểu bằng ví dụ gần gũi (chia bánh, gia đình, đồ vật quen thuộc) và luôn khen ngợi khích lệ học sinh.'
    },
    khoa_hoc: {
      name: '🔬 Nhà Khoa Học Nhí',
      prompt:
        'Bạn là nhà khoa học trẻ nhiệt huyết theo phương pháp Feynman. Hãy giải thích bản chất "Tại sao lại như vậy?" một cách logic, gợi mở tò mò khoa học và liên hệ thực tế đời sống.'
    },
    ke_chuyen: {
      name: '📖 Người Kể Chuyện',
      prompt:
        'Bạn là người kể chuyện truyền cảm giàu chất văn học và lịch sử. Hãy biến kiến thức bài học thành một câu chuyện ngắn sinh động, giàu hình ảnh để học sinh nhớ mãi không quên.'
    },
    luyen_thi: {
      name: '🎯 Huấn Luyện Viên Luyện Tập',
      prompt:
        'Bạn là huấn luyện viên tư duy sắc bén. Hãy chỉ ra lỗi sai học sinh hay mắc nhất, mẹo nhớ nhanh và ra thêm 1 bài tập ngắn kèm hướng dẫn từng bước.'
    }
  };

  const state = {
    activeGrade: 4,
    lessons: [],
    activeLessonId: null,
    activeSlideIndex: 0,
    quizAnsweredMap: {},
    starsByGrade: { 4: 0, 7: 0, 10: 0 },
    journalByGrade: { 4: [], 7: [], 10: [] },
    prefs: {
      theme: 'cinema', // cinema | light | sketch
      fontScale: 1,
      leftWidthPct: 51
    },
    settings: {
      geminiApiKey: '',
      geminiModel: 'gemini-3.5-flash-lite',
      youtubeApiKey: '',
      pixabayApiKey: '',
      voiceId: 'ai_co_minh_chau',
      voiceRate: 1
    },
    drawerTab: 'slides', // slides | library
    tutor: {
      persona: 'co_giao',
      messages: [],
      loading: false
    },
    factory: {
      grade: 4,
      slideCount: 6,
      attachments: [],
      isGenerating: false,
      draftLesson: null
    },
    mediaPicker: {
      target: null
    }
  };

  const dom = {};
  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function showToast(msg) {
    if (!dom.toast) return;
    dom.toast.textContent = msg;
    dom.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.add('hidden'), 3400);
  }

  /* ==================== STORAGE ==================== */
  function loadStorage() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || 'null');
      if (s && typeof s === 'object') Object.assign(state.settings, s);
      // Tự động nâng cấp model cũ bị Google khóa (404) sang gemini-3.5-flash-lite
      if (['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'].includes(state.settings.geminiModel)) {
        state.settings.geminiModel = 'gemini-3.5-flash-lite';
      }
    } catch (_e) {}

    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.CINEMA_PREFS) || 'null');
      if (p && typeof p === 'object') Object.assign(state.prefs, p);
    } catch (_e) {}

    try {
      const st = JSON.parse(localStorage.getItem(STORAGE_KEYS.STARS) || 'null');
      if (st && typeof st === 'object') Object.assign(state.starsByGrade, st);
    } catch (_e) {}

    try {
      const j = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || 'null');
      if (j && typeof j === 'object') Object.assign(state.journalByGrade, j);
    } catch (_e) {}

    try {
      const ls = JSON.parse(localStorage.getItem(STORAGE_KEYS.LESSONS) || 'null');
      if (Array.isArray(ls) && ls.length > 0) {
        state.lessons = ls;
      } else {
        state.lessons = JSON.parse(JSON.stringify(global.SAMPLE_LESSONS || []));
      }
    } catch (_e) {
      state.lessons = JSON.parse(JSON.stringify(global.SAMPLE_LESSONS || []));
    }

    for (const sample of global.SAMPLE_LESSONS || []) {
      if (!state.lessons.some((l) => Number(l.grade) === Number(sample.grade))) {
        state.lessons.push(JSON.parse(JSON.stringify(sample)));
      }
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings)); } catch (_e) {}
  }

  function savePrefs() {
    try { localStorage.setItem(STORAGE_KEYS.CINEMA_PREFS, JSON.stringify(state.prefs)); } catch (_e) {}
  }

  function saveLessons() {
    try { localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(state.lessons)); } catch (_e) {
      showToast('⚠️ Bộ nhớ trình duyệt gần đầy — hãy tải JSON sao lưu bài giảng nhé!');
    }
  }

  function saveStars() {
    try { localStorage.setItem(STORAGE_KEYS.STARS, JSON.stringify(state.starsByGrade)); } catch (_e) {}
  }

  function saveJournal() {
    try { localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(state.journalByGrade)); } catch (_e) {}
  }

  function getLessonsForGrade(grade) {
    return state.lessons.filter((l) => Number(l.grade) === Number(grade));
  }

  function getActiveLesson() {
    let lesson = state.lessons.find((l) => l.id === state.activeLessonId);
    if (!lesson) {
      const list = getLessonsForGrade(state.activeGrade);
      lesson = list[0] || state.lessons[0] || null;
      if (lesson) {
        state.activeLessonId = lesson.id;
        state.activeSlideIndex = 0;
      }
    }
    return lesson;
  }

  /* ==================== THEME & FONT SCALE & SPLITTER ==================== */
  function applyTheme(theme) {
    state.prefs.theme = theme || 'cinema';
    document.body.classList.remove('theme-cinema', 'theme-light', 'theme-sketch');
    document.body.classList.add(`theme-${state.prefs.theme}`);
    document.querySelectorAll('[data-art-theme]').forEach((b) => {
      b.classList.toggle('active', b.dataset.artTheme === state.prefs.theme);
    });
    savePrefs();
  }

  function applyFontScale(scale) {
    const clamped = Math.max(0.85, Math.min(1.4, Number(scale) || 1));
    state.prefs.fontScale = Math.round(clamped * 100) / 100;
    document.documentElement.style.setProperty('--font-scale', String(state.prefs.fontScale));
    if (dom.btnFontReset) {
      dom.btnFontReset.textContent = `${Math.round(state.prefs.fontScale * 100)}%`;
    }
    savePrefs();
  }

  function initStageSplitter() {
    if (!dom.stageSplitter || !dom.leftCol || !dom.stageContainer) return;
    if (state.prefs.leftWidthPct) {
      dom.leftCol.style.width = `${state.prefs.leftWidthPct}%`;
    }
    let dragging = false;
    dom.stageSplitter.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      dom.stageSplitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
    });
    global.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = dom.stageContainer.getBoundingClientRect();
      const pct = Math.max(34, Math.min(68, ((e.clientX - rect.left) / rect.width) * 100));
      state.prefs.leftWidthPct = Math.round(pct * 10) / 10;
      dom.leftCol.style.width = `${state.prefs.leftWidthPct}%`;
    });
    global.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      dom.stageSplitter.classList.remove('dragging');
      document.body.style.cursor = '';
      savePrefs();
    });
  }

  /* ==================== YOUTUBE INLINE PLAYER + MEDIA ==================== */
  let activeYtPlayer = null;
  let ytApiPromise = null;
  let currentVideoSpeed = 1;

  function destroyActiveYtPlayer() {
    if (activeYtPlayer) {
      try {
        if (typeof activeYtPlayer.destroy === 'function') activeYtPlayer.destroy();
      } catch (_e) {}
      activeYtPlayer = null;
    }
  }

  function ensureYouTubeApiReady() {
    if (global.YT && typeof global.YT.Player === 'function') return Promise.resolve(global.YT);
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 6000);
      const prev = global.onYouTubeIframeAPIReady;
      global.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        if (typeof prev === 'function') try { prev(); } catch (_e) {}
        resolve(global.YT);
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.onerror = () => { clearTimeout(timer); reject(new Error('load failed')); };
        document.head.appendChild(s);
      }
    });
    return ytApiPromise;
  }

  function renderSanitizedSvg(container, slide) {
    const safeSvg = global.MediaFinder.sanitizeSVG(slide.fallback_svg, slide.heading, slide.heart_message);
    const host = document.createElement('div');
    host.className = 'media-svg-host';
    host.innerHTML = safeSvg;
    container.innerHTML = '';
    container.appendChild(host);
  }

  function renderYouTubeFileFallback(container, videoId, slide) {
    const watchUrl = global.MediaFinder.buildYouTubeWatchUrl(videoId);
    const thumb = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
    container.innerHTML = `
      <div class="yt-poster-card">
        <img class="yt-poster-img" src="${escapeHtml(thumb)}" alt="${escapeHtml(slide.heading)}" />
        <div class="yt-poster-overlay">
          <a class="yt-play-btn" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">▶</a>
          <strong style="font-size:15px;">${escapeHtml(slide.media_title || slide.heading)}</strong>
          <div style="font-size:12px;color:#e2e8f0;max-width:460px;">
            Đang mở tệp trực tiếp (file://). Chạy <strong>Mo_HocVien4D_Cinema.bat</strong> để phát YouTube trực tiếp ngay trong khung chiếu 4D!
          </div>
        </div>
      </div>
    `;
  }

  function mountInlineYouTube(container, videoId, slide, triedIds) {
    destroyActiveYtPlayer();
    const tried = triedIds instanceof Set ? triedIds : new Set();
    tried.add(videoId);

    if (global.location && global.location.protocol === 'file:') {
      renderYouTubeFileFallback(container, videoId, slide);
      return;
    }

    const iframeId = `yt_c4d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.setAttribute('referrerpolicy', 'origin');
    iframe.referrerPolicy = 'origin';
    iframe.setAttribute('frameborder', '0');
    iframe.title = slide.media_title || slide.heading || 'Video minh họa';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    iframe.allowFullscreen = true;
    iframe.src = global.MediaFinder.buildYouTubeEmbedUrl(videoId);

    container.innerHTML = '';
    container.appendChild(iframe);

    ensureYouTubeApiReady()
      .then((YT) => {
        if (!document.getElementById(iframeId)) return;
        activeYtPlayer = new YT.Player(iframeId, {
          events: {
            onReady: (ev) => {
              if (currentVideoSpeed !== 1 && ev.target && typeof ev.target.setPlaybackRate === 'function') {
                try { ev.target.setPlaybackRate(currentVideoSpeed); } catch (_e) {}
              }
            },
            onError: (ev) => {
              const code = ev && ev.data;
              const videos = (slide.media_candidates && slide.media_candidates.videos) || [];
              const nextIdx = videos.findIndex((v) => v && v.id && !tried.has(v.id));
              if (nextIdx !== -1 && code !== 153) {
                const nextV = videos[nextIdx];
                slide.media_url = nextV.embedUrl || global.MediaFinder.buildYouTubeEmbedUrl(nextV.id);
                slide.media_title = nextV.title;
                slide.media_video_index = nextIdx;
                slide.media_source = `YouTube An Toàn (Video ${nextIdx + 1}/${videos.length})`;
                saveLessons();
                dom.mediaSourceLabel.textContent = `📺 ${slide.media_source}`;
                dom.btnExternalYt.href = global.MediaFinder.buildYouTubeWatchUrl(nextV.id);
                showToast('🔄 Tự động đổi sang video YouTube dự phòng ngay trên màn hình!');
                mountInlineYouTube(container, nextV.id, slide, tried);
              }
            }
          }
        });
      })
      .catch(() => {});
  }

  function renderSlideMedia(container, slide) {
    destroyActiveYtPlayer();
    container.innerHTML = '';

    if (slide.media_type === 'youtube' && slide.media_url) {
      const vid = global.MediaFinder.parseYouTubeId(slide.media_url);
      if (vid) {
        mountInlineYouTube(container, vid, slide);
        return;
      }
    }

    if (slide.media_type === 'image' && slide.media_url) {
      const img = document.createElement('img');
      img.src = slide.media_url;
      img.alt = slide.media_title || slide.heading || 'Ảnh minh họa';
      img.onerror = () => renderSanitizedSvg(container, slide);
      container.appendChild(img);
      return;
    }

    renderSanitizedSvg(container, slide);
  }

  /* ==================== VOICE STUDIO CINEMA BAR ==================== */
  function populateVoices() {
    if (!dom.voicePersonaSelect || !global.VoiceStudio) return;
    const prev = state.settings.voiceId || 'ai_co_minh_chau';
    dom.voicePersonaSelect.innerHTML = '';

    const aiGroup = document.createElement('optgroup');
    aiGroup.label = '🌟 Giọng AI Người Việt Truyền Cảm (Gemini Studio)';
    global.VoiceStudio.AI_PERSONAS.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      aiGroup.appendChild(opt);
    });
    dom.voicePersonaSelect.appendChild(aiGroup);

    const bGroup = document.createElement('optgroup');
    bGroup.label = '💻 Giọng Việt Tự Nhiên Trình Duyệt (Miễn phí / Ngoại tuyến)';
    const bVoices = global.VoiceStudio.getVietnameseBrowserVoices();
    if (bVoices.length > 0) {
      bVoices.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.label;
        bGroup.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = 'browser::default_vi';
      opt.textContent = '🔊 Giọng Tiếng Việt mặc định trình duyệt';
      bGroup.appendChild(opt);
    }
    dom.voicePersonaSelect.appendChild(bGroup);

    const ok = Array.from(dom.voicePersonaSelect.options).some((o) => o.value === prev);
    dom.voicePersonaSelect.value = ok ? prev : 'ai_co_minh_chau';
    dom.voiceRateSelect.value = String(state.settings.voiceRate || 1);
  }

  function stopVoice() {
    if (global.VoiceStudio) global.VoiceStudio.stop();
    if (dom.btnPlayPauseVoice) dom.btnPlayPauseVoice.textContent = '▶';
    if (dom.soundwaveViz) dom.soundwaveViz.classList.remove('playing');
    if (dom.voiceStatusLine) {
      dom.voiceStatusLine.classList.add('hidden');
      dom.voiceStatusLine.textContent = '';
    }
  }

  function toggleVoicePlayback() {
    if (!global.VoiceStudio) return;
    if (global.VoiceStudio.isSpeaking()) {
      stopVoice();
      return;
    }
    const lesson = getActiveLesson();
    const slide = lesson && lesson.slides[state.activeSlideIndex];
    if (!slide) return;

    global.VoiceStudio.speak({
      text: slide.script,
      voiceId: dom.voicePersonaSelect.value,
      rate: Number(dom.voiceRateSelect.value) || 1,
      apiKey: state.settings.geminiApiKey,
      onLoading: (msg) => {
        dom.btnPlayPauseVoice.textContent = '⏳';
        dom.voiceStatusLine.textContent = msg;
        dom.voiceStatusLine.classList.remove('hidden');
      },
      onStart: (name) => {
        dom.btnPlayPauseVoice.textContent = '⏹';
        dom.soundwaveViz.classList.add('playing');
        dom.voiceStatusLine.textContent = `🎙️ Đang giảng bài: ${name}`;
        dom.voiceStatusLine.classList.remove('hidden');
      },
      onFallback: (reason) => {
        dom.voiceStatusLine.textContent = `ℹ️ ${reason}`;
        dom.voiceStatusLine.classList.remove('hidden');
      },
      onEnd: () => stopVoice(),
      onError: (e) => {
        stopVoice();
        showToast(`⚠️ ${e}`);
      }
    });
  }

  /* ==================== RENDER STAGE ==================== */
  function renderProfileHeader() {
    document.querySelectorAll('[data-profile-grade]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.profileGrade) === state.activeGrade);
    });
    dom.headerStarsBadge.textContent = `⭐ ${state.starsByGrade[state.activeGrade] || 0} sao`;
    dom.drawerGradeNum.textContent = String(state.activeGrade);
  }

  function renderStage() {
    stopVoice();
    renderProfileHeader();

    const lesson = getActiveLesson();
    if (!lesson || !lesson.slides || !lesson.slides.length) return;

    if (state.activeSlideIndex < 0) state.activeSlideIndex = 0;
    if (state.activeSlideIndex >= lesson.slides.length) state.activeSlideIndex = lesson.slides.length - 1;

    const slide = lesson.slides[state.activeSlideIndex];
    const total = lesson.slides.length;
    const profile = global.AILessonFactory.GRADE_PROFILES[lesson.grade] || global.AILessonFactory.GRADE_PROFILES[4];

    dom.headerLessonSub.textContent = `${lesson.title} • ${profile.label}`;
    dom.slideCounterLabel.textContent = `${state.activeSlideIndex + 1} / ${total}`;
    dom.slideTagBadge.textContent = `${profile.shortLabel} • ${lesson.subject || '4D'} • TRANG ${state.activeSlideIndex + 1} / ${total}`;
    dom.slideTitle.textContent = slide.heading;
    dom.slideHeartMessage.textContent = slide.heart_message;
    dom.slideScript.textContent = slide.script;

    // Media & Source Pills
    renderSlideMedia(dom.slideMediaHost, slide);
    const icon = slide.media_type === 'youtube' ? '📺' : slide.media_type === 'image' ? '🖼️' : '🎨';
    dom.mediaSourceLabel.textContent = `${icon} ${slide.media_source || 'Sơ đồ AI (SVG)'}`;

    dom.srcSvgBtn.classList.toggle('active', slide.media_type === 'svg' || !slide.media_type);
    dom.srcImgBtn.classList.toggle('active', slide.media_type === 'image');
    dom.srcYtBtn.classList.toggle('active', slide.media_type === 'youtube');

    const ytId = slide.media_type === 'youtube' ? global.MediaFinder.parseYouTubeId(slide.media_url) : null;
    if (ytId) {
      dom.btnExternalYt.href = global.MediaFinder.buildYouTubeWatchUrl(ytId);
      dom.btnExternalYt.classList.remove('hidden');
    } else {
      dom.btnExternalYt.classList.add('hidden');
    }

    const ytList = (slide.media_candidates && slide.media_candidates.videos) || [];
    dom.btnNextYtCandidate.classList.toggle('hidden', ytList.length < 2);

    // 3D Flip Card
    dom.flipCardInner.classList.remove('is-flipped');
    dom.flipFrontLabel.textContent = `❌ ${profile.flipBeforeTitle}`;
    dom.flipBackLabel.textContent = `✨ ${profile.flipAfterTitle}`;
    dom.flipBeforeText.textContent = (slide.flip_card && slide.flip_card.before) || '';
    dom.flipAfterText.textContent = (slide.flip_card && slide.flip_card.after) || '';

    // Quiz
    renderQuiz(lesson, slide);

    // Nav buttons
    dom.btnPrevSlide.disabled = state.activeSlideIndex === 0;
    dom.btnNextSlide.textContent = state.activeSlideIndex === total - 1 ? '🎉 Hoàn Thành Bài' : 'Trang Tiếp ❯';

    if (!dom.slidesDrawer.classList.contains('hidden')) {
      renderDrawer();
    }
  }

  function renderQuiz(lesson, slide) {
    const qc = slide.quick_check || { question: '', options: [], correct_index: 0, explanation: '' };
    const key = `${lesson.id}_${slide.page}`;
    const answered = state.quizAnsweredMap[key];

    dom.quizQuestion.textContent = qc.question;
    dom.quizOptions.innerHTML = '';
    dom.quizFeedback.className = 'quiz-feedback hidden';

    const letters = ['A', 'B', 'C', 'D'];
    (qc.options || []).forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-opt';
      btn.innerHTML = `<span class="quiz-letter">${letters[idx] || idx + 1}</span><span>${escapeHtml(optText)}</span>`;

      if (answered !== undefined) {
        btn.disabled = true;
        if (idx === qc.correct_index) btn.classList.add('correct');
        else if (idx === answered) btn.classList.add('wrong');
      }

      btn.addEventListener('click', (e) => {
        if (state.quizAnsweredMap[key] !== undefined) return;
        state.quizAnsweredMap[key] = idx;
        const ok = idx === qc.correct_index;
        if (ok) {
          state.starsByGrade[lesson.grade] = (state.starsByGrade[lesson.grade] || 0) + 1;
          saveStars();
          renderProfileHeader();
          if (global.CinemaFX) {
            global.CinemaFX.playSFX('correct');
            global.CinemaFX.triggerCelebrationBurst(e.clientX, e.clientY);
          }
        } else if (global.CinemaFX) {
          global.CinemaFX.playSFX('wrong');
        }
        renderQuiz(lesson, slide);
      });

      dom.quizOptions.appendChild(btn);
    });

    if (answered !== undefined) {
      const ok = answered === qc.correct_index;
      dom.quizFeedback.classList.remove('hidden');
      dom.quizFeedback.classList.add(ok ? 'ok' : 'err');
      dom.quizFeedback.textContent = ok
        ? `🌟 Xuất sắc (+1 sao)! ${qc.explanation}`
        : `💡 Cố lên con nhé! ${qc.explanation}`;
    }
  }

  /* ==================== DRAWER (SLIDES + LIBRARY) ==================== */
  function openDrawer() {
    dom.drawerBackdrop.classList.remove('hidden');
    dom.slidesDrawer.classList.remove('hidden');
    renderDrawer();
  }

  function closeDrawer() {
    dom.drawerBackdrop.classList.add('hidden');
    dom.slidesDrawer.classList.add('hidden');
  }

  function renderDrawer() {
    dom.drawerTabSlides.classList.toggle('cbtn-gold', state.drawerTab === 'slides');
    dom.drawerTabLibrary.classList.toggle('cbtn-gold', state.drawerTab === 'library');
    dom.drawerContentList.innerHTML = '';

    if (state.drawerTab === 'slides') {
      const lesson = getActiveLesson();
      if (!lesson) return;
      lesson.slides.forEach((s, idx) => {
        const card = document.createElement('div');
        card.className = `drawer-card${idx === state.activeSlideIndex ? ' active' : ''}`;
        card.innerHTML = `
          <div style="font-size:11px;font-weight:800;color:var(--gold);">TRANG ${s.page} / ${lesson.slides.length}</div>
          <div style="font-size:13px;font-weight:800;margin-top:2px;">${escapeHtml(s.heading)}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;">💡 ${escapeHtml(s.heart_message)}</div>
        `;
        card.addEventListener('click', () => {
          state.activeSlideIndex = idx;
          if (global.CinemaFX) global.CinemaFX.playSFX('slide');
          renderStage();
          closeDrawer();
        });
        dom.drawerContentList.appendChild(card);
      });
    } else {
      const list = getLessonsForGrade(state.activeGrade);
      const active = getActiveLesson();
      list.forEach((lesson) => {
        const card = document.createElement('div');
        card.className = `drawer-card${active && active.id === lesson.id ? ' active' : ''}`;
        card.innerHTML = `
          <div style="font-size:13.5px;font-weight:800;padding-right:24px;">${escapeHtml(lesson.title)}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;">📘 ${escapeHtml(lesson.subject)} • ${lesson.slides.length} trang</div>
        `;
        card.addEventListener('click', () => {
          state.activeLessonId = lesson.id;
          state.activeSlideIndex = 0;
          if (global.CinemaFX) global.CinemaFX.playSFX('slide');
          renderStage();
          closeDrawer();
        });
        if (list.length > 1) {
          const del = document.createElement('button');
          del.type = 'button';
          del.textContent = '✕';
          del.style.cssText = 'position:absolute;top:8px;right:8px;border:none;background:transparent;color:#94a3b8;cursor:pointer;';
          del.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Xóa bài giảng "${lesson.title}"?`)) {
              state.lessons = state.lessons.filter((l) => l.id !== lesson.id);
              if (state.activeLessonId === lesson.id) state.activeLessonId = null;
              saveLessons();
              renderStage();
              renderDrawer();
            }
          });
          card.appendChild(del);
        }
        dom.drawerContentList.appendChild(card);
      });
    }
  }

  /* ==================== FLOATING DRAGGABLE AI TUTOR ==================== */
  function initTutorDrag() {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    dom.tutorDragHandle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      const rect = dom.floatingTutorPanel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      dom.floatingTutorPanel.style.right = 'auto';
      dom.floatingTutorPanel.style.bottom = 'auto';
      dom.floatingTutorPanel.style.left = `${rect.left}px`;
      dom.floatingTutorPanel.style.top = `${rect.top}px`;
    });

    global.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.max(8, Math.min(global.innerWidth - 160, e.clientX - offsetX));
      const y = Math.max(8, Math.min(global.innerHeight - 100, e.clientY - offsetY));
      dom.floatingTutorPanel.style.left = `${x}px`;
      dom.floatingTutorPanel.style.top = `${y}px`;
    });

    global.addEventListener('mouseup', () => { dragging = false; });
  }

  function appendTutorBubble(role, text) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    div.textContent = text;
    dom.tutorChatHistory.appendChild(div);
    dom.tutorChatHistory.scrollTop = dom.tutorChatHistory.scrollHeight;
    return div;
  }

  async function askTutor(question) {
    const q = String(question || '').trim();
    if (!q || state.tutor.loading) return;

    const lesson = getActiveLesson();
    const slide = lesson && lesson.slides[state.activeSlideIndex];
    const persona = TUTOR_PERSONAS[state.tutor.persona] || TUTOR_PERSONAS.co_giao;

    appendTutorBubble('user', q);
    dom.tutorInput.value = '';

    const apiKey = String(state.settings.geminiApiKey || '').trim();
    if (!apiKey || navigator.onLine === false) {
      // Dự phòng thông minh ngoại tuyến dựa trên chính nội dung slide hiện tại
      const offlineReply = slide
        ? `${persona.name} gợi ý nhanh (chế độ ngoại tuyến):\n\n💡 Trọng tâm trang "${slide.heading}": ${slide.heart_message}\n\n✨ Góc nhìn 4D: ${slide.flip_card.after}\n\n📖 Lời giảng: ${slide.script}\n\n(Nhập Gemini API Key trong Chế độ Phụ huynh để trò chuyện tự do với Gia Sư AI nhé!)`
        : 'Hãy nhập Gemini API Key trong Chế độ Phụ huynh để trò chuyện trực tiếp cùng Gia Sư AI nhé!';
      appendTutorBubble('ai', offlineReply);
      return;
    }

    state.tutor.loading = true;
    const thinkingEl = appendTutorBubble('ai', `${persona.name} đang suy nghĩ...`);

    const contextText = slide
      ? `Bài học: ${lesson.title} (Lớp ${lesson.grade}, Môn ${lesson.subject}).\nTrang ${slide.page}: ${slide.heading}\nThông điệp cốt lõi: ${slide.heart_message}\nThẻ 3D: Trước="${slide.flip_card.before}" -> Sau="${slide.flip_card.after}"\nLời giảng: ${slide.script}`
      : '';

    const tryModels = Array.from(
      new Set([state.settings.geminiModel || 'gemini-3.5-flash-lite', ...(global.AILessonFactory.FALLBACK_MODELS || [])])
    );

    let answer = '';
    for (const m of tryModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: `${persona.prompt}\nĐang hỗ trợ học sinh Lớp ${state.activeGrade}. Trả lời ngắn gọn, súc tích bằng tiếng Việt dễ hiểu, không dùng ký hiệu markdown phức tạp.` }]
              },
              contents: [{ role: 'user', parts: [{ text: `Ngữ cảnh bài học:\n${contextText}\n\nCâu hỏi của học sinh: ${q}` }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
          if (Array.isArray(parts)) {
            answer = parts.map((p) => p.text || '').join('').trim();
            break;
          }
        }
      } catch (_e) {}
    }

    state.tutor.loading = false;
    thinkingEl.textContent = answer || 'Gia Sư AI đang bận nhẹ, con hãy bấm hỏi lại sau vài giây nhé!';
    dom.tutorChatHistory.scrollTop = dom.tutorChatHistory.scrollHeight;
  }

  /* ==================== NHẬT KÝ HỌC TẬP 4D ==================== */
  function openJournalModal() {
    dom.journalModalTitle.textContent = `📖 Nhật Ký Học Tập & Rèn Luyện 4D — Lớp ${state.activeGrade}`;
    dom.journalDate.value = new Date().toISOString().slice(0, 10);
    dom.journalTri.value = '';
    dom.journalTam.value = '';
    dom.journalThan.value = '';
    dom.journalGoal.value = '';
    renderJournalHistory();
    dom.journalModal.classList.remove('hidden');
  }

  function renderJournalHistory() {
    const entries = state.journalByGrade[state.activeGrade] || [];
    dom.journalStreakBadge.textContent = `🔥 ${entries.length} ngày ghi chép`;
    dom.journalHistoryList.innerHTML = '';

    if (entries.length === 0) {
      dom.journalHistoryList.innerHTML = '<div style="font-size:12.5px;color:var(--text-muted);">Chưa có nhật ký nào. Hãy viết vài dòng đầu tiên cho hôm nay nhé!</div>';
      return;
    }

    entries.slice(0, 12).forEach((item) => {
      const box = document.createElement('div');
      box.style.cssText = 'padding:10px 12px;border-radius:10px;background:var(--bg-soft);border:1px solid var(--border-subtle);font-size:12.5px;';
      box.innerHTML = `
        <strong style="color:var(--gold);">📅 ${escapeHtml(item.date)}</strong>
        ${item.tri ? `<div>🧠 <strong>Trí:</strong> ${escapeHtml(item.tri)}</div>` : ''}
        ${item.tam ? `<div>❤️ <strong>Tâm:</strong> ${escapeHtml(item.tam)}</div>` : ''}
        ${item.than ? `<div>🏃 <strong>Thân:</strong> ${escapeHtml(item.than)}</div>` : ''}
        ${item.goal ? `<div>🎯 <strong>Mục tiêu:</strong> ${escapeHtml(item.goal)}</div>` : ''}
      `;
      dom.journalHistoryList.appendChild(box);
    });
  }

  /* ==================== XƯỞNG TẠO BÀI GIẢNG 4D (1 CHẠM) ==================== */
  function updateFactoryHint() {
    if (state.settings.geminiApiKey) {
      dom.factoryApiStatusHint.textContent = `✅ Đã sẵn sàng AI (${state.settings.geminiModel})`;
      dom.factoryApiStatusHint.style.color = '#34d399';
    } else {
      dom.factoryApiStatusHint.textContent = '⚠️ Chưa có Gemini API Key — Bấm "Phụ Huynh" để dán khóa.';
      dom.factoryApiStatusHint.style.color = '#f59e0b';
    }
  }

  function showFactoryError(msg) {
    if (!msg) {
      dom.factoryErrorBox.classList.add('hidden');
      return;
    }
    dom.factoryErrorBox.textContent = `⚠️ ${msg}`;
    dom.factoryErrorBox.classList.remove('hidden');
    dom.factoryErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setFactoryGrade(g) {
    const n = Number(g) || 4;
    state.factory.grade = n;
    state.factory.slideCount = (global.AILessonFactory.GRADE_PROFILES[n] || global.AILessonFactory.GRADE_PROFILES[4]).defaultSlides;
    dom.factoryGradeCards.querySelectorAll('.grade-card').forEach((c) => {
      c.classList.toggle('selected', Number(c.dataset.factoryGrade) === n);
    });
    dom.slideCountPills.querySelectorAll('[data-slide-count]').forEach((p) => {
      p.classList.toggle('active', Number(p.dataset.slideCount) === state.factory.slideCount);
    });
  }

  function renderAttachments() {
    const list = state.factory.attachments;
    dom.attachmentsGrid.innerHTML = '';
    if (!list.length) {
      dom.attachmentsGrid.classList.add('hidden');
      return;
    }
    dom.attachmentsGrid.classList.remove('hidden');
    const fmt = global.AILessonFactory.formatBytes;
    list.forEach((att) => {
      const card = document.createElement('div');
      card.className = 'att-card';
      card.innerHTML = att.kind === 'image'
        ? `<img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" /><div style="padding:6px;font-size:11px;"><strong>${escapeHtml(att.name)}</strong><div style="color:#34d399;">${att.width}×${att.height} • ${fmt(att.compressedSize)}</div></div>`
        : `<div class="att-doc">${att.kind === 'pdf' ? '📕 PDF' : '📝 TXT'}</div><div style="padding:6px;font-size:11px;"><strong>${escapeHtml(att.name)}</strong><div style="color:var(--text-muted);">${fmt(att.originalSize)}</div></div>`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'att-remove';
      rm.textContent = '✕';
      rm.addEventListener('click', () => {
        state.factory.attachments = state.factory.attachments.filter((a) => a.id !== att.id);
        renderAttachments();
      });
      card.appendChild(rm);
      dom.attachmentsGrid.appendChild(card);
    });
  }

  async function addFiles(files) {
    if (!files || !files.length) return;
    showFactoryError('');
    const errs = [];
    for (const f of Array.from(files)) {
      try {
        state.factory.attachments.push(await global.AILessonFactory.processInputFile(f));
      } catch (e) {
        errs.push(e.message);
      }
    }
    renderAttachments();
    if (errs.length) showFactoryError(errs.join(' '));
    else showToast(`📎 Đã nạp & tối ưu ${files.length} tệp!`);
  }

  function renderDraftReview() {
    const lesson = state.factory.draftLesson;
    if (!lesson) return;
    dom.factoryInputView.classList.add('hidden');
    dom.factoryProgressPanel.classList.add('hidden');
    dom.factoryReviewView.classList.remove('hidden');
    dom.reviewLessonTitle.textContent = `🎉 ${lesson.title}`;
    dom.reviewLessonMeta.textContent = `Lớp ${lesson.grade} • ${lesson.subject} • ${lesson.slides.length} trang 4D Cinema`;
    dom.reviewSlidesGrid.innerHTML = '';

    lesson.slides.forEach((s, idx) => {
      const card = document.createElement('div');
      card.className = 'media-choice';
      card.style.cursor = 'default';
      const thumbBox = document.createElement('div');
      thumbBox.style.cssText = 'width:100%;aspect-ratio:16/9;overflow:hidden;background:#020617;';
      if (s.media_type === 'youtube' && s.media_url) {
        const yid = global.MediaFinder.parseYouTubeId(s.media_url);
        thumbBox.innerHTML = `<img src="https://i.ytimg.com/vi/${encodeURIComponent(yid || '')}/mqdefault.jpg" alt="" />`;
      } else if (s.media_type === 'image' && s.media_url) {
        thumbBox.innerHTML = `<img src="${escapeHtml(s.media_url)}" alt="" />`;
      } else {
        const svgDiv = document.createElement('div');
        svgDiv.className = 'choice-svg';
        svgDiv.innerHTML = global.MediaFinder.sanitizeSVG(s.fallback_svg, s.heading, s.heart_message);
        thumbBox.appendChild(svgDiv);
      }
      const info = document.createElement('div');
      info.style.padding = '8px 10px';
      info.innerHTML = `<div style="font-size:12.5px;font-weight:800;">Trang ${s.page}: ${escapeHtml(s.heading)}</div><div style="font-size:11.5px;color:var(--text-muted);margin:4px 0 8px;">💡 ${escapeHtml(s.heart_message)}</div>`;
      const swapBtn = document.createElement('button');
      swapBtn.type = 'button';
      swapBtn.className = 'cbtn';
      swapBtn.textContent = '🔍 Đổi ảnh/video';
      swapBtn.addEventListener('click', () => openMediaPicker('draft', idx));
      info.appendChild(swapBtn);
      card.appendChild(thumbBox);
      card.appendChild(info);
      dom.reviewSlidesGrid.appendChild(card);
    });
  }

  /* ==================== MEDIA PICKER ==================== */
  function getPickerCtx() {
    const t = state.mediaPicker.target;
    if (!t) return null;
    if (t.mode === 'draft' && state.factory.draftLesson) {
      return { lesson: state.factory.draftLesson, slide: state.factory.draftLesson.slides[t.slideIndex] };
    }
    const lesson = getActiveLesson();
    return lesson ? { lesson, slide: lesson.slides[t.slideIndex] } : null;
  }

  function applyMediaUpdate(fn) {
    const ctx = getPickerCtx();
    if (!ctx || !ctx.slide) return;
    fn(ctx.slide);
    if (state.mediaPicker.target.mode === 'draft') {
      renderDraftReview();
    } else {
      saveLessons();
      renderStage();
    }
    dom.mediaPickerModal.classList.add('hidden');
    showToast('✅ Đã cập nhật Media cho trang này!');
  }

  function renderPickerChoices(slide) {
    const videos = (slide.media_candidates && slide.media_candidates.videos) || [];
    const images = (slide.media_candidates && slide.media_candidates.images) || [];

    dom.pickerVideosGrid.innerHTML = '';
    if (videos.length) {
      dom.pickerVideosSection.classList.remove('hidden');
      videos.forEach((v, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'media-choice';
        b.innerHTML = `<img src="${escapeHtml(v.thumbnail)}" alt="" /><div style="padding:7px;font-size:11.5px;font-weight:700;">▶ ${escapeHtml(v.title)}</div>`;
        b.addEventListener('click', () => applyMediaUpdate((s) => {
          s.media_type = 'youtube';
          s.media_url = v.embedUrl || global.MediaFinder.buildYouTubeEmbedUrl(v.id);
          s.media_source = 'YouTube An Toàn';
          s.media_title = v.title;
          s.media_video_index = idx;
        }));
        dom.pickerVideosGrid.appendChild(b);
      });
    } else {
      dom.pickerVideosSection.classList.add('hidden');
    }

    dom.pickerImagesGrid.innerHTML = '';
    const svgBtn = document.createElement('button');
    svgBtn.type = 'button';
    svgBtn.className = 'media-choice';
    svgBtn.innerHTML = `<div class="choice-svg">${global.MediaFinder.sanitizeSVG(slide.fallback_svg, slide.heading, slide.heart_message)}</div><div style="padding:7px;font-size:11.5px;font-weight:700;">🎨 Sơ đồ AI tích hợp sẵn (Ngoại tuyến)</div>`;
    svgBtn.addEventListener('click', () => applyMediaUpdate((s) => {
      s.media_type = 'svg';
      s.media_url = '';
      s.media_source = 'Sơ đồ AI (SVG)';
    }));
    dom.pickerImagesGrid.appendChild(svgBtn);

    images.forEach((im) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'media-choice';
      b.innerHTML = `<img src="${escapeHtml(im.thumb || im.url)}" alt="" /><div style="padding:7px;font-size:11.5px;font-weight:700;">🖼️ ${escapeHtml(im.title)} (${escapeHtml(im.source)})</div>`;
      b.addEventListener('click', () => applyMediaUpdate((s) => {
        s.media_type = 'image';
        s.media_url = im.url;
        s.media_source = im.source || 'Ảnh minh họa';
        s.media_title = im.title;
      }));
      dom.pickerImagesGrid.appendChild(b);
    });
  }

  function openMediaPicker(mode, slideIndex) {
    state.mediaPicker.target = { mode, slideIndex };
    const ctx = getPickerCtx();
    if (!ctx || !ctx.slide) return;
    dom.customMediaUrlInput.value = '';
    if (dom.liveYoutubeSearchInput) {
      dom.liveYoutubeSearchInput.value = ctx.slide.youtube_search_query || ctx.slide.heading || '';
    }
    dom.liveImageSearchInput.value = ctx.slide.image_search_query || ctx.slide.heading || '';
    dom.pickerVisualPromptText.textContent = ctx.slide.visual_prompt || '';
    renderPickerChoices(ctx.slide);
    dom.mediaPickerModal.classList.remove('hidden');
  }

  function downloadJson(lesson) {
    if (!lesson) return;
    const slug = String(lesson.title || 'bai_4d').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').slice(0, 48);
    const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HocVien4D_Cinema_Lop${lesson.grade}_${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('💾 Đã tải file JSON sao lưu bài giảng!');
  }

  /* ==================== BIND EVENTS ==================== */
  function cacheDom() {
    [
      'particleCanvas', 'drawCanvas', 'drawToolbar', 'btnDrawNeon', 'btnDrawStars',
      'btnDrawUndo', 'btnDrawClear', 'btnDrawClose',
      'headerStarsBadge', 'headerLessonSub', 'slideCounterLabel',
      'btnOpenFactory', 'btnToggleDraw', 'btnToggle432', 'btnToggleSfx',
      'btnToggleTutor', 'btnOpenJournal', 'btnOpenParent', 'btnOpenDrawer',
      'stageContainer', 'leftCol', 'stageSplitter', 'rightCol',
      'cinemaMediaFrame', 'slideMediaHost', 'srcSvgBtn', 'srcImgBtn', 'srcYtBtn',
      'btnSwapMediaTop', 'btnOverlayPrev', 'btnOverlayNext', 'mediaSourceLabel',
      'btnNextYtCandidate', 'btnExternalYt', 'btnFullscreenMedia',
      'btnFlipToAfter', 'btnFlipReset', 'flipCardScene', 'flipCardInner',
      'flipFrontLabel', 'flipBackLabel', 'flipBeforeText', 'flipAfterText',
      'slideTagBadge', 'btnFontDown', 'btnFontReset', 'btnFontUp', 'btnDownloadJson',
      'slideTitle', 'slideHeartMessage', 'btnToggleScriptExpand', 'btnCopyScript', 'slideScript',
      'quizQuestion', 'quizOptions', 'quizFeedback',
      'btnPlayPauseVoice', 'soundwaveViz', 'voicePersonaSelect', 'voiceRateSelect', 'voiceStatusLine',
      'btnPrevSlide', 'btnNextSlide', 'btnCopyFlowPrompt', 'btnAskTutorBottom',
      'floatingTutorPanel', 'tutorDragHandle', 'btnCloseTutor', 'tutorPersonasBar',
      'tutorChatHistory', 'tutorQuickChips', 'tutorInput', 'btnSendTutor',
      'drawerBackdrop', 'slidesDrawer', 'btnCloseDrawer', 'drawerTabSlides',
      'drawerTabLibrary', 'drawerGradeNum', 'drawerContentList', 'btnImportJson', 'importJsonInput',
      'factoryModal', 'factoryInputView', 'factoryGradeCards', 'smartDropzone',
      'btnPickFiles', 'btnCaptureCamera', 'factoryFileInput', 'factoryCameraInput',
      'attachmentsGrid', 'factoryTopicInput', 'slideCountPills', 'factoryAutoMediaToggle',
      'factoryErrorBox', 'factoryApiStatusHint', 'btnStartGenerate',
      'factoryProgressPanel', 'factoryProgressBar', 'factoryProgressMsg',
      'factoryReviewView', 'reviewLessonTitle', 'reviewLessonMeta', 'reviewSlidesGrid',
      'btnBackToFactoryForm', 'btnDownloadDraftJson', 'btnLaunchNewLesson',
      'parentModal', 'parentSettingsForm', 'inputGeminiKey', 'selectGeminiModel',
      'btnTestGeminiApi', 'apiTestResult', 'inputYoutubeKey', 'inputPixabayKey',
      'journalModal', 'journalModalTitle', 'journalDate', 'journalStreakBadge',
      'journalTri', 'journalTam', 'journalThan', 'journalGoal', 'btnSaveJournal', 'journalHistoryList',
      'mediaPickerModal', 'customMediaUrlInput', 'btnApplyCustomMedia',
      'liveYoutubeSearchInput', 'btnLiveYoutubeSearch',
      'liveImageSearchInput', 'btnLiveImageSearch', 'pickerVideosSection',
      'pickerVideosGrid', 'pickerImagesGrid', 'pickerVisualPromptText', 'btnCopyVisualPrompt',
      'toast'
    ].forEach((id) => { dom[id] = $(id); });
  }

  function goPrev() {
    if (state.activeSlideIndex > 0) {
      state.activeSlideIndex--;
      if (global.CinemaFX) global.CinemaFX.playSFX('slide');
      renderStage();
    }
  }

  function goNext() {
    const lesson = getActiveLesson();
    if (!lesson) return;
    if (state.activeSlideIndex < lesson.slides.length - 1) {
      state.activeSlideIndex++;
      if (global.CinemaFX) global.CinemaFX.playSFX('slide');
      renderStage();
    } else {
      if (global.CinemaFX) {
        global.CinemaFX.playSFX('correct');
        global.CinemaFX.triggerCelebrationBurst(global.innerWidth * 0.5, global.innerHeight * 0.45);
      }
      showToast('🎉 Xuất sắc! Con đã hoàn thành trọn vẹn bài giảng 4D Cinema!');
    }
  }

  function bindEvents() {
    // Profile & Art Themes
    document.querySelectorAll('[data-profile-grade]').forEach((b) => {
      b.addEventListener('click', () => {
        state.activeGrade = Number(b.dataset.profileGrade) || 4;
        state.activeLessonId = null;
        state.activeSlideIndex = 0;
        if (global.CinemaFX) global.CinemaFX.playSFX('click');
        renderStage();
      });
    });

    document.querySelectorAll('[data-art-theme]').forEach((b) => {
      b.addEventListener('click', () => applyTheme(b.dataset.artTheme));
    });

    // Font Scale
    dom.btnFontDown.addEventListener('click', () => applyFontScale(state.prefs.fontScale - 0.08));
    dom.btnFontUp.addEventListener('click', () => applyFontScale(state.prefs.fontScale + 0.08));
    dom.btnFontReset.addEventListener('click', () => applyFontScale(1));

    // Slide Nav
    dom.btnPrevSlide.addEventListener('click', goPrev);
    dom.btnNextSlide.addEventListener('click', goNext);
    dom.btnOverlayPrev.addEventListener('click', goPrev);
    dom.btnOverlayNext.addEventListener('click', goNext);

    // Media Source Switcher pills
    dom.srcSvgBtn.addEventListener('click', () => {
      const l = getActiveLesson();
      const s = l && l.slides[state.activeSlideIndex];
      if (!s) return;
      s.media_type = 'svg';
      s.media_source = 'Sơ đồ AI (SVG)';
      saveLessons();
      renderStage();
    });

    dom.srcImgBtn.addEventListener('click', () => {
      const l = getActiveLesson();
      const s = l && l.slides[state.activeSlideIndex];
      if (!s) return;
      const imgs = (s.media_candidates && s.media_candidates.images) || [];
      if (imgs.length > 0) {
        s.media_type = 'image';
        s.media_url = imgs[0].url;
        s.media_source = imgs[0].source || 'Ảnh minh họa';
        saveLessons();
        renderStage();
      } else {
        openMediaPicker('stage', state.activeSlideIndex);
      }
    });

    dom.srcYtBtn.addEventListener('click', () => {
      const l = getActiveLesson();
      const s = l && l.slides[state.activeSlideIndex];
      if (!s) return;
      const vids = (s.media_candidates && s.media_candidates.videos) || [];
      if (vids.length > 0) {
        s.media_type = 'youtube';
        s.media_url = vids[0].embedUrl || global.MediaFinder.buildYouTubeEmbedUrl(vids[0].id);
        s.media_source = 'YouTube An Toàn';
        s.media_title = vids[0].title;
        saveLessons();
        renderStage();
      } else {
        openMediaPicker('stage', state.activeSlideIndex);
      }
    });

    dom.btnSwapMediaTop.addEventListener('click', () => openMediaPicker('stage', state.activeSlideIndex));

    dom.btnNextYtCandidate.addEventListener('click', () => {
      const l = getActiveLesson();
      const s = l && l.slides[state.activeSlideIndex];
      const vids = (s && s.media_candidates && s.media_candidates.videos) || [];
      if (vids.length < 2) return;
      const nextIdx = ((s.media_video_index || 0) + 1) % vids.length;
      const v = vids[nextIdx];
      s.media_type = 'youtube';
      s.media_url = v.embedUrl || global.MediaFinder.buildYouTubeEmbedUrl(v.id);
      s.media_title = v.title;
      s.media_video_index = nextIdx;
      s.media_source = `YouTube An Toàn (Video ${nextIdx + 1}/${vids.length})`;
      saveLessons();
      renderStage();
    });

    // Video Slow-Mo Speed
    document.querySelectorAll('[data-vspeed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentVideoSpeed = Number(btn.dataset.vspeed) || 1;
        document.querySelectorAll('[data-vspeed]').forEach((b) => b.classList.toggle('active', b === btn));
        if (activeYtPlayer && typeof activeYtPlayer.setPlaybackRate === 'function') {
          try {
            activeYtPlayer.setPlaybackRate(currentVideoSpeed);
            showToast(`🐢 Đã đặt tốc độ video ${currentVideoSpeed}x`);
          } catch (_e) {}
        }
      });
    });

    // Fullscreen Media (F)
    dom.btnFullscreenMedia.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (dom.cinemaMediaFrame.requestFullscreen) {
        dom.cinemaMediaFrame.requestFullscreen().catch(() => {});
      }
    });

    // 3D Flip Card
    const flipToggle = (forceState) => {
      if (typeof forceState === 'boolean') dom.flipCardInner.classList.toggle('is-flipped', forceState);
      else dom.flipCardInner.classList.toggle('is-flipped');
      if (global.CinemaFX) global.CinemaFX.playSFX('flip');
    };
    dom.flipCardScene.addEventListener('click', () => flipToggle());
    dom.btnFlipToAfter.addEventListener('click', () => flipToggle(true));
    dom.btnFlipReset.addEventListener('click', () => flipToggle(false));

    // Script expand & copy
    dom.btnToggleScriptExpand.addEventListener('click', () => {
      const collapsed = dom.slideScript.classList.toggle('collapsed');
      dom.btnToggleScriptExpand.textContent = collapsed ? '📖 Mở Rộng' : '📕 Thu Gọn';
    });
    dom.btnCopyScript.addEventListener('click', () => {
      navigator.clipboard.writeText(dom.slideScript.textContent || '').then(() => showToast('📋 Đã chép kịch bản lời giảng!'));
    });
    dom.btnCopyFlowPrompt.addEventListener('click', () => {
      const l = getActiveLesson();
      const s = l && l.slides[state.activeSlideIndex];
      if (!s) return;
      navigator.clipboard.writeText(s.visual_prompt || '').then(() => showToast('✨ Đã chép Google Flow Prompt 16:9 của trang này!'));
    });

    // Voice Bar
    dom.btnPlayPauseVoice.addEventListener('click', toggleVoicePlayback);
    dom.voicePersonaSelect.addEventListener('change', () => {
      state.settings.voiceId = dom.voicePersonaSelect.value;
      saveSettings();
      if (global.VoiceStudio && global.VoiceStudio.isSpeaking()) {
        stopVoice();
        toggleVoicePlayback();
      }
    });
    dom.voiceRateSelect.addEventListener('change', () => {
      state.settings.voiceRate = Number(dom.voiceRateSelect.value) || 1;
      saveSettings();
    });
    if ('speechSynthesis' in global) {
      global.speechSynthesis.onvoiceschanged = populateVoices;
    }

    // Whiteboard, 432Hz & SFX
    const toggleDraw = (forceOff) => {
      const on = forceOff ? false : !dom.drawCanvas.classList.contains('active');
      if (global.CinemaFX) global.CinemaFX.setDrawActive(on);
      dom.btnToggleDraw.classList.toggle('active', on);
      dom.drawToolbar.classList.toggle('hidden', !on);
    };
    dom.btnToggleDraw.addEventListener('click', () => toggleDraw(false));
    dom.btnDrawClose.addEventListener('click', () => toggleDraw(true));
    dom.btnDrawUndo.addEventListener('click', () => global.CinemaFX && global.CinemaFX.undoStroke());
    dom.btnDrawClear.addEventListener('click', () => global.CinemaFX && global.CinemaFX.clearDrawings());
    dom.btnDrawNeon.addEventListener('click', () => {
      const active = dom.btnDrawNeon.classList.toggle('active');
      global.CinemaFX && global.CinemaFX.setDrawConfig({ neon: active });
    });
    dom.btnDrawStars.addEventListener('click', () => {
      const active = dom.btnDrawStars.classList.toggle('active');
      global.CinemaFX && global.CinemaFX.setDrawConfig({ stars: active });
    });
    document.querySelectorAll('[data-dtool]').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-dtool]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        global.CinemaFX && global.CinemaFX.setDrawConfig({ tool: b.dataset.dtool });
      });
    });
    document.querySelectorAll('[data-dcolor]').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-dcolor]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        global.CinemaFX && global.CinemaFX.setDrawConfig({ color: b.dataset.dcolor });
      });
    });

    dom.btnToggle432.addEventListener('click', () => {
      if (!global.CinemaFX) return;
      const on = global.CinemaFX.toggleHealing432();
      dom.btnToggle432.classList.toggle('active', on);
      showToast(on ? '🎵 Đã bật sóng âm tập trung 432Hz dịu nhẹ' : '🔇 Đã tắt nhạc nền 432Hz');
    });

    dom.btnToggleSfx.addEventListener('click', () => {
      if (!global.CinemaFX) return;
      const next = !global.CinemaFX.isSfxEnabled();
      global.CinemaFX.setSfxEnabled(next);
      dom.btnToggleSfx.classList.toggle('active', next);
      if (next) global.CinemaFX.playSFX('click');
    });

    // Tutor Floating Panel
    const toggleTutor = () => {
      const hidden = dom.floatingTutorPanel.classList.toggle('hidden');
      if (!hidden && dom.tutorChatHistory.children.length === 0) {
        appendTutorBubble(
          'ai',
          'Chào con! 🏛️ Hội Đồng Gia Sư AI 4D đã sẵn sàng. Con chọn nhân vật bên trên rồi hỏi bất kỳ điều gì khó hiểu ở trang này nhé!'
        );
      }
    };
    dom.btnToggleTutor.addEventListener('click', toggleTutor);
    dom.btnAskTutorBottom.addEventListener('click', toggleTutor);
    dom.btnCloseTutor.addEventListener('click', () => dom.floatingTutorPanel.classList.add('hidden'));
    dom.tutorPersonasBar.querySelectorAll('[data-tutor]').forEach((b) => {
      b.addEventListener('click', () => {
        state.tutor.persona = b.dataset.tutor;
        dom.tutorPersonasBar.querySelectorAll('[data-tutor]').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    dom.tutorQuickChips.querySelectorAll('[data-chip]').forEach((c) => {
      c.addEventListener('click', () => askTutor(c.dataset.chip));
    });
    dom.btnSendTutor.addEventListener('click', () => askTutor(dom.tutorInput.value));
    dom.tutorInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') askTutor(dom.tutorInput.value);
    });

    // Drawer & JSON Import/Export
    dom.btnOpenDrawer.addEventListener('click', openDrawer);
    dom.btnCloseDrawer.addEventListener('click', closeDrawer);
    dom.drawerBackdrop.addEventListener('click', closeDrawer);
    dom.drawerTabSlides.addEventListener('click', () => { state.drawerTab = 'slides'; renderDrawer(); });
    dom.drawerTabLibrary.addEventListener('click', () => { state.drawerTab = 'library'; renderDrawer(); });
    dom.btnDownloadJson.addEventListener('click', () => downloadJson(getActiveLesson()));
    dom.btnImportJson.addEventListener('click', () => dom.importJsonInput.click());
    dom.importJsonInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(String(r.result || ''));
          const norm = global.AILessonFactory.normalizeLesson(parsed, parsed.grade || state.activeGrade);
          if (Array.isArray(parsed.slides)) {
            norm.slides.forEach((s, i) => {
              const o = parsed.slides[i];
              if (o && o.media_type && o.media_url) {
                s.media_type = o.media_type;
                s.media_url = o.media_url;
                s.media_source = o.media_source || s.media_source;
              }
              if (o && o.media_candidates) s.media_candidates = o.media_candidates;
            });
          }
          state.lessons.unshift(norm);
          saveLessons();
          state.activeGrade = norm.grade;
          state.activeLessonId = norm.id;
          state.activeSlideIndex = 0;
          renderStage();
          closeDrawer();
          showToast(`📂 Đã nạp bài giảng "${norm.title}"!`);
        } catch (err) {
          showToast(`⚠️ File JSON chưa hợp lệ: ${err.message}`);
        }
      };
      r.readAsText(file, 'UTF-8');
      e.target.value = '';
    });

    // Journal Modal
    dom.btnOpenJournal.addEventListener('click', openJournalModal);
    dom.btnSaveJournal.addEventListener('click', () => {
      const entry = {
        date: dom.journalDate.value || new Date().toISOString().slice(0, 10),
        tri: dom.journalTri.value.trim(),
        tam: dom.journalTam.value.trim(),
        than: dom.journalThan.value.trim(),
        goal: dom.journalGoal.value.trim()
      };
      if (!entry.tri && !entry.tam && !entry.than && !entry.goal) {
        showToast('Hãy viết ít nhất 1 ô nhật ký trước khi lưu nhé!');
        return;
      }
      if (!Array.isArray(state.journalByGrade[state.activeGrade])) state.journalByGrade[state.activeGrade] = [];
      state.journalByGrade[state.activeGrade].unshift(entry);
      saveJournal();
      renderJournalHistory();
      if (global.CinemaFX) global.CinemaFX.playSFX('correct');
      showToast('📖 Đã lưu Nhật Ký Học Tập 4D hôm nay!');
    });

    // Parent Settings Modal
    dom.btnOpenParent.addEventListener('click', () => {
      dom.inputGeminiKey.value = state.settings.geminiApiKey || '';
      dom.selectGeminiModel.value = state.settings.geminiModel || 'gemini-3.5-flash-lite';
      dom.inputYoutubeKey.value = state.settings.youtubeApiKey || '';
      dom.inputPixabayKey.value = state.settings.pixabayApiKey || '';
      dom.apiTestResult.textContent = '';
      dom.parentModal.classList.remove('hidden');
    });
    dom.parentSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.settings.geminiApiKey = dom.inputGeminiKey.value.trim();
      state.settings.geminiModel = dom.selectGeminiModel.value;
      state.settings.youtubeApiKey = dom.inputYoutubeKey.value.trim();
      state.settings.pixabayApiKey = dom.inputPixabayKey.value.trim();
      saveSettings();
      updateFactoryHint();
      dom.parentModal.classList.add('hidden');
      showToast('✅ Đã lưu cài đặt API Phụ huynh!');
    });
    dom.btnTestGeminiApi.addEventListener('click', async () => {
      dom.btnTestGeminiApi.disabled = true;
      dom.apiTestResult.textContent = '⏳ Đang kiểm tra...';
      try {
        const res = await global.AILessonFactory.testApiConnection(dom.inputGeminiKey.value, dom.selectGeminiModel.value);
        dom.apiTestResult.style.color = res.ok ? '#34d399' : '#fb7185';
        dom.apiTestResult.textContent = res.ok ? `✅ ${res.message}` : `❌ ${res.message}`;
      } finally {
        dom.btnTestGeminiApi.disabled = false;
      }
    });
    document.querySelectorAll('[data-toggle-secret]').forEach((b) => {
      b.addEventListener('click', () => {
        const inp = $(b.dataset.toggleSecret);
        if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    });

    // Factory Modal
    dom.btnOpenFactory.addEventListener('click', () => {
      showFactoryError('');
      setFactoryGrade(state.activeGrade);
      updateFactoryHint();
      if (!state.factory.draftLesson) {
        dom.factoryInputView.classList.remove('hidden');
        dom.factoryProgressPanel.classList.add('hidden');
        dom.factoryReviewView.classList.add('hidden');
      }
      dom.factoryModal.classList.remove('hidden');
    });
    dom.factoryGradeCards.querySelectorAll('.grade-card').forEach((c) => {
      c.addEventListener('click', () => setFactoryGrade(c.dataset.factoryGrade));
    });
    dom.slideCountPills.querySelectorAll('[data-slide-count]').forEach((p) => {
      p.addEventListener('click', () => {
        state.factory.slideCount = Number(p.dataset.slideCount) || 6;
        dom.slideCountPills.querySelectorAll('[data-slide-count]').forEach((x) => x.classList.toggle('active', x === p));
      });
    });
    dom.btnPickFiles.addEventListener('click', () => dom.factoryFileInput.click());
    dom.btnCaptureCamera.addEventListener('click', () => dom.factoryCameraInput.click());
    dom.factoryFileInput.addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
    dom.factoryCameraInput.addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

    ['dragenter', 'dragover'].forEach((ev) => dom.smartDropzone.addEventListener(ev, (e) => {
      e.preventDefault(); dom.smartDropzone.classList.add('drag-over');
    }));
    ['dragleave', 'drop'].forEach((ev) => dom.smartDropzone.addEventListener(ev, (e) => {
      e.preventDefault(); dom.smartDropzone.classList.remove('drag-over');
    }));
    dom.smartDropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    // Ctrl+V paste ảnh hoặc file
    document.addEventListener('paste', async (e) => {
      if (dom.factoryModal.classList.contains('hidden') || state.factory.isGenerating) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const files = [];
      if (cd.items) {
        for (const it of Array.from(cd.items)) {
          if (it.kind === 'file') {
            const f = it.getAsFile();
            if (f) files.push(f);
          }
        }
      }
      if (!files.length) return;
      e.preventDefault();
      await addFiles(files);
    });

    dom.btnStartGenerate.addEventListener('click', async () => {
      if (state.factory.isGenerating) return;
      showFactoryError('');
      const topic = dom.factoryTopicInput.value.trim();
      if (!String(state.settings.geminiApiKey || '').trim()) {
        showFactoryError('Chưa nhập Gemini API Key! Hãy bấm "👨‍👩‍👧 Phụ Huynh" để dán khóa API trước nhé.');
        return;
      }
      if (!topic && !state.factory.attachments.length) {
        showFactoryError('Vui lòng dán ảnh/tệp hoặc nhập chủ đề cần học trước khi khởi tạo!');
        return;
      }

      state.factory.isGenerating = true;
      dom.factoryInputView.classList.add('hidden');
      dom.factoryProgressPanel.classList.remove('hidden');

      try {
        const lesson = await global.AILessonFactory.generateLesson({
          grade: state.factory.grade,
          slideCount: state.factory.slideCount,
          topicText: topic,
          attachments: state.factory.attachments,
          apiKey: state.settings.geminiApiKey,
          model: state.settings.geminiModel,
          autoMedia: dom.factoryAutoMediaToggle.checked,
          mediaSettings: {
            youtubeApiKey: state.settings.youtubeApiKey,
            pixabayApiKey: state.settings.pixabayApiKey
          },
          onStage: (step, msg, meta) => {
            dom.factoryProgressBar.style.width = `${(meta && meta.percent) || 15}%`;
            dom.factoryProgressMsg.textContent = msg;
            dom.factoryProgressPanel.querySelectorAll('.step-chip').forEach((c) => {
              const s = Number(c.dataset.step);
              c.classList.remove('active', 'done');
              if (s < step) c.classList.add('done');
              else if (s === step) c.classList.add(step === 4 ? 'done' : 'active');
            });
          }
        });
        state.factory.draftLesson = lesson;
        renderDraftReview();
        if (global.CinemaFX) global.CinemaFX.playSFX('correct');
      } catch (err) {
        dom.factoryProgressPanel.classList.add('hidden');
        dom.factoryInputView.classList.remove('hidden');
        showFactoryError(err.message || 'Lỗi không xác định khi tạo bài giảng.');
      } finally {
        state.factory.isGenerating = false;
      }
    });

    dom.btnBackToFactoryForm.addEventListener('click', () => {
      state.factory.draftLesson = null;
      dom.factoryReviewView.classList.add('hidden');
      dom.factoryInputView.classList.remove('hidden');
    });
    dom.btnDownloadDraftJson.addEventListener('click', () => downloadJson(state.factory.draftLesson));
    dom.btnLaunchNewLesson.addEventListener('click', () => {
      const lesson = state.factory.draftLesson;
      if (!lesson) return;
      state.lessons.unshift(lesson);
      saveLessons();
      state.activeGrade = Number(lesson.grade) || 4;
      state.activeLessonId = lesson.id;
      state.activeSlideIndex = 0;
      state.factory.attachments = [];
      state.factory.draftLesson = null;
      dom.factoryTopicInput.value = '';
      renderAttachments();
      dom.factoryReviewView.classList.add('hidden');
      dom.factoryInputView.classList.remove('hidden');
      dom.factoryModal.classList.add('hidden');
      renderStage();
      showToast(`🎓 Đã mở bài giảng 4D Cinema cho Lớp ${lesson.grade}!`);
    });

    // Media Picker Modal
    dom.btnApplyCustomMedia.addEventListener('click', () => {
      const raw = dom.customMediaUrlInput.value.trim();
      const yid = global.MediaFinder.parseYouTubeId(raw);
      if (yid) {
        applyMediaUpdate((s) => {
          s.media_type = 'youtube';
          s.media_url = global.MediaFinder.buildYouTubeEmbedUrl(yid);
          s.media_source = 'YouTube (Phụ huynh chọn)';
        });
      } else if (/^https?:\/\//i.test(raw)) {
        applyMediaUpdate((s) => {
          s.media_type = 'image';
          s.media_url = raw;
          s.media_source = 'Ảnh (Phụ huynh chọn)';
        });
      } else {
        showToast('⚠️ Vui lòng dán link YouTube hoặc URL ảnh hợp lệ.');
      }
    });
    if (dom.btnLiveYoutubeSearch) {
      dom.btnLiveYoutubeSearch.addEventListener('click', async () => {
        const ctx = getPickerCtx();
        const q = (dom.liveYoutubeSearchInput && dom.liveYoutubeSearchInput.value.trim()) || '';
        if (!ctx || !q) return;
        const ytKey = String(state.settings.youtubeApiKey || '').trim();
        if (!ytKey) {
          showToast('⚠️ Chưa nhập YouTube Data API Key trong mục Phụ Huynh — bạn có thể dán trực tiếp link YouTube vào ô phía trên!');
          return;
        }
        dom.btnLiveYoutubeSearch.disabled = true;
        dom.btnLiveYoutubeSearch.textContent = '⏳ Đang tìm...';
        try {
          const vids = await global.MediaFinder.searchYouTubeVideos(q, ytKey);
          if (!ctx.slide.media_candidates) ctx.slide.media_candidates = { videos: [], images: [] };
          ctx.slide.media_candidates.videos = vids;
          renderPickerChoices(ctx.slide);
          showToast(vids.length ? `📺 Tìm thấy ${vids.length} video YouTube phát trực tiếp được!` : 'Không tìm thấy video phù hợp. Thử từ khóa khác nhé!');
        } finally {
          dom.btnLiveYoutubeSearch.disabled = false;
          dom.btnLiveYoutubeSearch.textContent = '📺 Tìm YouTube';
        }
      });
    }
    dom.btnLiveImageSearch.addEventListener('click', async () => {
      const ctx = getPickerCtx();
      const q = dom.liveImageSearchInput.value.trim();
      if (!ctx || !q) return;
      dom.btnLiveImageSearch.disabled = true;
      try {
        const imgs = await global.MediaFinder.searchImages(q, ctx.lesson.grade, state.settings);
        if (!ctx.slide.media_candidates) ctx.slide.media_candidates = { videos: [], images: [] };
        ctx.slide.media_candidates.images = imgs;
        renderPickerChoices(ctx.slide);
      } finally {
        dom.btnLiveImageSearch.disabled = false;
      }
    });
    dom.btnCopyVisualPrompt.addEventListener('click', () => {
      navigator.clipboard.writeText(dom.pickerVisualPromptText.textContent || '').then(() => showToast('📋 Đã sao chép Google Flow Prompt!'));
    });

    // Close modals
    document.querySelectorAll('[data-close-modal]').forEach((b) => {
      b.addEventListener('click', () => $(b.dataset.closeModal).classList.add('hidden'));
    });

    // Keyboard shortcuts (← / → / Space / F / Ctrl+Z)
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!dom.factoryModal.classList.contains('hidden') || !dom.parentModal.classList.contains('hidden')) return;

      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === ' ') { e.preventDefault(); toggleVoicePlayback(); }
      else if (e.key.toLowerCase() === 'f') dom.btnFullscreenMedia.click();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        global.CinemaFX && global.CinemaFX.undoStroke();
      }
    });
  }

  /* ==================== CHIA SẺ BÀI GIẢNG QUA LINK ==================== */
  function bytesToBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBytes(str) {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function encodeLessonForUrl(lesson) {
    // Loại bỏ danh sách ứng viên dự phòng để link ngắn gọn nhất
    const slim = JSON.parse(JSON.stringify(lesson));
    if (Array.isArray(slim.slides)) {
      slim.slides.forEach((s) => { delete s.media_candidates; });
    }
    const rawBytes = new TextEncoder().encode(JSON.stringify(slim));
    if (typeof CompressionStream === 'function') {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(rawBytes);
      writer.close();
      const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
      return 'gz_' + bytesToBase64Url(compressed);
    }
    return 'u8_' + bytesToBase64Url(rawBytes);
  }

  async function decodeLessonFromUrl(token) {
    if (!token) return null;
    if (token.startsWith('gz_') && typeof DecompressionStream === 'function') {
      const bytes = base64UrlToBytes(token.slice(3));
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const text = await new Response(ds.readable).text();
      return JSON.parse(text);
    }
    const raw = token.startsWith('u8_') ? token.slice(3) : token;
    const text = new TextDecoder().decode(base64UrlToBytes(raw));
    return JSON.parse(text);
  }

  async function shareCurrentLesson() {
    const lesson = getActiveLesson();
    if (!lesson) {
      showToast('⚠️ Chưa có bài giảng nào để chia sẻ.');
      return;
    }
    try {
      const token = await encodeLessonForUrl(lesson);
      const baseUrl = window.location.origin + window.location.pathname;
      const shareUrl = `${baseUrl}#share=${token}`;
      if (shareUrl.length > 32000) {
        // Bài quá dài -> tải JSON để gửi qua Zalo
        const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `bai_giang_4d_${Date.now()}.json`;
        a.click();
        showToast('📦 Bài giảng có nhiều nội dung — đã tải file .json để anh gửi qua Zalo (người nhận bấm "Nạp File Bài Giảng")!');
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('🔗 Đã sao chép LINK CHIA SẺ bài giảng này! Gửi cho người khác mở là thấy đúng bài này ngay.');
      } else {
        window.prompt('Sao chép đường link chia sẻ bài giảng dưới đây:', shareUrl);
      }
    } catch (err) {
      console.error('Share lesson error:', err);
      showToast('⚠️ Không tạo được link chia sẻ: ' + err.message);
    }
  }

  async function checkSharedLessonInUrl() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#share=')) return;
    const token = hash.slice('#share='.length).trim();
    if (!token) return;
    try {
      const sharedLesson = await decodeLessonFromUrl(token);
      if (sharedLesson && sharedLesson.title && Array.isArray(sharedLesson.slides) && sharedLesson.slides.length > 0) {
        const existingIdx = state.lessons.findIndex((l) => l.id === sharedLesson.id);
        if (existingIdx >= 0) {
          state.lessons[existingIdx] = sharedLesson;
        } else {
          state.lessons.unshift(sharedLesson);
        }
        saveLessons();
        state.activeGrade = Number(sharedLesson.grade) || 4;
        state.activeLessonId = sharedLesson.id;
        state.activeSlideIndex = 0;
        // Xóa hash cho gọn địa chỉ
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_e) {}
        renderStage();
        showToast(`🎁 Đã mở bài giảng được chia sẻ: "${sharedLesson.title}"!`);
      }
    } catch (err) {
      console.error('Decode shared lesson error:', err);
      showToast('⚠️ Đường link bài giảng chia sẻ không hợp lệ hoặc bị cắt bớt.');
    }
  }

  function init() {
    cacheDom();
    loadStorage();
    applyTheme(state.prefs.theme);
    applyFontScale(state.prefs.fontScale);
    initStageSplitter();
    initTutorDrag();
    if (global.CinemaFX) {
      global.CinemaFX.initParticles(dom.particleCanvas);
      global.CinemaFX.initWhiteboard(dom.drawCanvas);
    }
    populateVoices();
    bindEvents();
    const btnShare = $('btnShareLesson');
    if (btnShare) btnShare.addEventListener('click', shareCurrentLesson);
    renderStage();
    checkSharedLessonInUrl();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
