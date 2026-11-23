/**
 * Học Viện 4D Gia Đình — Bộ điều khiển giao diện chính (App Controller)
 * Kết nối Trình phát bài giảng 4D Song Não, Xưởng Tạo Bài Giảng 1 Chạm,
 * Bộ máy Tìm Media 3 Tầng và Chế độ Phụ huynh.
 */
(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    SETTINGS: 'hocvien4d_settings_v1',
    LESSONS: 'hocvien4d_lessons_v1',
    STARS: 'hocvien4d_stars_v1'
  };

  const state = {
    activeGrade: 4,
    lessons: [],
    activeLessonId: null,
    activeSlideIndex: 0,
    quizAnsweredMap: {}, // `${lessonId}_${page}` -> selectedIndex
    starsByGrade: { 4: 0, 7: 0, 10: 0 },
    settings: {
      geminiApiKey: '',
      geminiModel: 'gemini-3.5-flash-lite',
      youtubeApiKey: '',
      pixabayApiKey: '',
      voiceId: 'ai_co_minh_chau',
      voiceRate: 1
    },
    // Trạng thái Xưởng tạo bài giảng 1 chạm
    factory: {
      grade: 4,
      slideCount: 6,
      attachments: [],
      isGenerating: false,
      draftLesson: null
    },
    // Trạng thái hộp thoại Đổi Ảnh/Video
    mediaPicker: {
      target: null // { mode: 'stage' | 'draft', slideIndex: number }
    }
  };

  const dom = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function showToast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.add('hidden');
    }, 3400);
  }

  /* ==================== LƯU TRỮ LOCALSTORAGE ==================== */
  function loadStateFromStorage() {
    try {
      const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || 'null');
      if (savedSettings && typeof savedSettings === 'object') {
        state.settings = Object.assign({}, state.settings, savedSettings);
      }
    } catch (_e) {}

    try {
      const savedStars = JSON.parse(localStorage.getItem(STORAGE_KEYS.STARS) || 'null');
      if (savedStars && typeof savedStars === 'object') {
        state.starsByGrade = Object.assign({ 4: 0, 7: 0, 10: 0 }, savedStars);
      }
    } catch (_e) {}

    try {
      const savedLessons = JSON.parse(localStorage.getItem(STORAGE_KEYS.LESSONS) || 'null');
      if (Array.isArray(savedLessons) && savedLessons.length > 0) {
        state.lessons = savedLessons;
      } else {
        state.lessons = JSON.parse(JSON.stringify(global.SAMPLE_LESSONS || []));
      }
    } catch (_e) {
      state.lessons = JSON.parse(JSON.stringify(global.SAMPLE_LESSONS || []));
    }

    // Đảm bảo mỗi khối lớp đều có ít nhất bài mẫu nếu người dùng chưa có
    const samples = global.SAMPLE_LESSONS || [];
    for (const sample of samples) {
      const hasGrade = state.lessons.some((l) => Number(l.grade) === Number(sample.grade));
      if (!hasGrade) {
        state.lessons.push(JSON.parse(JSON.stringify(sample)));
      }
    }
  }

  function saveSettingsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
    } catch (_e) {
      showToast('⚠️ Không thể lưu cài đặt vào trình duyệt.');
    }
  }

  function saveLessonsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(state.lessons));
    } catch (_e) {
      showToast('⚠️ Bộ nhớ trình duyệt gần đầy! Hãy tải file JSON sao lưu bài giảng nhé.');
    }
  }

  function saveStarsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.STARS, JSON.stringify(state.starsByGrade));
    } catch (_e) {}
  }

  /* ==================== HELPER BÀI HỌC & GIỌNG ĐỌC ==================== */
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

  function setVoiceStatusNote(msg) {
    if (!dom.voiceStatusNote) return;
    if (!msg) {
      dom.voiceStatusNote.classList.add('hidden');
      dom.voiceStatusNote.textContent = '';
      return;
    }
    dom.voiceStatusNote.textContent = msg;
    dom.voiceStatusNote.classList.remove('hidden');
  }

  function populateVoiceOptions() {
    if (!dom.voicePersonaSelect || !global.VoiceStudio) return;
    const prevValue = state.settings.voiceId || 'ai_co_minh_chau';
    dom.voicePersonaSelect.innerHTML = '';

    // Nhóm 1: Giọng AI Người Việt Truyền Cảm (Gemini Studio)
    const aiGroup = document.createElement('optgroup');
    aiGroup.label = '🌟 Giọng AI Người Việt Truyền Cảm (Gemini Studio)';
    global.VoiceStudio.AI_PERSONAS.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      aiGroup.appendChild(opt);
    });
    dom.voicePersonaSelect.appendChild(aiGroup);

    // Nhóm 2: Giọng Việt Tự Nhiên Trình Duyệt (Miễn phí / Ngoại tuyến)
    const browserVoices = global.VoiceStudio.getVietnameseBrowserVoices();
    const browserGroup = document.createElement('optgroup');
    browserGroup.label = '💻 Giọng Việt Tự Nhiên Trình Duyệt (Miễn phí / Ngoại tuyến)';
    if (browserVoices.length > 0) {
      browserVoices.forEach((bv) => {
        const opt = document.createElement('option');
        opt.value = bv.id;
        opt.textContent = bv.label;
        browserGroup.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = 'browser::default_vi';
      opt.textContent = '🔊 Giọng Tiếng Việt mặc định trình duyệt (Ngoại tuyến)';
      browserGroup.appendChild(opt);
    }
    dom.voicePersonaSelect.appendChild(browserGroup);

    // Khôi phục lựa chọn trước đó
    const exists = Array.from(dom.voicePersonaSelect.options).some((o) => o.value === prevValue);
    dom.voicePersonaSelect.value = exists ? prevValue : 'ai_co_minh_chau';

    if (dom.voiceRateSelect) {
      dom.voiceRateSelect.value = String(state.settings.voiceRate || 1);
    }
  }

  function stopSpeech() {
    if (global.VoiceStudio) {
      global.VoiceStudio.stop();
    } else if ('speechSynthesis' in global) {
      global.speechSynthesis.cancel();
    }
    if (dom.btnStopSpeak) dom.btnStopSpeak.classList.add('hidden');
    if (dom.btnSpeakScript) {
      dom.btnSpeakScript.disabled = false;
      dom.btnSpeakScript.textContent = '🔊 Nghe giảng';
    }
    setVoiceStatusNote('');
  }

  function speakText(text) {
    if (!global.VoiceStudio) {
      showToast('Chưa tải mô-đun giọng giảng tiếng Việt.');
      return;
    }
    const voiceId = (dom.voicePersonaSelect && dom.voicePersonaSelect.value) || state.settings.voiceId || 'ai_co_minh_chau';
    const rate = Number((dom.voiceRateSelect && dom.voiceRateSelect.value) || state.settings.voiceRate || 1);

    global.VoiceStudio.speak({
      text,
      voiceId,
      rate,
      apiKey: state.settings.geminiApiKey,
      onLoading: (msg) => {
        dom.btnStopSpeak.classList.remove('hidden');
        dom.btnSpeakScript.disabled = true;
        dom.btnSpeakScript.textContent = '⏳ Đang thu âm...';
        setVoiceStatusNote(msg);
      },
      onStart: (speakerName) => {
        dom.btnStopSpeak.classList.remove('hidden');
        dom.btnSpeakScript.disabled = false;
        dom.btnSpeakScript.textContent = '🔊 Đang giảng...';
        setVoiceStatusNote(`🎙️ Đang giảng bài: ${speakerName}`);
      },
      onFallback: (reason) => {
        setVoiceStatusNote(`ℹ️ ${reason}`);
      },
      onEnd: () => {
        if (dom.btnStopSpeak) dom.btnStopSpeak.classList.add('hidden');
        if (dom.btnSpeakScript) {
          dom.btnSpeakScript.disabled = false;
          dom.btnSpeakScript.textContent = '🔊 Nghe giảng';
        }
        setVoiceStatusNote('');
      },
      onError: (errMsg) => {
        stopSpeech();
        showToast(`⚠️ ${errMsg}`);
      }
    });
  }

  function downloadLessonJson(lesson) {
    if (!lesson) return;
    const safeSlug = String(lesson.title || 'bai_giang_4d')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50);
    const filename = `HocVien4D_Lop${lesson.grade}_${safeSlug || 'bai_hoc'}.json`;
    const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`💾 Đã tải xuống file sao lưu: ${filename}`);
  }

  /* ==================== RENDER MEDIA AN TOÀN (ZERO-EMPTY-SLIDE) ==================== */
  function renderSanitizedSvgInto(container, slide) {
    const safeSvg = global.MediaFinder.sanitizeSVG(
      slide.fallback_svg,
      slide.heading,
      slide.heart_message
    );
    const host = document.createElement('div');
    host.className = 'media-svg-host';
    host.innerHTML = safeSvg;
    container.innerHTML = '';
    container.appendChild(host);
  }

  function renderYouTubeFallbackCard(container, videoId, slide) {
    const watchUrl = global.MediaFinder.buildYouTubeWatchUrl(videoId);
    const thumbUrl = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
    const card = document.createElement('div');
    card.className = 'yt-poster-card';
    card.innerHTML = `
      <img class="yt-poster-img" src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(slide.media_title || slide.heading)}" />
      <div class="yt-poster-overlay">
        <a class="yt-play-btn" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Xem video trên YouTube">▶</a>
        <div class="yt-poster-title">${escapeHtml(slide.media_title || slide.heading || 'Video minh họa YouTube')}</div>
        <div class="yt-poster-hint">
          Đang mở trực tiếp tệp nội bộ (file://) nên trình duyệt ẩn Referer của YouTube.
          Bấm nút ▶ để xem ngay trên YouTube hoặc chạy <strong>Mo_HocVien4D.bat</strong> để phát trực tiếp trong bài giảng.
        </div>
      </div>
    `;
    const imgEl = card.querySelector('.yt-poster-img');
    if (imgEl) {
      imgEl.onerror = () => renderSanitizedSvgInto(container, slide);
    }
    container.innerHTML = '';
    container.appendChild(card);
  }

  let activeYtPlayer = null;
  let ytApiPromise = null;

  function destroyActiveYtPlayer() {
    if (activeYtPlayer) {
      try {
        if (typeof activeYtPlayer.destroy === 'function') {
          activeYtPlayer.destroy();
        }
      } catch (_e) {}
      activeYtPlayer = null;
    }
  }

  /**
   * Nạp YouTube IFrame Player API chính thức từ Google để phát video TRỰC TIẾP trên màn hình ứng dụng
   * và tự động phát hiện / đổi video dự phòng ngay nếu kênh chủ video chặn nhúng (Error 101/150/153).
   */
  function ensureYouTubeApiReady() {
    if (global.YT && typeof global.YT.Player === 'function') {
      return Promise.resolve(global.YT);
    }
    if (ytApiPromise) return ytApiPromise;

    ytApiPromise = new Promise((resolve, reject) => {
      const prevReady = global.onYouTubeIframeAPIReady;
      const timer = setTimeout(() => {
        reject(new Error('YouTube IFrame API timeout'));
      }, 6000);

      global.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        if (typeof prevReady === 'function') {
          try {
            prevReady();
          } catch (_e) {}
        }
        resolve(global.YT);
      };

      const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existing) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Không thể tải YouTube IFrame API'));
        };
        document.head.appendChild(tag);
      }
    });

    return ytApiPromise;
  }

  function mountDirectYouTubeIframe(container, videoId, slide) {
    const cleanEmbedUrl = global.MediaFinder.buildYouTubeEmbedUrl(videoId);
    const iframe = document.createElement('iframe');
    // BẮT BUỘC đặt referrerpolicy="origin" TRƯỚC khi gán src để gửi đúng HTTP Referer
    iframe.setAttribute('referrerpolicy', 'origin');
    iframe.referrerPolicy = 'origin';
    iframe.setAttribute('frameborder', '0');
    iframe.title = slide.media_title || slide.heading || 'Video minh họa bài giảng';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    iframe.allowFullscreen = true;
    iframe.src = cleanEmbedUrl;
    container.innerHTML = '';
    container.appendChild(iframe);
  }

  function mountInlineYouTubePlayer(container, videoId, slide, triedIds) {
    destroyActiveYtPlayer();
    const tried = triedIds instanceof Set ? triedIds : new Set();
    tried.add(videoId);

    // Khi mở file:// trực tiếp không qua máy chủ cục bộ -> trình duyệt không gửi HTTP Referer nên YouTube từ chối nhúng
    if (global.location && global.location.protocol === 'file:') {
      renderYouTubeFallbackCard(container, videoId, slide);
      return;
    }

    const iframeId = `yt_iframe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cleanEmbedUrl = global.MediaFinder.buildYouTubeEmbedUrl(videoId);
    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    // BẮT BUỘC đặt referrerpolicy="origin" TRƯỚC khi gán src để trình duyệt gửi đúng HTTP Referer từ request đầu tiên
    iframe.setAttribute('referrerpolicy', 'origin');
    iframe.referrerPolicy = 'origin';
    iframe.setAttribute('frameborder', '0');
    iframe.title = slide.media_title || slide.heading || 'Video minh họa bài giảng';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    iframe.allowFullscreen = true;
    iframe.src = cleanEmbedUrl;

    container.innerHTML = '';
    container.appendChild(iframe);

    // Gắn YouTube IFrame API vào chính thẻ iframe vừa tạo để lắng nghe onError (101/150/100/153) và tự đổi video dự phòng ngay trên màn hình
    ensureYouTubeApiReady()
      .then((YT) => {
        if (!document.getElementById(iframeId)) return;
        activeYtPlayer = new YT.Player(iframeId, {
          events: {
            onError: (ev) => {
              const code = ev && ev.data;
              console.warn('[YouTube Player] Lỗi phát trực tiếp mã:', code, 'videoId:', videoId);

              const allVideos =
                slide.media_candidates && Array.isArray(slide.media_candidates.videos)
                  ? slide.media_candidates.videos
                  : [];
              const nextCandidateIdx = allVideos.findIndex((v) => v && v.id && !tried.has(v.id));

              if (nextCandidateIdx !== -1 && code !== 153) {
                const nextVideo = allVideos[nextCandidateIdx];
                slide.media_url = nextVideo.embedUrl || global.MediaFinder.buildYouTubeEmbedUrl(nextVideo.id);
                slide.media_title = nextVideo.title;
                slide.media_video_index = nextCandidateIdx;
                slide.media_source = `YouTube An Toàn (Video ${nextCandidateIdx + 1}/${allVideos.length})`;
                saveLessonsToStorage();
                if (dom.slideMediaSource) {
                  dom.slideMediaSource.textContent = `📺 Nguồn: ${slide.media_source}`;
                }
                if (dom.btnOpenYoutubeExternal) {
                  dom.btnOpenYoutubeExternal.href = global.MediaFinder.buildYouTubeWatchUrl(nextVideo.id);
                }
                showToast(
                  '🔄 Video trước bị kênh chủ hạn chế phát nhúng — đã tự chuyển sang video YouTube khác ngay trên màn hình!'
                );
                mountInlineYouTubePlayer(container, nextVideo.id, slide, tried);
                return;
              }

              if (code === 153) {
                showToast(
                  '⚠️ Trình duyệt tích hợp đang chặn Referer YouTube (Error 153). Hãy mở http://localhost:8765/index.html bằng Chrome hoặc Edge (hoặc chạy Mo_HocVien4D.bat) để phát YouTube trực tiếp!'
                );
              }
            }
          }
        });
      })
      .catch(() => {
        // Iframe trực tiếp ở trên vẫn hoạt động bình thường ngay cả khi iframe_api không tải được
      });
  }

  function renderSlideMediaInto(container, slide) {
    destroyActiveYtPlayer();
    container.innerHTML = '';

    if (slide.media_type === 'youtube' && slide.media_url) {
      const videoId = global.MediaFinder.parseYouTubeId(slide.media_url);
      if (!videoId) {
        renderSanitizedSvgInto(container, slide);
        return;
      }
      mountInlineYouTubePlayer(container, videoId, slide);
      return;
    }

    if (slide.media_type === 'image' && slide.media_url) {
      const img = document.createElement('img');
      img.src = slide.media_url;
      img.alt = slide.media_title || slide.heading || 'Ảnh minh họa bài học';
      img.loading = 'lazy';
      // Zero-Empty-Slide: nếu ảnh lỗi hoặc mất mạng -> lập tức hiển thị fallback_svg
      img.onerror = () => {
        renderSanitizedSvgInto(container, slide);
      };
      container.appendChild(img);
      return;
    }

    renderSanitizedSvgInto(container, slide);
  }

  /* ==================== RENDER GIAO DIỆN HỌC TẬP ==================== */
  function renderProfileUI() {
    document.body.setAttribute('data-grade', String(state.activeGrade));

    document.querySelectorAll('.profile-tab').forEach((btn) => {
      const g = Number(btn.dataset.profileGrade);
      btn.classList.toggle('active', g === state.activeGrade);
    });

    dom.sidebarProfileTitle.textContent = `📚 Kho Bài Học — Lớp ${state.activeGrade}`;
    dom.profileStarsBadge.textContent = `⭐ ${state.starsByGrade[state.activeGrade] || 0} sao`;

    renderLessonList();
    renderStage();
  }

  function renderLessonList() {
    const list = getLessonsForGrade(state.activeGrade);
    dom.lessonList.innerHTML = '';

    if (list.length === 0) {
      dom.lessonList.innerHTML = `
        <div class="alert-box alert-info">
          Chưa có bài học nào cho Lớp ${state.activeGrade}. Hãy bấm <strong>✨ Tạo Bài Học Mới (1 Chạm)</strong> nhé!
        </div>
      `;
      return;
    }

    const active = getActiveLesson();

    list.forEach((lesson) => {
      const item = document.createElement('div');
      item.className = `lesson-item${active && active.id === lesson.id ? ' active' : ''}`;
      item.innerHTML = `
        <div class="lesson-item-title">${escapeHtml(lesson.title)}</div>
        <div class="lesson-item-meta">
          <span>📘 ${escapeHtml(lesson.subject || 'Bài học 4D')}</span>
          <span>• ${lesson.slides ? lesson.slides.length : 0} trang</span>
        </div>
      `;

      item.addEventListener('click', () => {
        stopSpeech();
        state.activeLessonId = lesson.id;
        state.activeSlideIndex = 0;
        renderLessonList();
        renderStage();
      });

      // Cho phép xóa bài người dùng tự tạo (không xóa bài mẫu mặc định duy nhất)
      if (list.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'lesson-delete-btn';
        delBtn.title = 'Xóa bài học này';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Xóa bài giảng "${lesson.title}" khỏi hồ sơ Lớp ${state.activeGrade}?`)) {
            state.lessons = state.lessons.filter((l) => l.id !== lesson.id);
            if (state.activeLessonId === lesson.id) {
              state.activeLessonId = null;
              state.activeSlideIndex = 0;
            }
            saveLessonsToStorage();
            renderLessonList();
            renderStage();
            showToast('🗑️ Đã xóa bài học.');
          }
        });
        item.appendChild(delBtn);
      }

      dom.lessonList.appendChild(item);
    });
  }

  function renderStage() {
    stopSpeech();
    const lesson = getActiveLesson();
    if (!lesson || !Array.isArray(lesson.slides) || lesson.slides.length === 0) {
      dom.slideHeading.textContent = 'Chưa có bài giảng để hiển thị';
      return;
    }

    if (state.activeSlideIndex < 0) state.activeSlideIndex = 0;
    if (state.activeSlideIndex >= lesson.slides.length) {
      state.activeSlideIndex = lesson.slides.length - 1;
    }

    const slide = lesson.slides[state.activeSlideIndex];
    const total = lesson.slides.length;
    const profile = global.AILessonFactory.GRADE_PROFILES[lesson.grade] || global.AILessonFactory.GRADE_PROFILES[4];

    dom.stageGradeBadge.textContent = profile.label;
    dom.stageSubjectBadge.textContent = lesson.subject || 'Kiến thức 4D';
    dom.stagePageBadge.textContent = `Trang ${state.activeSlideIndex + 1} / ${total}`;
    dom.slideHeading.textContent = slide.heading;
    dom.stageLessonTitleSmall.textContent = lesson.title;
    dom.slideProgressFill.style.width = `${Math.round(((state.activeSlideIndex + 1) / total) * 100)}%`;

    // Media Stage
    renderSlideMediaInto(dom.slideMediaFrame, slide);

    const icon = slide.media_type === 'youtube' ? '📺' : slide.media_type === 'image' ? '🖼️' : '🎨';
    dom.slideMediaSource.textContent = `${icon} Nguồn: ${slide.media_source || 'Sơ đồ minh họa AI (SVG)'}`;

    // Nút mở nhanh trên YouTube dự phòng nếu kênh chủ video chặn nhúng
    if (dom.btnOpenYoutubeExternal) {
      const ytId = slide.media_type === 'youtube' ? global.MediaFinder.parseYouTubeId(slide.media_url) : null;
      if (ytId) {
        dom.btnOpenYoutubeExternal.href = global.MediaFinder.buildYouTubeWatchUrl(ytId);
        dom.btnOpenYoutubeExternal.classList.remove('hidden');
      } else {
        dom.btnOpenYoutubeExternal.classList.add('hidden');
      }
    }

    // Hiện nút "🔄 Đổi video khác" 1 chạm nếu có >= 2 video YouTube gợi ý
    const ytVideos =
      slide.media_candidates && Array.isArray(slide.media_candidates.videos)
        ? slide.media_candidates.videos
        : [];
    if (ytVideos.length > 1) {
      dom.btnQuickNextVideo.classList.remove('hidden');
    } else {
      dom.btnQuickNextVideo.classList.add('hidden');
    }

    // Heart Message & Script
    dom.slideHeartMessage.textContent = slide.heart_message;
    dom.slideScript.textContent = slide.script;

    // 3D Flip Card
    dom.flipCardInner.classList.remove('is-flipped');
    dom.flipFrontLabel.textContent = `❌ ${profile.flipBeforeTitle}`;
    dom.flipBackLabel.textContent = `✨ ${profile.flipAfterTitle}`;
    dom.flipBeforeText.textContent = (slide.flip_card && slide.flip_card.before) || '';
    dom.flipAfterText.textContent = (slide.flip_card && slide.flip_card.after) || '';

    // Quick Check Quiz
    renderQuiz(lesson, slide);

    // Điều hướng
    dom.btnPrevSlide.disabled = state.activeSlideIndex === 0;
    dom.btnNextSlide.textContent =
      state.activeSlideIndex === total - 1 ? '🎉 Hoàn thành bài học' : 'Trang tiếp theo ➡️';
  }

  function renderQuiz(lesson, slide) {
    const qc = slide.quick_check || {
      question: '',
      options: [],
      correct_index: 0,
      explanation: ''
    };
    const key = `${lesson.id}_${slide.page}`;
    const answeredIdx = state.quizAnsweredMap[key];

    dom.quizQuestion.textContent = qc.question;
    dom.quizOptions.innerHTML = '';
    dom.quizFeedback.classList.add('hidden');
    dom.quizFeedback.className = 'quiz-feedback hidden';

    const letters = ['A', 'B', 'C', 'D'];
    (qc.options || []).forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-opt';
      btn.innerHTML = `<span class="quiz-letter">${letters[idx] || idx + 1}</span><span>${escapeHtml(optText)}</span>`;

      if (answeredIdx !== undefined) {
        btn.disabled = true;
        if (idx === qc.correct_index) btn.classList.add('correct');
        else if (idx === answeredIdx) btn.classList.add('wrong');
      }

      btn.addEventListener('click', () => {
        if (state.quizAnsweredMap[key] !== undefined) return;
        state.quizAnsweredMap[key] = idx;
        const isCorrect = idx === qc.correct_index;
        if (isCorrect) {
          state.starsByGrade[lesson.grade] = (state.starsByGrade[lesson.grade] || 0) + 1;
          saveStarsToStorage();
          dom.profileStarsBadge.textContent = `⭐ ${state.starsByGrade[state.activeGrade] || 0} sao`;
        }
        renderQuiz(lesson, slide);
      });

      dom.quizOptions.appendChild(btn);
    });

    if (answeredIdx !== undefined) {
      const isCorrect = answeredIdx === qc.correct_index;
      dom.quizFeedback.classList.remove('hidden');
      dom.quizFeedback.classList.add(isCorrect ? 'ok' : 'err');
      dom.quizFeedback.textContent = isCorrect
        ? `🌟 Tuyệt vời (+1 sao)! ${qc.explanation}`
        : `💡 Gần đúng rồi! ${qc.explanation}`;
    }
  }

  /* ==================== MODAL QUẢN LÝ CHUNG ==================== */
  function openModal(modalId) {
    const el = $(modalId);
    if (el) el.classList.remove('hidden');
  }

  function closeModal(modalId) {
    const el = $(modalId);
    if (el) el.classList.add('hidden');
  }

  /* ==================== CHẾ ĐỘ PHỤ HUYNH ==================== */
  function openParentModal() {
    dom.inputGeminiKey.value = state.settings.geminiApiKey || '';
    dom.selectGeminiModel.value = state.settings.geminiModel || global.AILessonFactory.DEFAULT_MODEL;
    dom.inputYoutubeKey.value = state.settings.youtubeApiKey || '';
    dom.inputPixabayKey.value = state.settings.pixabayApiKey || '';
    openModal('parentModal');
  }

  function handleSaveParentSettings(e) {
    e.preventDefault();
    state.settings.geminiApiKey = dom.inputGeminiKey.value.trim();
    state.settings.geminiModel = dom.selectGeminiModel.value || global.AILessonFactory.DEFAULT_MODEL;
    state.settings.youtubeApiKey = dom.inputYoutubeKey.value.trim();
    state.settings.pixabayApiKey = dom.inputPixabayKey.value.trim();
    saveSettingsToStorage();
    updateFactoryApiHint();
    closeModal('parentModal');
    showToast('✅ Đã lưu cài đặt API Phụ huynh an toàn trên máy!');
  }

  /* ==================== XƯỞNG TẠO BÀI GIẢNG 4D (1 CHẠM) ==================== */
  function updateFactoryApiHint() {
    if (!dom.factoryApiStatusHint) return;
    if (state.settings.geminiApiKey) {
      const mediaInfo = state.settings.youtubeApiKey
        ? 'YouTube + Ảnh + SVG'
        : state.settings.pixabayApiKey
          ? 'Pixabay + SVG'
          : 'Wikimedia Miễn Phí + SVG';
      dom.factoryApiStatusHint.textContent = `✅ Đã sẵn sàng AI (${state.settings.geminiModel}) • Media: ${mediaInfo}`;
      dom.factoryApiStatusHint.style.color = '#059669';
    } else {
      dom.factoryApiStatusHint.textContent = '⚠️ Chưa có Gemini API Key — Bấm "Chế Độ Phụ Huynh" để nhập trước khi chạy.';
      dom.factoryApiStatusHint.style.color = '#b45309';
    }
  }

  function setFactoryGrade(grade) {
    const numGrade = Number(grade) || 4;
    state.factory.grade = numGrade;
    const profile = global.AILessonFactory.GRADE_PROFILES[numGrade] || global.AILessonFactory.GRADE_PROFILES[4];
    state.factory.slideCount = profile.defaultSlides;

    dom.factoryGradeCards.querySelectorAll('.grade-card').forEach((card) => {
      card.classList.toggle('selected', Number(card.dataset.factoryGrade) === numGrade);
    });
    updateSlideCountPills();
  }

  function updateSlideCountPills() {
    dom.slideCountPills.querySelectorAll('.count-pill').forEach((pill) => {
      pill.classList.toggle('active', Number(pill.dataset.slideCount) === state.factory.slideCount);
    });
  }

  function showFactoryError(msg) {
    if (!msg) {
      dom.factoryErrorBox.classList.add('hidden');
      dom.factoryErrorBox.textContent = '';
      return;
    }
    dom.factoryErrorBox.textContent = `⚠️ ${msg}`;
    dom.factoryErrorBox.classList.remove('hidden');
    // Cuộn mượt lên hộp cảnh báo để phụ huynh thấy ngay dù đang ở cuối modal
    if (typeof dom.factoryErrorBox.scrollIntoView === 'function') {
      dom.factoryErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function openFactoryModal() {
    showFactoryError('');
    setFactoryGrade(state.activeGrade);
    updateFactoryApiHint();

    // Nếu không đang có bản nháp review, hiển thị form nhập liệu
    if (!state.factory.draftLesson) {
      dom.factoryInputView.classList.remove('hidden');
      dom.factoryProgressPanel.classList.add('hidden');
      dom.factoryReviewView.classList.add('hidden');
    }
    openModal('factoryModal');
  }

  function renderAttachmentsGrid() {
    const list = state.factory.attachments;
    dom.attachmentsGrid.innerHTML = '';

    if (list.length === 0) {
      dom.attachmentsGrid.classList.add('hidden');
      return;
    }

    dom.attachmentsGrid.classList.remove('hidden');
    const fmt = global.AILessonFactory.formatBytes;

    list.forEach((att) => {
      const card = document.createElement('div');
      card.className = 'att-card';

      if (att.kind === 'image') {
        card.innerHTML = `
          <img class="att-thumb" src="${att.dataUrl}" alt="${escapeHtml(att.name)}" />
          <div class="att-info">
            <div class="att-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</div>
            <div class="att-meta">Nén ${att.width}×${att.height} • ${fmt(att.compressedSize)}</div>
          </div>
        `;
      } else {
        const icon = att.kind === 'pdf' ? '📕 PDF' : '📝 TXT';
        card.innerHTML = `
          <div class="att-doc-thumb">${icon}</div>
          <div class="att-info">
            <div class="att-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</div>
            <div class="att-meta">${fmt(att.originalSize)}</div>
          </div>
        `;
      }

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'att-remove';
      removeBtn.title = 'Gỡ bỏ tệp này';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        state.factory.attachments = state.factory.attachments.filter((a) => a.id !== att.id);
        renderAttachmentsGrid();
      });

      card.appendChild(removeBtn);
      dom.attachmentsGrid.appendChild(card);
    });
  }

  async function addFilesToFactory(fileList) {
    if (!fileList || fileList.length === 0) return;
    showFactoryError('');
    const errors = [];

    for (const file of Array.from(fileList)) {
      try {
        const processed = await global.AILessonFactory.processInputFile(file);
        state.factory.attachments.push(processed);
      } catch (err) {
        errors.push(err.message);
      }
    }

    renderAttachmentsGrid();
    if (errors.length > 0) {
      showFactoryError(errors.join(' '));
    } else {
      showToast(`📎 Đã nạp & tối ưu ${fileList.length} tệp sẵn sàng gửi AI!`);
    }
  }

  /**
   * Hỗ trợ dán ảnh hoặc tệp (PDF/TXT/Ảnh) trực tiếp bằng Ctrl+V khi hộp thoại Xưởng Tạo Bài Học đang mở.
   */
  async function handleGlobalPaste(event) {
    if (dom.factoryModal.classList.contains('hidden')) return;
    if (state.factory.isGenerating) return;

    const clipboardData = event.clipboardData || global.clipboardData;
    if (!clipboardData) return;

    const pastedFiles = [];
    if (clipboardData.items) {
      for (const item of Array.from(clipboardData.items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) pastedFiles.push(f);
        }
      }
    }
    if (pastedFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
      pastedFiles.push(...Array.from(clipboardData.files));
    }

    // Chỉ chặn hành vi mặc định nếu clipboard có ảnh hoặc tệp; nếu là văn bản thì để dán bình thường vào ô ghi chú
    if (pastedFiles.length === 0) return;
    event.preventDefault();
    showFactoryError('');

    const errors = [];
    let addedCount = 0;
    for (const file of pastedFiles) {
      try {
        const isUnnamedImg =
          file.type && file.type.startsWith('image/') && (!file.name || file.name === 'image.png');
        const processed = isUnnamedImg
          ? await global.AILessonFactory.compressImageFile(
              file,
              `anh_dan_${state.factory.attachments.length + 1}.jpg`
            )
          : await global.AILessonFactory.processInputFile(file);
        state.factory.attachments.push(processed);
        addedCount++;
      } catch (err) {
        errors.push(err.message);
      }
    }

    renderAttachmentsGrid();
    if (errors.length > 0) {
      showFactoryError(errors.join(' '));
    } else if (addedCount > 0) {
      showToast(`📋 Đã dán & tối ưu ${addedCount} tệp từ bộ nhớ tạm!`);
    }
  }

  function updateProgressUI(stepNum, message, percent) {
    dom.factoryProgressPanel.classList.remove('hidden');
    dom.factoryProgressBar.style.width = `${Math.max(5, Math.min(100, percent || 0))}%`;
    dom.factoryProgressMsg.textContent = message;

    dom.factoryProgressPanel.querySelectorAll('.step-chip').forEach((chip) => {
      const s = Number(chip.dataset.step);
      chip.classList.remove('active', 'done');
      if (s < stepNum) chip.classList.add('done');
      else if (s === stepNum) chip.classList.add(stepNum === 4 ? 'done' : 'active');
    });
  }

  function renderDraftReview() {
    const lesson = state.factory.draftLesson;
    if (!lesson) return;

    dom.factoryInputView.classList.add('hidden');
    dom.factoryReviewView.classList.remove('hidden');

    const profile = global.AILessonFactory.GRADE_PROFILES[lesson.grade] || global.AILessonFactory.GRADE_PROFILES[4];
    dom.reviewLessonTitle.textContent = `🎉 ${lesson.title}`;
    dom.reviewLessonMeta.textContent = `${profile.label} • ${lesson.subject} • ${lesson.slides.length} trang bài giảng 4D`;

    dom.reviewSlidesGrid.innerHTML = '';

    lesson.slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = 'review-slide-card';

      const thumb = document.createElement('div');
      thumb.className = 'review-media-thumb';

      if (slide.media_type === 'youtube' && slide.media_url) {
        const ytId = global.MediaFinder.parseYouTubeId(slide.media_url);
        const ytImg = document.createElement('img');
        ytImg.src = ytId ? `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg` : '';
        ytImg.alt = slide.heading;
        ytImg.onerror = () => renderSanitizedSvgInto(thumb, slide);
        thumb.appendChild(ytImg);
        const badge = document.createElement('span');
        badge.className = 'review-yt-badge';
        badge.textContent = '▶ YouTube';
        thumb.appendChild(badge);
      } else if (slide.media_type === 'image' && slide.media_url) {
        const img = document.createElement('img');
        img.src = slide.media_url;
        img.alt = slide.heading;
        img.onerror = () => renderSanitizedSvgInto(thumb, slide);
        thumb.appendChild(img);
      } else {
        renderSanitizedSvgInto(thumb, slide);
      }

      const body = document.createElement('div');
      body.className = 'review-slide-body';
      body.innerHTML = `
        <h4 class="review-slide-title">Trang ${slide.page}: ${escapeHtml(slide.heading)}</h4>
        <p class="review-slide-heart">💡 ${escapeHtml(slide.heart_message)}</p>
      `;

      const swapBtn = document.createElement('button');
      swapBtn.type = 'button';
      swapBtn.className = 'btn btn-secondary btn-sm';
      swapBtn.textContent = '🔍 Đổi ảnh/video';
      swapBtn.addEventListener('click', () => openMediaPicker('draft', idx));

      body.appendChild(swapBtn);
      card.appendChild(thumb);
      card.appendChild(body);
      dom.reviewSlidesGrid.appendChild(card);
    });
  }

  async function handleStartGenerate() {
    if (state.factory.isGenerating) return;
    showFactoryError('');

    const topicText = dom.factoryTopicInput.value.trim();
    const autoMedia = dom.factoryAutoMediaToggle.checked;

    // Kiểm tra nhanh đầu vào & API key trước khi ẩn form để phản hồi tức thì
    if (!String(state.settings.geminiApiKey || '').trim()) {
      showFactoryError(
        'Chưa nhập Gemini API Key! Vui lòng bấm nút "👨‍👩‍👧 Chế Độ Phụ Huynh" để dán Gemini API Key trước khi tạo bài giảng.'
      );
      return;
    }
    if (!topicText && state.factory.attachments.length === 0) {
      showFactoryError(
        'Vui lòng dán ảnh/tệp (Ctrl+V), chọn file PDF/Ảnh/TXT hoặc nhập tên chủ đề cần học trước khi khởi tạo!'
      );
      return;
    }

    state.factory.isGenerating = true;
    dom.btnStartGenerate.disabled = true;
    dom.btnStartGenerate.textContent = '⏳ Đang khởi tạo bài giảng 4D...';

    // Ẩn form nhập & hiện ngay bảng tiến trình 4 bước ở giữa hộp thoại để người dùng thấy rõ đang chạy
    dom.factoryInputView.classList.add('hidden');
    updateProgressUI(1, 'Đang đọc nội dung & phân tích hình ảnh/tài liệu...', 12);

    try {
      const lesson = await global.AILessonFactory.generateLesson({
        grade: state.factory.grade,
        slideCount: state.factory.slideCount,
        topicText,
        attachments: state.factory.attachments,
        apiKey: state.settings.geminiApiKey,
        model: state.settings.geminiModel,
        autoMedia,
        mediaSettings: {
          youtubeApiKey: state.settings.youtubeApiKey,
          pixabayApiKey: state.settings.pixabayApiKey
        },
        onStage: (stepNum, message, meta) => {
          updateProgressUI(stepNum, message, meta && meta.percent);
        }
      });

      state.factory.draftLesson = lesson;
      renderDraftReview();
      showToast('🎉 Đã biên soạn xong bài giảng 4D hoàn chỉnh!');
    } catch (err) {
      dom.factoryProgressPanel.classList.add('hidden');
      dom.factoryInputView.classList.remove('hidden');
      showFactoryError(err.message || 'Đã xảy ra lỗi không xác định khi tạo bài giảng.');
    } finally {
      state.factory.isGenerating = false;
      dom.btnStartGenerate.disabled = false;
      dom.btnStartGenerate.textContent = '🚀 Khởi Tạo Bài Giảng 4D';
    }
  }

  function handleLaunchDraftLesson() {
    const lesson = state.factory.draftLesson;
    if (!lesson) return;

    // Lưu vào đầu danh sách bài học của đúng hồ sơ con và mở học ngay
    state.lessons.unshift(lesson);
    saveLessonsToStorage();

    state.activeGrade = Number(lesson.grade) || 4;
    state.activeLessonId = lesson.id;
    state.activeSlideIndex = 0;

    // Dọn bộ nhớ đính kèm để giải phóng RAM ngay sau khi tạo xong
    state.factory.attachments = [];
    state.factory.draftLesson = null;
    dom.factoryTopicInput.value = '';
    renderAttachmentsGrid();
    dom.factoryInputView.classList.remove('hidden');
    dom.factoryProgressPanel.classList.add('hidden');
    dom.factoryReviewView.classList.add('hidden');

    closeModal('factoryModal');
    renderProfileUI();
    showToast(`🎓 Đã lưu vào Lớp ${lesson.grade} và mở bài giảng ngay!`);
  }

  /* ==================== MODAL ĐỔI ẢNH / VIDEO MINH HỌA ==================== */
  function getTargetSlideForPicker() {
    const target = state.mediaPicker.target;
    if (!target) return null;
    if (target.mode === 'draft' && state.factory.draftLesson) {
      return {
        lesson: state.factory.draftLesson,
        slide: state.factory.draftLesson.slides[target.slideIndex]
      };
    }
    const lesson = getActiveLesson();
    if (!lesson) return null;
    return {
      lesson,
      slide: lesson.slides[target.slideIndex]
    };
  }

  function applyMediaChoiceToTarget(updateFn) {
    const ctx = getTargetSlideForPicker();
    if (!ctx || !ctx.slide) return;
    updateFn(ctx.slide);

    if (state.mediaPicker.target.mode === 'draft') {
      renderDraftReview();
    } else {
      saveLessonsToStorage();
      renderStage();
    }
    closeModal('mediaPickerModal');
    showToast('✅ Đã cập nhật ảnh/video minh họa cho trang này!');
  }

  function renderMediaPickerChoices(slide) {
    const videos =
      slide.media_candidates && Array.isArray(slide.media_candidates.videos)
        ? slide.media_candidates.videos
        : [];
    const images =
      slide.media_candidates && Array.isArray(slide.media_candidates.images)
        ? slide.media_candidates.images
        : [];

    // Video gợi ý
    dom.pickerVideosGrid.innerHTML = '';
    if (videos.length > 0) {
      dom.pickerVideosSection.classList.remove('hidden');
      videos.forEach((v, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'media-choice';
        btn.innerHTML = `
          <img src="${escapeHtml(v.thumbnail)}" alt="${escapeHtml(v.title)}" />
          <div class="media-choice-caption">▶ ${escapeHtml(v.title)}</div>
        `;
        btn.addEventListener('click', () => {
          applyMediaChoiceToTarget((s) => {
            s.media_type = 'youtube';
            s.media_url = v.embedUrl;
            s.media_source = 'YouTube An Toàn';
            s.media_title = v.title;
            s.media_video_index = idx;
          });
        });
        dom.pickerVideosGrid.appendChild(btn);
      });
    } else {
      dom.pickerVideosSection.classList.add('hidden');
    }

    // Ảnh gợi ý + Sơ đồ SVG tích hợp sẵn
    dom.pickerImagesGrid.innerHTML = '';

    // Luôn có thẻ chọn Sơ đồ SVG tích hợp sẵn (Offline 100%)
    const svgChoice = document.createElement('button');
    svgChoice.type = 'button';
    svgChoice.className = 'media-choice';
    const svgBox = document.createElement('div');
    svgBox.className = 'choice-svg';
    svgBox.innerHTML = global.MediaFinder.sanitizeSVG(slide.fallback_svg, slide.heading, slide.heart_message);
    const svgCap = document.createElement('div');
    svgCap.className = 'media-choice-caption';
    svgCap.textContent = '🎨 Sơ đồ AI tích hợp sẵn (Học ngoại tuyến)';
    svgChoice.appendChild(svgBox);
    svgChoice.appendChild(svgCap);
    svgChoice.addEventListener('click', () => {
      applyMediaChoiceToTarget((s) => {
        s.media_type = 'svg';
        s.media_url = '';
        s.media_source = 'Sơ đồ minh họa AI (SVG)';
        s.media_title = s.heading;
      });
    });
    dom.pickerImagesGrid.appendChild(svgChoice);

    images.forEach((imgObj, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'media-choice';
      btn.innerHTML = `
        <img src="${escapeHtml(imgObj.thumb || imgObj.url)}" alt="${escapeHtml(imgObj.title)}" loading="lazy" />
        <div class="media-choice-caption">🖼️ ${escapeHtml(imgObj.title)} (${escapeHtml(imgObj.source)})</div>
      `;
      btn.addEventListener('click', () => {
        applyMediaChoiceToTarget((s) => {
          s.media_type = 'image';
          s.media_url = imgObj.url;
          s.media_source = imgObj.source || 'Ảnh minh họa';
          s.media_title = imgObj.title || s.heading;
          s.media_image_index = idx;
        });
      });
      dom.pickerImagesGrid.appendChild(btn);
    });
  }

  function openMediaPicker(mode, slideIndex) {
    state.mediaPicker.target = { mode, slideIndex };
    const ctx = getTargetSlideForPicker();
    if (!ctx || !ctx.slide) return;

    const slide = ctx.slide;
    dom.customMediaUrlInput.value = '';
    dom.liveImageSearchInput.value = slide.image_search_query || slide.heading || '';
    dom.pickerVisualPromptText.textContent = slide.visual_prompt || '';
    renderMediaPickerChoices(slide);
    openModal('mediaPickerModal');
  }

  function handleApplyCustomMedia() {
    const rawUrl = dom.customMediaUrlInput.value.trim();
    if (!rawUrl) {
      showToast('⚠️ Vui lòng dán đường dẫn YouTube hoặc URL hình ảnh.');
      return;
    }

    const ytId = global.MediaFinder.parseYouTubeId(rawUrl);
    if (ytId) {
      applyMediaChoiceToTarget((s) => {
        s.media_type = 'youtube';
        s.media_url = global.MediaFinder.buildYouTubeEmbedUrl(ytId);
        s.media_source = 'YouTube (Phụ huynh chọn)';
        s.media_title = s.heading;
      });
      return;
    }

    if (/^https?:\/\/.+/i.test(rawUrl)) {
      applyMediaChoiceToTarget((s) => {
        s.media_type = 'image';
        s.media_url = rawUrl;
        s.media_source = 'Ảnh (Phụ huynh chọn)';
        s.media_title = s.heading;
      });
      return;
    }

    showToast('⚠️ Đường dẫn chưa hợp lệ. Hãy dán link bắt đầu bằng https:// hoặc link YouTube.');
  }

  async function handleLiveImageSearch() {
    const ctx = getTargetSlideForPicker();
    if (!ctx || !ctx.slide) return;
    const query = dom.liveImageSearchInput.value.trim();
    if (!query) return;

    dom.btnLiveImageSearch.disabled = true;
    dom.btnLiveImageSearch.textContent = '⏳ Đang tìm...';
    try {
      const results = await global.MediaFinder.searchImages(query, ctx.lesson.grade, state.settings);
      if (!ctx.slide.media_candidates) {
        ctx.slide.media_candidates = { videos: [], images: [] };
      }
      ctx.slide.media_candidates.images = results;
      renderMediaPickerChoices(ctx.slide);
      if (results.length === 0) {
        showToast('Không tìm thấy ảnh phù hợp với từ khóa này. Thử từ khóa tiếng Anh ngắn hơn nhé!');
      } else {
        showToast(`🖼️ Tìm thấy ${results.length} ảnh minh họa mới!`);
      }
    } finally {
      dom.btnLiveImageSearch.disabled = false;
      dom.btnLiveImageSearch.textContent = '🔍 Tìm ảnh';
    }
  }

  /* ==================== NHẬP FILE JSON BÀI GIẢNG ==================== */
  function handleImportJsonFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const normalized = global.AILessonFactory.normalizeLesson(parsed, parsed.grade || state.activeGrade);
        // Giữ lại media đã chọn trong file JSON nếu có
        if (Array.isArray(parsed.slides)) {
          normalized.slides.forEach((s, idx) => {
            const orig = parsed.slides[idx];
            if (orig && orig.media_type && orig.media_url) {
              s.media_type = orig.media_type;
              s.media_url = orig.media_url;
              s.media_source = orig.media_source || s.media_source;
              s.media_title = orig.media_title || s.media_title;
            }
            if (orig && orig.media_candidates) {
              s.media_candidates = orig.media_candidates;
            }
          });
        }
        state.lessons.unshift(normalized);
        saveLessonsToStorage();
        state.activeGrade = normalized.grade;
        state.activeLessonId = normalized.id;
        state.activeSlideIndex = 0;
        renderProfileUI();
        showToast(`📂 Đã nạp bài giảng "${normalized.title}" vào Lớp ${normalized.grade}!`);
      } catch (err) {
        showToast(`⚠️ File JSON không đúng chuẩn bài giảng 4D: ${err.message}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  /* ==================== GẮN SỰ KIỆN & KHỞI CHẠY ==================== */
  function cacheDom() {
    const ids = [
      'sidebarProfileTitle', 'profileStarsBadge', 'lessonList',
      'btnImportJson', 'importJsonInput',
      'stageGradeBadge', 'stageSubjectBadge', 'stagePageBadge',
      'slideHeading', 'btnDownloadCurrentJson', 'slideProgressFill',
      'slideMediaFrame', 'slideMediaSource', 'btnOpenYoutubeExternal', 'btnQuickNextVideo', 'btnChangeSlideMedia',
      'slideHeartMessage', 'btnSpeakScript', 'btnStopSpeak', 'slideScript',
      'voicePersonaSelect', 'voiceRateSelect', 'voiceStatusNote',
      'flipCardScene', 'flipCardInner', 'flipFrontLabel', 'flipBackLabel',
      'flipBeforeText', 'flipAfterText',
      'quizQuestion', 'quizOptions', 'quizFeedback',
      'btnPrevSlide', 'btnNextSlide', 'stageLessonTitleSmall',
      'btnOpenFactoryMain', 'btnOpenParentMode', 'btnOpenFactoryFromParent',
      'factoryModal', 'factoryErrorBox', 'factoryInputView', 'factoryGradeCards',
      'smartDropzone', 'btnPickFiles', 'btnCaptureCamera',
      'factoryFileInput', 'factoryCameraInput', 'attachmentsGrid',
      'factoryTopicInput', 'slideCountPills', 'factoryAutoMediaToggle',
      'factoryApiStatusHint', 'btnStartGenerate',
      'factoryProgressPanel', 'factoryProgressBar', 'factoryProgressMsg',
      'factoryReviewView', 'reviewLessonTitle', 'reviewLessonMeta',
      'reviewSlidesGrid', 'btnBackToFactoryForm', 'btnDownloadDraftJson', 'btnLaunchNewLesson',
      'parentModal', 'parentSettingsForm', 'inputGeminiKey', 'selectGeminiModel',
      'btnTestGeminiApi', 'apiTestResult',
      'inputYoutubeKey', 'inputPixabayKey',
      'mediaPickerModal', 'customMediaUrlInput', 'btnApplyCustomMedia',
      'liveImageSearchInput', 'btnLiveImageSearch',
      'pickerVideosSection', 'pickerVideosGrid', 'pickerImagesGrid',
      'pickerVisualPromptText', 'btnCopyVisualPrompt',
      'toast'
    ];
    ids.forEach((id) => {
      dom[id] = $(id);
    });
  }

  function bindEvents() {
    // Chuyển hồ sơ Lớp 4 / Lớp 7 / Lớp 10
    document.querySelectorAll('.profile-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopSpeech();
        state.activeGrade = Number(btn.dataset.profileGrade) || 4;
        state.activeLessonId = null;
        state.activeSlideIndex = 0;
        renderProfileUI();
      });
    });

    // Mở Xưởng Tạo Bài Học 1 Chạm (từ thanh chính & từ Chế độ Phụ huynh)
    dom.btnOpenFactoryMain.addEventListener('click', openFactoryModal);
    dom.btnOpenFactoryFromParent.addEventListener('click', () => {
      closeModal('parentModal');
      openFactoryModal();
    });

    // Mở Chế độ Phụ huynh
    dom.btnOpenParentMode.addEventListener('click', () => {
      if (dom.apiTestResult) dom.apiTestResult.textContent = '';
      openParentModal();
    });
    dom.parentSettingsForm.addEventListener('submit', handleSaveParentSettings);

    // Kiểm tra nhanh kết nối Gemini API Key trong Chế độ Phụ huynh
    if (dom.btnTestGeminiApi) {
      dom.btnTestGeminiApi.addEventListener('click', async () => {
        const key = dom.inputGeminiKey.value.trim();
        const model = dom.selectGeminiModel.value;
        dom.btnTestGeminiApi.disabled = true;
        dom.btnTestGeminiApi.textContent = '⏳ Đang kiểm tra...';
        dom.apiTestResult.style.color = 'var(--text-muted)';
        dom.apiTestResult.textContent = 'Đang kết nối Google Gemini...';
        try {
          const result = await global.AILessonFactory.testApiConnection(key, model);
          dom.apiTestResult.style.color = result.ok ? '#059669' : '#dc2626';
          dom.apiTestResult.textContent = result.ok ? `✅ ${result.message}` : `❌ ${result.message}`;
        } finally {
          dom.btnTestGeminiApi.disabled = false;
          dom.btnTestGeminiApi.textContent = '🧪 Kiểm tra kết nối API Key';
        }
      });
    }

    // Ẩn/hiện API key
    document.querySelectorAll('[data-toggle-secret]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = $(btn.dataset.toggleSecret);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    // Đóng modal
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && !state.factory.isGenerating) {
          backdrop.classList.add('hidden');
        }
      });
    });

    // Điều hướng Slide
    dom.btnPrevSlide.addEventListener('click', () => {
      if (state.activeSlideIndex > 0) {
        state.activeSlideIndex--;
        renderStage();
      }
    });

    dom.btnNextSlide.addEventListener('click', () => {
      const lesson = getActiveLesson();
      if (!lesson) return;
      if (state.activeSlideIndex < lesson.slides.length - 1) {
        state.activeSlideIndex++;
        renderStage();
      } else {
        showToast('🎉 Chúc mừng con đã hoàn thành trọn vẹn bài giảng 4D này!');
      }
    });

    // Thẻ lật 3D
    const toggleFlip = () => dom.flipCardInner.classList.toggle('is-flipped');
    dom.flipCardScene.addEventListener('click', toggleFlip);
    dom.flipCardScene.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFlip();
      }
    });

    // Đọc giọng nói Việt Nam truyền cảm (Voice Studio)
    dom.btnSpeakScript.addEventListener('click', () => {
      const lesson = getActiveLesson();
      if (!lesson) return;
      const slide = lesson.slides[state.activeSlideIndex];
      if (slide) speakText(slide.script);
    });
    dom.btnStopSpeak.addEventListener('click', stopSpeech);

    if (dom.voicePersonaSelect) {
      dom.voicePersonaSelect.addEventListener('change', () => {
        state.settings.voiceId = dom.voicePersonaSelect.value;
        saveSettingsToStorage();
        if (global.VoiceStudio && global.VoiceStudio.isSpeaking()) {
          stopSpeech();
          const lesson = getActiveLesson();
          const slide = lesson && lesson.slides[state.activeSlideIndex];
          if (slide) speakText(slide.script);
        }
      });
    }

    if (dom.voiceRateSelect) {
      dom.voiceRateSelect.addEventListener('change', () => {
        state.settings.voiceRate = Number(dom.voiceRateSelect.value) || 1;
        saveSettingsToStorage();
      });
    }

    if ('speechSynthesis' in global) {
      global.speechSynthesis.onvoiceschanged = () => {
        populateVoiceOptions();
      };
    }

    // Đổi nhanh video YouTube dự phòng (1 chạm)
    dom.btnQuickNextVideo.addEventListener('click', () => {
      const lesson = getActiveLesson();
      if (!lesson) return;
      const slide = lesson.slides[state.activeSlideIndex];
      const videos = (slide.media_candidates && slide.media_candidates.videos) || [];
      if (videos.length < 2) return;
      const nextIdx = ((slide.media_video_index || 0) + 1) % videos.length;
      const chosen = videos[nextIdx];
      slide.media_type = 'youtube';
      slide.media_url = chosen.embedUrl;
      slide.media_source = `YouTube An Toàn (Video ${nextIdx + 1}/${videos.length})`;
      slide.media_title = chosen.title;
      slide.media_video_index = nextIdx;
      saveLessonsToStorage();
      renderStage();
      showToast(`🔄 Đã chuyển sang video gợi ý ${nextIdx + 1}/${videos.length}`);
    });

    // Mở hộp thoại Đổi Ảnh/Video trên slide đang học
    dom.btnChangeSlideMedia.addEventListener('click', () => {
      openMediaPicker('stage', state.activeSlideIndex);
    });

    // Tải xuống & Nạp JSON
    dom.btnDownloadCurrentJson.addEventListener('click', () => downloadLessonJson(getActiveLesson()));
    dom.btnImportJson.addEventListener('click', () => dom.importJsonInput.click());
    dom.importJsonInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImportJsonFile(e.target.files[0]);
      }
      e.target.value = '';
    });

    // ==================== SỰ KIỆN XƯỞNG TẠO BÀI GIẢNG ====================
    dom.factoryGradeCards.querySelectorAll('.grade-card').forEach((card) => {
      card.addEventListener('click', () => setFactoryGrade(card.dataset.factoryGrade));
    });

    dom.slideCountPills.querySelectorAll('.count-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        state.factory.slideCount = Number(pill.dataset.slideCount) || 6;
        updateSlideCountPills();
      });
    });

    // Smart Dropzone: Chọn file, Chụp camera, Kéo thả, Dán Ctrl+V
    dom.btnPickFiles.addEventListener('click', () => dom.factoryFileInput.click());
    dom.btnCaptureCamera.addEventListener('click', () => dom.factoryCameraInput.click());

    dom.factoryFileInput.addEventListener('change', (e) => {
      addFilesToFactory(e.target.files);
      e.target.value = '';
    });

    dom.factoryCameraInput.addEventListener('change', (e) => {
      addFilesToFactory(e.target.files);
      e.target.value = '';
    });

    ['dragenter', 'dragover'].forEach((evtName) => {
      dom.smartDropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.smartDropzone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((evtName) => {
      dom.smartDropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.smartDropzone.classList.remove('drag-over');
      });
    });

    dom.smartDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        addFilesToFactory(files);
      }
    });

    // Bắt sự kiện Ctrl+V toàn cục khi modal tạo bài đang mở
    document.addEventListener('paste', handleGlobalPaste);

    // Khởi tạo bài giảng 4D
    dom.btnStartGenerate.addEventListener('click', handleStartGenerate);

    // Bước 4: Quay lại tạo bài khác / Lưu JSON / Bắt đầu học ngay
    dom.btnBackToFactoryForm.addEventListener('click', () => {
      state.factory.draftLesson = null;
      dom.factoryReviewView.classList.add('hidden');
      dom.factoryProgressPanel.classList.add('hidden');
      dom.factoryInputView.classList.remove('hidden');
    });

    dom.btnDownloadDraftJson.addEventListener('click', () => {
      downloadLessonJson(state.factory.draftLesson);
    });

    dom.btnLaunchNewLesson.addEventListener('click', handleLaunchDraftLesson);

    // ==================== SỰ KIỆN MODAL ĐỔI MEDIA ====================
    dom.btnApplyCustomMedia.addEventListener('click', handleApplyCustomMedia);
    dom.btnLiveImageSearch.addEventListener('click', handleLiveImageSearch);
    dom.btnCopyVisualPrompt.addEventListener('click', async () => {
      const txt = dom.pickerVisualPromptText.textContent || '';
      if (!txt) return;
      try {
        await navigator.clipboard.writeText(txt);
        showToast('📋 Đã sao chép Google Flow Visual Prompt!');
      } catch (_e) {
        showToast('⚠️ Không sao chép tự động được — bạn hãy bôi đen và Ctrl+C nhé.');
      }
    });
  }

  function init() {
    cacheDom();
    loadStateFromStorage();
    populateVoiceOptions();
    bindEvents();
    renderProfileUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
