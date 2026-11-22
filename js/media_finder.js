/**
 * Học Viện 4D Gia Đình - Bộ Máy Tự Động Tìm Ảnh & Video 3 Tầng (Media Finder)
 * Thuần Vanilla JS (ES6), không thư viện ngoài, chạy trực tiếp file:// hoặc HTTP.
 * Tầng 1: YouTube Data API v3 (safeSearch=strict, videoEmbeddable=true)
 * Tầng 2: Pixabay API (nếu có key) hoặc Wikimedia Commons API (miễn phí 100%, origin=*)
 * Tầng 3: Zero-Empty-Slide với fallback_svg đã được làm sạch an toàn tuyệt đối.
 */
(function (global) {
  'use strict';

  const ALLOWED_SVG_TAGS = new Set([
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line',
    'polyline', 'polygon', 'text', 'tspan', 'defs',
    'lineargradient', 'radialgradient', 'stop', 'clippath',
    'mask', 'pattern', 'marker', 'title', 'desc', 'symbol', 'use'
  ]);

  const ALLOWED_SVG_ATTRS = new Set([
    'viewbox', 'xmlns', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-opacity',
    'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
    'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity',
    'transform', 'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline', 'letter-spacing', 'dx', 'dy',
    'id', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end',
    'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'markerunits',
    'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform',
    'fx', 'fy', 'spreadmethod', 'patternunits', 'preserveaspectratio',
    'href', 'xlink:href', 'role', 'aria-label'
  ]);

  /**
   * Tạo SVG mặc định đẹp mắt nếu slide không có fallback_svg hợp lệ.
   */
  function createDefaultSVG(title, subtitle) {
    const safeTitle = escapeXml(String(title || 'Bài Giảng 4D').slice(0, 60));
    const safeSub = escapeXml(String(subtitle || 'Học Viện 4D Gia Đình').slice(0, 90));
    return `<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bgGradDef" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EEF2FF"/>
      <stop offset="50%" stop-color="#E0F2FE"/>
      <stop offset="100%" stop-color="#FEF3C7"/>
    </linearGradient>
    <linearGradient id="accentGradDef" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#0EA5E9"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" rx="20" fill="url(#bgGradDef)"/>
  <circle cx="110" cy="95" r="70" fill="#6366F1" fill-opacity="0.12"/>
  <circle cx="710" cy="360" r="95" fill="#F59E0B" fill-opacity="0.15"/>
  <rect x="90" y="110" width="620" height="230" rx="24" fill="#FFFFFF" fill-opacity="0.92" stroke="#C7D2FE" stroke-width="2"/>
  <rect x="290" y="138" width="220" height="8" rx="4" fill="url(#accentGradDef)"/>
  <text x="400" y="218" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#1E293B">${safeTitle}</text>
  <text x="400" y="266" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#475569">${safeSub}</text>
</svg>`;
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Làm sạch tuyệt đối chuỗi SVG:
   * - Chỉ cho phép các thẻ đồ họa SVG an toàn trong ALLOWED_SVG_TAGS.
   * - Loại bỏ hoàn toàn <script>, <foreignObject>, <iframe>, <style>, thuộc tính on*, javascript: URL.
   * - Đảm bảo có viewBox="0 0 800 450" để hiển thị chuẩn 16:9.
   */
  function sanitizeSVG(rawSvg, fallbackTitle, fallbackSubtitle) {
    if (!rawSvg || typeof rawSvg !== 'string') {
      return createDefaultSVG(fallbackTitle, fallbackSubtitle);
    }

    const match = rawSvg.match(/<svg[\s\S]*?<\/svg>/i);
    if (!match) {
      return createDefaultSVG(fallbackTitle, fallbackSubtitle);
    }

    let cleanedString = match[0]
      // Loại bỏ script / foreignObject trước khi parse như lớp bảo vệ đầu tiên
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanedString, 'image/svg+xml');
      const parseError = doc.querySelector('parsererror');
      const svgEl = doc.documentElement;

      if (parseError || !svgEl || svgEl.tagName.toLowerCase() !== 'svg') {
        return createDefaultSVG(fallbackTitle, fallbackSubtitle);
      }

      const sanitizeNode = (node) => {
        const children = Array.from(node.childNodes);
        for (const child of children) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toLowerCase();
            if (!ALLOWED_SVG_TAGS.has(tag)) {
              node.removeChild(child);
              continue;
            }
            // Kiểm tra từng thuộc tính
            const attrs = Array.from(child.attributes);
            for (const attr of attrs) {
              const name = attr.name.toLowerCase();
              const val = (attr.value || '').trim();
              if (name.startsWith('on') || !ALLOWED_SVG_ATTRS.has(name)) {
                child.removeAttribute(attr.name);
                continue;
              }
              // Chặn mọi URL nguy hiểm trong href / xlink:href / fill / clip-path / filter
              if (/javascript:|vbscript:|data:/i.test(val)) {
                child.removeAttribute(attr.name);
                continue;
              }
              if ((name === 'href' || name === 'xlink:href') && !val.startsWith('#')) {
                child.removeAttribute(attr.name);
                continue;
              }
              if (/url\s*\(/i.test(val) && !/^url\(\s*#[a-zA-Z0-9_-]+\s*\)$/i.test(val)) {
                child.removeAttribute(attr.name);
                continue;
              }
            }
            sanitizeNode(child);
          } else if (child.nodeType === Node.COMMENT_NODE) {
            node.removeChild(child);
          }
        }
      };

      // Lọc thuộc tính của thẻ gốc <svg>
      const rootAttrs = Array.from(svgEl.attributes);
      for (const attr of rootAttrs) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || (!ALLOWED_SVG_ATTRS.has(name) && name !== 'xmlns:xlink')) {
          svgEl.removeAttribute(attr.name);
        }
      }

      if (!svgEl.getAttribute('viewBox')) {
        svgEl.setAttribute('viewBox', '0 0 800 450');
      }
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');

      sanitizeNode(svgEl);

      const serializer = new XMLSerializer();
      const result = serializer.serializeToString(svgEl);
      if (!result || result.length < 30) {
        return createDefaultSVG(fallbackTitle, fallbackSubtitle);
      }
      return result;
    } catch (_err) {
      return createDefaultSVG(fallbackTitle, fallbackSubtitle);
    }
  }

  /**
   * Trích xuất ID video YouTube từ nhiều định dạng đường dẫn khác nhau.
   */
  function parseYouTubeId(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    const patterns = [
      /(?:youtube\.com\/watch\?.*?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i
    ];
    for (const pattern of patterns) {
      const m = trimmed.match(pattern);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  function buildYouTubeWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  }

  /**
   * Tạo URL nhúng YouTube chuẩn chống lỗi Error 153:
   * - Dùng domain chính thức www.youtube.com/embed (ổn định hơn youtube-nocookie trên localhost/127.0.0.1).
   * - Tự động đính kèm tham số origin chuẩn khi chạy qua http:// hoặc https://.
   */
  function buildYouTubeEmbedUrl(videoId) {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1'
    });
    if (
      typeof global.location !== 'undefined' &&
      (global.location.protocol === 'http:' || global.location.protocol === 'https:') &&
      global.location.origin &&
      global.location.origin !== 'null'
    ) {
      params.set('origin', global.location.origin);
    }
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }

  /**
   * Helper fetch có timeout để không bao giờ treo ứng dụng khi mạng chậm.
   */
  async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 9000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * TẦNG 1: Tìm Video YouTube an toàn qua YouTube Data API v3
   * - Tìm 8 ứng viên rồi xác thực thật bằng videos.list?part=status,contentDetails
   *   để loại bỏ các video bị chặn nhúng (embeddable=false) hoặc hạn chế vùng VN.
   */
  async function searchYouTubeVideos(query, apiKey) {
    if (!apiKey || !apiKey.trim() || !query || !query.trim()) {
      return [];
    }
    const cleanKey = apiKey.trim();
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      safeSearch: 'strict',
      relevanceLanguage: 'vi',
      maxResults: '8',
      q: query.trim(),
      key: cleanKey
    });
    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    try {
      const data = await fetchJsonWithTimeout(url, 9000);
      if (!data || !Array.isArray(data.items)) return [];

      let candidates = data.items
        .filter((item) => item && item.id && item.id.videoId)
        .map((item) => {
          const videoId = item.id.videoId;
          const snippet = item.snippet || {};
          const thumb =
            (snippet.thumbnails && (snippet.thumbnails.medium || snippet.thumbnails.default)) || {};
          return {
            id: videoId,
            title: snippet.title || 'Video giáo dục YouTube',
            channel: snippet.channelTitle || 'YouTube',
            thumbnail: thumb.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            embedUrl: buildYouTubeEmbedUrl(videoId),
            watchUrl: buildYouTubeWatchUrl(videoId),
            source: 'YouTube'
          };
        });

      // Xác thực quyền nhúng thực tế (chỉ tốn 1 quota unit cho cả danh sách)
      if (candidates.length > 0) {
        try {
          const ids = candidates.map((c) => c.id).join(',');
          const verifyUrl = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=${encodeURIComponent(
            ids
          )}&key=${encodeURIComponent(cleanKey)}`;
          const verifyData = await fetchJsonWithTimeout(verifyUrl, 7000);
          if (verifyData && Array.isArray(verifyData.items)) {
            const allowedIds = new Set();
            for (const v of verifyData.items) {
              const st = v.status || {};
              const cd = v.contentDetails || {};
              const rr = cd.regionRestriction || {};
              const blockedInVn = Array.isArray(rr.blocked) && rr.blocked.includes('VN');
              const restrictedNotVn = Array.isArray(rr.allowed) && !rr.allowed.includes('VN');
              if (
                st.embeddable !== false &&
                st.privacyStatus === 'public' &&
                !blockedInVn &&
                !restrictedNotVn
              ) {
                allowedIds.add(v.id);
              }
            }
            const verified = candidates.filter((c) => allowedIds.has(c.id));
            if (verified.length > 0) {
              candidates = verified;
            }
          }
        } catch (_verifyErr) {
          // Giữ nguyên danh sách search nếu bước kiểm tra phụ bị chậm
        }
      }

      return candidates.slice(0, 5);
    } catch (err) {
      console.warn('[MediaFinder] Lỗi tìm YouTube:', err.message);
      return [];
    }
  }

  /**
   * TẦNG 2A: Tìm ảnh minh họa qua Pixabay API (nếu phụ huynh nhập key)
   */
  async function searchPixabayImages(query, grade, apiKey) {
    if (!apiKey || !apiKey.trim() || !query || !query.trim()) {
      return [];
    }
    const imageType = Number(grade) === 4 ? 'illustration' : 'all';
    const params = new URLSearchParams({
      key: apiKey.trim(),
      q: query.trim().slice(0, 95),
      safesearch: 'true',
      orientation: 'horizontal',
      image_type: imageType,
      per_page: '6'
    });
    const url = `https://pixabay.com/api/?${params.toString()}`;
    try {
      const data = await fetchJsonWithTimeout(url, 9000);
      if (!data || !Array.isArray(data.hits)) return [];
      return data.hits
        .filter((h) => h && h.webformatURL)
        .map((h) => ({
          url: h.webformatURL,
          thumb: h.previewURL || h.webformatURL,
          title: h.tags || query,
          width: h.webformatWidth || 0,
          height: h.webformatHeight || 0,
          source: 'Pixabay'
        }));
    } catch (err) {
      console.warn('[MediaFinder] Lỗi tìm Pixabay:', err.message);
      return [];
    }
  }

  /**
   * TẦNG 2B: Tìm ảnh miễn phí 100% qua Wikimedia Commons API (origin=*)
   * Lọc ảnh tỷ lệ ngang (horizontal) & dung lượng nhẹ, ưu tiên thumbnail 960px.
   */
  async function searchWikimediaImages(query) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim().replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
    if (!cleanQuery) return [];

    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: `${cleanQuery} filetype:bitmap|drawing`,
      gsrlimit: '12',
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
      iiurlwidth: '960',
      format: 'json',
      origin: '*'
    });
    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    try {
      const data = await fetchJsonWithTimeout(url, 9000);
      if (!data || !data.query || !data.query.pages) return [];

      const pages = Object.values(data.query.pages);
      const validMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
      const candidates = [];

      for (const page of pages) {
        const info = page && Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
        if (!info || !validMimes.has(info.mime)) continue;

        const w = info.thumbwidth || info.width || 0;
        const h = info.thumbheight || info.height || 0;
        if (w < 320 || h < 180) continue;

        // Lọc tỷ lệ ngang hợp lý cho khung 16:9
        const ratio = w / h;
        if (ratio < 1.05 || ratio > 2.6) continue;

        // Tránh file gốc siêu nặng nếu không có thumburl
        if (!info.thumburl && info.size && info.size > 4 * 1024 * 1024) continue;

        const imgUrl = info.thumburl || info.url;
        if (!imgUrl) continue;

        const cleanTitle = (page.title || query)
          .replace(/^File:/i, '')
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/_/g, ' ');

        candidates.push({
          url: imgUrl,
          thumb: imgUrl,
          title: cleanTitle,
          width: w,
          height: h,
          source: 'Wikimedia Commons'
        });
      }

      return candidates.slice(0, 5);
    } catch (err) {
      console.warn('[MediaFinder] Lỗi tìm Wikimedia Commons:', err.message);
      return [];
    }
  }

  /**
   * Tìm ảnh tổng hợp (Pixabay nếu có key, ngược lại Wikimedia Commons miễn phí)
   */
  async function searchImages(query, grade, settings) {
    const pixabayKey = settings && settings.pixabayApiKey ? settings.pixabayApiKey.trim() : '';
    let images = [];
    if (pixabayKey) {
      images = await searchPixabayImages(query, grade, pixabayKey);
    }
    if (!images.length) {
      images = await searchWikimediaImages(query);
    }
    return images;
  }

  /**
   * Tự động tìm và gán Media 3 tầng cho 1 slide cụ thể.
   * Luôn đảm bảo Zero-Empty-Slide (tối thiểu có fallback_svg đã làm sạch).
   */
  async function resolveSlideMedia(slide, grade, settings) {
    const safeSvg = sanitizeSVG(slide.fallback_svg, slide.heading, slide.heart_message);
    slide.fallback_svg = safeSvg;

    const ytKey = settings && settings.youtubeApiKey ? settings.youtubeApiKey.trim() : '';
    const ytQuery = slide.youtube_search_query || slide.heading || '';
    const imgQuery = slide.image_search_query || slide.heading || '';

    const candidates = {
      videos: [],
      images: []
    };

    // Nếu trình duyệt đang offline, nhảy thẳng sang fallback_svg
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      slide.media_type = 'svg';
      slide.media_url = '';
      slide.media_source = 'Sơ đồ AI (Ngoại tuyến)';
      slide.media_title = slide.heading || 'Minh họa SVG';
      slide.media_candidates = candidates;
      return slide;
    }

    // Chạy song song Tầng 1 (nếu có YouTube Key) và Tầng 2 (ảnh) để có sẵn cả lựa chọn đổi qua lại
    const [videos, images] = await Promise.all([
      ytKey ? searchYouTubeVideos(ytQuery, ytKey) : Promise.resolve([]),
      searchImages(imgQuery, grade, settings)
    ]);

    candidates.videos = videos;
    candidates.images = images;
    slide.media_candidates = candidates;

    // Ưu tiên theo đúng thứ tự 3 tầng:
    // Tầng 1: YouTube (nếu có key và tìm được video phù hợp)
    if (videos.length > 0) {
      const firstVideo = videos[0];
      slide.media_type = 'youtube';
      slide.media_url = firstVideo.embedUrl;
      slide.media_source = 'YouTube An Toàn';
      slide.media_title = firstVideo.title;
      slide.media_video_index = 0;
      return slide;
    }

    // Tầng 2: Ảnh minh họa (Pixabay hoặc Wikimedia Commons)
    if (images.length > 0) {
      const firstImg = images[0];
      slide.media_type = 'image';
      slide.media_url = firstImg.url;
      slide.media_source = firstImg.source;
      slide.media_title = firstImg.title;
      slide.media_image_index = 0;
      return slide;
    }

    // Tầng 3: Zero-Empty-Slide với fallback_svg
    slide.media_type = 'svg';
    slide.media_url = '';
    slide.media_source = 'Sơ đồ minh họa AI (SVG)';
    slide.media_title = slide.heading || 'Minh họa SVG';
    return slide;
  }

  /**
   * Tự động tìm Media cho toàn bộ bài giảng với callback tiến độ (slide X / N).
   */
  async function enrichLessonMedia(lesson, settings, onProgress) {
    if (!lesson || !Array.isArray(lesson.slides)) return lesson;
    const total = lesson.slides.length;
    for (let i = 0; i < total; i++) {
      if (typeof onProgress === 'function') {
        onProgress(i + 1, total, lesson.slides[i]);
      }
      await resolveSlideMedia(lesson.slides[i], lesson.grade, settings);
    }
    return lesson;
  }

  global.MediaFinder = {
    sanitizeSVG,
    createDefaultSVG,
    parseYouTubeId,
    buildYouTubeEmbedUrl,
    buildYouTubeWatchUrl,
    searchYouTubeVideos,
    searchPixabayImages,
    searchWikimediaImages,
    searchImages,
    resolveSlideMedia,
    enrichLessonMedia
  };
})(window);
