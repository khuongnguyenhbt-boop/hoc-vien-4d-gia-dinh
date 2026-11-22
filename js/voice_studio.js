/**
 * Học Viện 4D Gia Đình — Phòng Thu Giọng Giảng Việt Nam Truyền Cảm (Voice Studio)
 * Hỗ trợ 2 chế độ liền mạch, thuần Vanilla JS (ES6):
 * 1. Giọng AI Studio Người Việt Truyền Cảm (Gemini TTS: gemini-3.8-flash-tts / fallback gemini-2.5-flash-preview-tts)
 *    - 5 nhân vật giáo viên & người kể chuyện Việt Nam giàu cảm xúc (Miền Bắc / Miền Nam / Nam / Nữ).
 *    - Tự động cache âm thanh WAV trong bộ nhớ cho từng slide để phát lại tức thì, tiết kiệm hạn mức.
 * 2. Giọng Việt Tự Nhiên Trình Duyệt (Web Speech API miễn phí & ngoại tuyến)
 *    - Tự ưu tiên Microsoft HoaiMy / NamMinh Online (Natural) trên Edge và Google Tiếng Việt trên Chrome.
 *    - Tự tách câu thông minh tránh lỗi ngắt tiếng giữa chừng khi đọc đoạn dài.
 */
(function (global) {
  'use strict';

  const AI_PERSONAS = [
    {
      id: 'ai_co_minh_chau',
      label: '👩‍🏫 Cô Minh Châu — Giọng Bắc dịu dàng, truyền cảm (AI)',
      shortName: 'Cô Minh Châu (AI)',
      voiceName: 'Sulafat',
      recommendedGrades: [4, 7],
      stylePrompt:
        'Đọc bằng tiếng Việt chuẩn giọng miền Bắc (Hà Nội) thật dịu dàng, ấm áp, truyền cảm như cô giáo tiểu học đang kể chuyện và giảng bài cho học sinh yêu quý. Ngắt nghỉ tự nhiên theo dấu câu, lên xuống giọng giàu cảm xúc, rõ chữ và dễ nghe.'
    },
    {
      id: 'ai_co_thao_nhi',
      label: '🌸 Cô Thảo Nhi — Giọng Nam ngọt ngào, vui tươi (AI)',
      shortName: 'Cô Thảo Nhi (AI)',
      voiceName: 'Aoede',
      recommendedGrades: [4, 7],
      stylePrompt:
        'Đọc bằng tiếng Việt giọng miền Nam (Sài Gòn) ngọt ngào, vui tươi, thân thiện và truyền cảm hứng như cô gia sư trẻ gần gũi với học sinh. Nhấn nhá sinh động, truyền năng lượng tích cực.'
    },
    {
      id: 'ai_chi_ha_my',
      label: '📖 Chị Hà My — Giọng nữ sâu lắng, hợp Văn học (AI)',
      shortName: 'Chị Hà My (AI)',
      voiceName: 'Vindemiatrix',
      recommendedGrades: [7, 10],
      stylePrompt:
        'Đọc bằng tiếng Việt chuẩn truyền cảm, nhẹ nhàng, sâu lắng và giàu chất văn học như phát thanh viên kể chuyện văn học cho học sinh THCS và THPT. Nhịp điệu khoan thai, nhấn mạnh ý đẹp một cách tinh tế.'
    },
    {
      id: 'ai_thay_quang_minh',
      label: '👨‍🏫 Thầy Quang Minh — Giọng Nam ấm áp, lôi cuốn (AI)',
      shortName: 'Thầy Quang Minh (AI)',
      voiceName: 'Charon',
      recommendedGrades: [7, 10],
      stylePrompt:
        'Đọc bằng tiếng Việt giọng nam miền Bắc trầm ấm, chững chạc, rõ ràng và đầy lôi cuốn như thầy giáo tâm huyết giảng bài khoa học và tư duy cho học sinh.'
    },
    {
      id: 'ai_anh_khoi_nguyen',
      label: '⚡ Anh Khôi Nguyên — Trẻ trung, hào hứng khám phá (AI)',
      shortName: 'Anh Khôi Nguyên (AI)',
      voiceName: 'Puck',
      recommendedGrades: [4, 7, 10],
      stylePrompt:
        'Đọc bằng tiếng Việt trẻ trung, sôi nổi, hào hứng và gần gũi như người anh trai thông minh đang chia sẻ bí kíp học tập thú vị cho em nhỏ.'
    }
  ];

  // Cache audio WAV ObjectURL theo khóa: personaId|textHash (giới hạn 25 clip để nhẹ RAM)
  const audioCache = new Map();
  const MAX_CACHE_ITEMS = 25;

  let currentAudio = null;
  let currentAbortController = null;
  let isBrowserSpeaking = false;
  let browserChunkQueue = [];
  let browserQueueActive = false;

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  function putCache(key, objectUrl) {
    if (audioCache.has(key)) {
      audioCache.delete(key);
    }
    audioCache.set(key, objectUrl);
    if (audioCache.size > MAX_CACHE_ITEMS) {
      const oldestKey = audioCache.keys().next().value;
      const oldUrl = audioCache.get(oldestKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      audioCache.delete(oldestKey);
    }
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Đóng gói PCM 16-bit mono (audio/L16;rate=24000) thành WAV chuẩn để thẻ <audio> phát mượt.
   */
  function wrapPcmAsWavBlob(pcmBytes, sampleRate) {
    const rate = sampleRate || 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (rate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBytes.byteLength;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset, s) => {
      for (let i = 0; i < s.length; i++) {
        view.setUint8(offset + i, s.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(pcmBytes);
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Kiểm tra dữ liệu trả về đã có header WAV/MP3/OGG chưa; nếu là PCM thô thì bọc WAV.
   */
  function decodeAudioToBlob(base64Data, mimeType) {
    const bytes = base64ToUint8Array(base64Data);
    const lowerMime = String(mimeType || '').toLowerCase();

    // Kiểm tra magic bytes "RIFF" (WAV), "ID3"/0xFF (MP3), "OggS" (OGG)
    const isRiff =
      bytes.length >= 4 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46;

    if (isRiff || lowerMime.includes('wav')) {
      return new Blob([bytes], { type: 'audio/wav' });
    }
    if (lowerMime.includes('mpeg') || lowerMime.includes('mp3')) {
      return new Blob([bytes], { type: 'audio/mpeg' });
    }
    if (lowerMime.includes('ogg')) {
      return new Blob([bytes], { type: 'audio/ogg' });
    }

    // Mặc định PCM L16 24kHz của Gemini TTS
    const rateMatch = lowerMime.match(/rate=(\d+)/);
    const rate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    return wrapPcmAsWavBlob(bytes, rate);
  }

  /**
   * Gọi Gemini 3.8 Flash TTS qua Interactions REST API (trả WAV truyền cảm có điều khiển cảm xúc)
   */
  async function fetchGemini38Tts(text, persona, apiKey, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
      apiKey
    )}`;
    const body = {
      model: 'gemini-3.8-flash-tts',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: text,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: persona.stylePrompt
                }
              ]
            }
          ]
        }
      ],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: persona.voiceName }]
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!res.ok) {
      throw new Error(`TTS 3.8 HTTP ${res.status}`);
    }

    const data = await res.json();
    const steps = Array.isArray(data.steps) ? data.steps : [];
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (!step || !Array.isArray(step.content)) continue;
      for (const item of step.content) {
        if (item && item.type === 'audio' && item.data) {
          return decodeAudioToBlob(item.data, item.mime_type || 'audio/wav');
        }
      }
    }
    throw new Error('Không tìm thấy dữ liệu âm thanh từ Gemini 3.8 TTS.');
  }

  /**
   * Dự phòng: Gọi Gemini 2.5 Flash Preview TTS qua generateContent REST API
   */
  async function fetchGemini25Tts(text, persona, apiKey, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const prompt = `${persona.stylePrompt}\n\nHãy đọc đúng nguyên văn đoạn bài giảng sau:\n${text}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: persona.voiceName
            }
          }
        }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!res.ok) {
      throw new Error(`TTS 2.5 HTTP ${res.status}`);
    }

    const data = await res.json();
    const parts =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts;

    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (p && p.inlineData && p.inlineData.data) {
          return decodeAudioToBlob(p.inlineData.data, p.inlineData.mimeType || 'audio/L16;rate=24000');
        }
      }
    }
    throw new Error('Không tìm thấy dữ liệu âm thanh từ Gemini 2.5 TTS.');
  }

  /**
   * Lấy danh sách giọng Việt Nam tốt nhất có sẵn trên trình duyệt (Edge Neural HoaiMy / NamMinh, Google Tiếng Việt...)
   */
  function getVietnameseBrowserVoices() {
    if (!('speechSynthesis' in global)) return [];
    const all = global.speechSynthesis.getVoices() || [];
    const viList = all.filter((v) => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      return (
        lang.startsWith('vi') ||
        name.includes('vietnam') ||
        name.includes('tiếng việt') ||
        name.includes('hoaimy') ||
        name.includes('namminh')
      );
    });

    // Chấm điểm ưu tiên giọng Natural / Online (Microsoft HoaiMy, NamMinh, Google Tiếng Việt)
    const scoreVoice = (v) => {
      const n = (v.name || '').toLowerCase();
      let score = 0;
      if (n.includes('natural') || n.includes('neural')) score += 100;
      if (n.includes('online')) score += 50;
      if (n.includes('hoaimy')) score += 45;
      if (n.includes('namminh')) score += 40;
      if (n.includes('google')) score += 35;
      if (n.includes('linh') || n.includes('an')) score += 20;
      return score;
    };

    return viList
      .slice()
      .sort((a, b) => scoreVoice(b) - scoreVoice(a))
      .map((v) => ({
        id: `browser::${v.voiceURI || v.name}`,
        voiceObj: v,
        name: v.name,
        isNatural: /natural|neural|online|google/i.test(v.name || ''),
        label: formatBrowserVoiceLabel(v)
      }));
  }

  function formatBrowserVoiceLabel(v) {
    const n = v.name || 'Giọng Việt';
    if (/hoaimy/i.test(n)) return '👩 Hoài My (Nữ Việt Nam Tự Nhiên — Miễn phí)';
    if (/namminh/i.test(n)) return '👨 Nam Minh (Nam Việt Nam Tự Nhiên — Miễn phí)';
    if (/google/i.test(n)) return '🎙️ Google Tiếng Việt (Miễn phí)';
    if (/linh/i.test(n)) return '👩 Linh — Giọng Việt (Ngoại tuyến)';
    if (/an/i.test(n)) return '👩 An — Giọng Việt Windows (Ngoại tuyến)';
    return `🔊 ${n} (Trình duyệt)`;
  }

  /**
   * Tách văn bản thành từng câu ngắn hợp lý để giọng trình duyệt đọc truyền cảm và không bị ngắt đột ngột.
   */
  function splitIntoNaturalSentences(text) {
    const cleaned = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];
    const rawParts = cleaned.match(/[^.!?…;:\n]+[.!?…;:]*/g) || [cleaned];
    const chunks = [];
    let buffer = '';
    for (const part of rawParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if ((buffer + ' ' + trimmed).length <= 170) {
        buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
      } else {
        if (buffer) chunks.push(buffer);
        buffer = trimmed;
      }
    }
    if (buffer) chunks.push(buffer);
    return chunks;
  }

  function stop() {
    if (currentAbortController) {
      try {
        currentAbortController.abort();
      } catch (_e) {}
      currentAbortController = null;
    }
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (_e) {}
      currentAudio = null;
    }
    browserQueueActive = false;
    browserChunkQueue = [];
    isBrowserSpeaking = false;
    if ('speechSynthesis' in global) {
      global.speechSynthesis.cancel();
    }
  }

  function speakWithBrowser(text, voiceId, rate, callbacks) {
    const { onStart, onEnd, onError } = callbacks || {};
    if (!('speechSynthesis' in global)) {
      if (onError) onError('Trình duyệt không hỗ trợ đọc giọng nói.');
      return;
    }

    stop();
    const viVoices = getVietnameseBrowserVoices();
    let chosen = null;
    if (voiceId && voiceId.startsWith('browser::')) {
      chosen = viVoices.find((v) => v.id === voiceId) || null;
    }
    if (!chosen && viVoices.length > 0) {
      chosen = viVoices[0];
    }

    const chunks = splitIntoNaturalSentences(text);
    if (chunks.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    browserChunkQueue = chunks;
    browserQueueActive = true;
    isBrowserSpeaking = true;
    if (onStart) {
      onStart(chosen ? chosen.label : 'Giọng Tiếng Việt mặc định');
    }

    const speakNext = () => {
      if (!browserQueueActive || browserChunkQueue.length === 0) {
        browserQueueActive = false;
        isBrowserSpeaking = false;
        if (onEnd) onEnd();
        return;
      }
      const sentence = browserChunkQueue.shift();
      const utter = new SpeechSynthesisUtterance(sentence);
      utter.lang = 'vi-VN';
      utter.rate = Math.max(0.75, Math.min(1.4, Number(rate) || 0.98));
      utter.pitch = 1.02;
      if (chosen && chosen.voiceObj) {
        utter.voice = chosen.voiceObj;
      }
      utter.onend = () => {
        if (browserQueueActive) {
          setTimeout(speakNext, 120);
        }
      };
      utter.onerror = (ev) => {
        if (ev && ev.error === 'interrupted') return;
        browserQueueActive = false;
        isBrowserSpeaking = false;
        if (onEnd) onEnd();
      };
      global.speechSynthesis.speak(utter);
    };

    speakNext();
  }

  /**
   * Phát giọng giảng bài Việt Nam truyền cảm:
   * - Nếu chọn giọng AI Studio (ai_...) và có Gemini API Key + Online -> dùng Gemini TTS (cache WAV tức thì).
   * - Nếu gặp lỗi mạng / hết hạn mức / chưa có Key -> tự động dự phòng mượt sang giọng Việt Tự Nhiên của trình duyệt!
   */
  async function speak(options) {
    const {
      text = '',
      voiceId = 'ai_co_minh_chau',
      rate = 1.0,
      apiKey = '',
      onLoading = () => {},
      onStart = () => {},
      onEnd = () => {},
      onFallback = () => {},
      onError = () => {}
    } = options || {};

    const cleanText = String(text || '').trim();
    if (!cleanText) {
      onEnd();
      return;
    }

    stop();

    const persona = AI_PERSONAS.find((p) => p.id === voiceId);
    const hasKey = Boolean(apiKey && apiKey.trim());
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

    // Nếu người dùng chọn giọng trình duyệt, hoặc chưa có API Key / đang offline -> phát ngay bằng giọng Việt trình duyệt
    if (!persona || !hasKey || !isOnline) {
      if (persona && !hasKey) {
        onFallback('Chưa có Gemini API Key — đang phát bằng giọng Việt tự nhiên của trình duyệt.');
      } else if (persona && !isOnline) {
        onFallback('Đang ngoại tuyến — đang phát bằng giọng Việt trình duyệt.');
      }
      speakWithBrowser(cleanText, persona ? '' : voiceId, rate, { onStart, onEnd, onError });
      return;
    }

    // Kiểm tra Cache RAM trước (phát lại tức thì không tốn API)
    const cacheKey = `${persona.id}|${simpleHash(cleanText)}`;
    let audioUrl = audioCache.get(cacheKey);

    if (!audioUrl) {
      onLoading(`🎙️ Đang thu âm giọng ${persona.shortName}...`);
      const controller = new AbortController();
      currentAbortController = controller;
      const timer = setTimeout(() => controller.abort(), 28000);

      try {
        let blob = null;
        try {
          blob = await fetchGemini38Tts(cleanText, persona, apiKey.trim(), controller.signal);
        } catch (err38) {
          if (controller.signal.aborted) throw err38;
          console.warn('[VoiceStudio] Gemini 3.8 TTS fallback -> 2.5 TTS:', err38.message);
          blob = await fetchGemini25Tts(cleanText, persona, apiKey.trim(), controller.signal);
        }
        audioUrl = URL.createObjectURL(blob);
        putCache(cacheKey, audioUrl);
      } catch (err) {
        clearTimeout(timer);
        if (controller.signal.aborted && !currentAbortController) {
          onEnd();
          return;
        }
        console.warn('[VoiceStudio] AI TTS lỗi, tự động chuyển giọng Việt trình duyệt:', err.message);
        onFallback('Giọng AI đang bận — đã tự chuyển sang giọng Việt tự nhiên của trình duyệt.');
        speakWithBrowser(cleanText, '', rate, { onStart, onEnd, onError });
        return;
      } finally {
        clearTimeout(timer);
        if (currentAbortController === controller) {
          currentAbortController = null;
        }
      }
    }

    // Phát file âm thanh WAV giọng người Việt truyền cảm
    const audio = new Audio(audioUrl);
    audio.playbackRate = Math.max(0.75, Math.min(1.4, Number(rate) || 1.0));
    currentAudio = audio;

    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      onEnd();
    };
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      onFallback('Không phát được tệp âm thanh AI — chuyển sang giọng Việt trình duyệt.');
      speakWithBrowser(cleanText, '', rate, { onStart, onEnd, onError });
    };

    try {
      onStart(persona.shortName);
      await audio.play();
    } catch (_playErr) {
      if (currentAudio === audio) currentAudio = null;
      onFallback('Trình duyệt chặn tự phát âm thanh — chuyển sang giọng Việt trình duyệt.');
      speakWithBrowser(cleanText, '', rate, { onStart, onEnd, onError });
    }
  }

  function isSpeaking() {
    return Boolean(currentAudio || isBrowserSpeaking || currentAbortController);
  }

  global.VoiceStudio = {
    AI_PERSONAS,
    getVietnameseBrowserVoices,
    wrapPcmAsWavBlob,
    splitIntoNaturalSentences,
    speak,
    stop,
    isSpeaking
  };
})(window);
