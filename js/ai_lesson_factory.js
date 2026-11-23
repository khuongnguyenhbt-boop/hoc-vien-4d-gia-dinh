/**
 * Học Viện 4D Gia Đình - Xưởng Tạo Bài Giảng 4D Đa Phương Thức (AI Lesson Factory)
 * Thuần Vanilla JS (ES6), không thư viện ngoài.
 * - Nén ảnh tự động qua <canvas> ẩn (maxWidth = 1280px, JPEG quality = 0.8) tối ưu RAM.
 * - Hỗ trợ đồng thời: Ảnh (Ctrl+V / Kéo thả / Camera), PDF (< 10MB), TXT/MD, và Chủ đề văn bản.
 * - Gọi Gemini Multimodal Cloud API (mặc định gemini-2.5-flash) với responseMimeType: "application/json".
 * - Nhận diện ngữ cảnh thông minh (Trang SGK / Bìa sách / Chủ đề) & Phân tầng sư phạm 3 độ tuổi.
 */
(function (global) {
  'use strict';

  const MAX_IMAGE_WIDTH = 1280;
  const JPEG_QUALITY = 0.8;
  const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB
  const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB
  const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const GEMINI_TIMEOUT_MS = 95000;

  const GRADE_PROFILES = {
    4: {
      grade: 4,
      label: 'Lớp 4 (Tiểu học)',
      shortLabel: 'Lớp 4',
      defaultSlides: 6,
      flipBeforeTitle: 'Hay nhầm lẫn',
      flipAfterTitle: 'À ha! Hóa ra là thế!',
      wordRange: 'dưới 100 từ/trang (khoảng 60-95 từ)',
      pedagogyRule:
        'Ngôn ngữ vui tươi, ấm áp, xưng hô thân thiện như người bạn đồng hành. Dùng ví dụ cực kỳ gần gũi với trẻ 9-10 tuổi (chia bánh pizza, đồ chơi Lego, đi siêu thị cùng bố mẹ, gia đình). Lời giảng (script) ngắn gọn dưới 100 từ/trang, câu văn tự nhiên để đọc thành tiếng. Thẻ lật 3D theo cặp "Hay nhầm lẫn" (before) -> "À ha! Hóa ra là thế!" (after).'
    },
    7: {
      grade: 7,
      label: 'Lớp 7 (THCS)',
      shortLabel: 'Lớp 7',
      defaultSlides: 8,
      flipBeforeTitle: 'Học vẹt bề mặt',
      flipAfterTitle: 'Hiểu sâu bản chất',
      wordRange: '100-140 từ/trang',
      pedagogyRule:
        'Ngôn ngữ logic, khơi gợi tò mò khoa học, liên hệ thực tế đời sống và công nghệ quen thuộc với học sinh 12-13 tuổi. Giải thích rõ "tại sao" thay vì chỉ đưa công thức. Lời giảng (script) mạch lạc từ 100-140 từ/trang để đọc giọng nói. Thẻ lật 3D theo cặp "Học vẹt bề mặt" (before) -> "Hiểu sâu bản chất" (after).'
    },
    10: {
      grade: 10,
      label: 'Lớp 10 (THPT)',
      shortLabel: 'Lớp 10',
      defaultSlides: 10,
      flipBeforeTitle: 'Tư duy bị động',
      flipAfterTitle: 'Tư duy hệ thống làm chủ',
      wordRange: '130-180 từ/trang',
      pedagogyRule:
        'Ngôn ngữ học thuật hệ thống, sắc bén, phát triển tư duy phản biện, tư duy mô hình hóa và phương pháp Feynman (giải thích bản chất phức tạp bằng tư duy gốc rễ rõ ràng). Liên hệ bài toán thực tế và bản chất khoa học. Lời giảng (script) chuyên sâu nhưng dễ nghe từ 130-180 từ/trang. Thẻ lật 3D theo cặp "Tư duy bị động" (before) -> "Tư duy hệ thống làm chủ" (after).'
    }
  };

  function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * TỐI ƯU RAM BẮT BUỘC:
   * Nén mọi ảnh tải lên / chụp camera / dán Ctrl+V qua <canvas> ẩn:
   * - Giữ tỷ lệ, chiều rộng tối đa 1280px.
   * - Xuất JPEG chất lượng 0.8.
   * - Thu hồi ObjectURL và giải phóng kích thước canvas ngay sau khi mã hóa Base64.
   */
  function compressImageFile(fileOrBlob, customName) {
    return new Promise((resolve, reject) => {
      if (!fileOrBlob || !(fileOrBlob instanceof Blob)) {
        reject(new Error('Dữ liệu hình ảnh không hợp lệ.'));
        return;
      }

      const objectUrl = URL.createObjectURL(fileOrBlob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        try {
          let targetW = img.naturalWidth || img.width || 1;
          let targetH = img.naturalHeight || img.height || 1;

          if (targetW > MAX_IMAGE_WIDTH) {
            const scale = MAX_IMAGE_WIDTH / targetW;
            targetW = MAX_IMAGE_WIDTH;
            targetH = Math.max(1, Math.round(targetH * scale));
          }

          canvas.width = targetW;
          canvas.height = targetH;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            throw new Error('Trình duyệt không khởi tạo được bộ nén ảnh Canvas 2D.');
          }

          // Tô nền trắng tránh nền đen khi chuyển PNG trong suốt sang JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          const base64 = dataUrl.split(',')[1] || '';
          const compressedBytes = Math.round((base64.length * 3) / 4);

          const name =
            customName ||
            (fileOrBlob.name && fileOrBlob.name.trim()) ||
            `anh_chup_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}.jpg`;

          resolve({
            id: generateId('att'),
            kind: 'image',
            name,
            mimeType: 'image/jpeg',
            base64,
            dataUrl,
            originalSize: fileOrBlob.size || compressedBytes,
            compressedSize: compressedBytes,
            width: targetW,
            height: targetH
          });
        } catch (err) {
          reject(new Error(`Không thể nén hình ảnh: ${err.message}`));
        } finally {
          // Giải phóng RAM trình duyệt ngay lập tức
          URL.revokeObjectURL(objectUrl);
          canvas.width = 0;
          canvas.height = 0;
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Không thể đọc tệp hình ảnh. Vui lòng chọn ảnh .jpg, .png hoặc .webp hợp lệ.'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Đọc tệp PDF (giới hạn < 10MB) thành Base64 gửi qua inlineData của Gemini.
   */
  function readPdfFile(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_PDF_BYTES) {
        reject(
          new Error(
            `Tệp PDF "${file.name}" có dung lượng ${formatBytes(file.size)}, vượt mức tối đa 10MB. Vui lòng chọn tệp nhỏ hơn hoặc chụp ảnh trang sách cần học.`
          )
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({
          id: generateId('att'),
          kind: 'pdf',
          name: file.name,
          mimeType: 'application/pdf',
          base64,
          originalSize: file.size,
          compressedSize: file.size
        });
      };
      reader.onerror = () => {
        reject(new Error(`Không thể đọc tệp PDF "${file.name}".`));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Đọc tệp văn bản (.txt, .md) dưới dạng UTF-8.
   */
  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_TEXT_BYTES) {
        reject(
          new Error(
            `Tệp văn bản "${file.name}" vượt quá 2MB (${formatBytes(file.size)}). Vui lòng rút gọn nội dung.`
          )
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const textContent = String(reader.result || '').trim();
        if (!textContent) {
          reject(new Error(`Tệp "${file.name}" đang trống, không có nội dung để biên soạn.`));
          return;
        }
        resolve({
          id: generateId('att'),
          kind: 'text',
          name: file.name,
          mimeType: 'text/plain',
          textContent: textContent.slice(0, 40000),
          originalSize: file.size,
          compressedSize: file.size
        });
      };
      reader.onerror = () => {
        reject(new Error(`Không thể đọc tệp văn bản "${file.name}".`));
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Tự động phân loại và xử lý tệp đầu vào (Ảnh / PDF / TXT / MD).
   */
  async function processInputFile(file) {
    if (!file) {
      throw new Error('Không tìm thấy tệp để xử lý.');
    }
    const nameLower = (file.name || '').toLowerCase();
    const mimeLower = (file.type || '').toLowerCase();

    const isImage =
      mimeLower.startsWith('image/') ||
      /\.(jpe?g|png|webp|bmp|gif)$/i.test(nameLower);
    const isPdf = mimeLower === 'application/pdf' || nameLower.endsWith('.pdf');
    const isText =
      mimeLower.startsWith('text/') ||
      nameLower.endsWith('.txt') ||
      nameLower.endsWith('.md');

    if (isImage) {
      return await compressImageFile(file);
    }
    if (isPdf) {
      return await readPdfFile(file);
    }
    if (isText) {
      return await readTextFile(file);
    }

    throw new Error(
      `Định dạng tệp "${file.name}" chưa được hỗ trợ. Vui lòng dùng ảnh (.jpg, .png, .webp), .pdf (< 10MB) hoặc .txt/.md.`
    );
  }

  /**
   * Xây dựng System Instruction chuẩn sư phạm 4D Song Não, nhận diện ngữ cảnh thông minh.
   */
  function buildSystemInstruction(grade, slideCount) {
    const profile = GRADE_PROFILES[grade] || GRADE_PROFILES[4];

    return `Bạn là Kiến Trúc Sư Sư Phạm 4D Song Não hàng đầu của "Học Viện 4D Gia Đình" tại Việt Nam.
Nhiệm vụ của bạn là đọc hiểu đầu vào đa phương thức (ảnh trang sách giáo khoa, ảnh vở bài tập, ảnh bìa sách, tệp PDF, văn bản hoặc chủ đề) và biên soạn trọn bộ bài giảng 4D tương tác chuẩn JSON tiếng Việt cho học sinh ${profile.label}.

1. NHẬN DIỆN NGỮ CẢNH THÔNG MINH:
- Nếu đầu vào là **Trang sách giáo khoa / Vở bài tập / Tài liệu học tập**: Trích xuất chính xác kiến thức trọng tâm, định nghĩa, công thức và ví dụ minh họa cốt lõi; chuyển hóa thành từng slide dễ hiểu, sinh động, tuyệt đối không chép nguyên văn khô khan.
- Nếu đầu vào là **Bìa một cuốn sách**: Nhận diện chính xác tựa sách, tác giả (nếu nhận ra) và chắt lọc những bài học tư duy, kỹ năng hoặc giá trị sống cốt lõi nhất của cuốn sách đó để thiết kế hành trình khám phá phù hợp đúng trình độ ${profile.label}.
- Nếu đầu vào là **Chủ đề văn bản**: Tự xây dựng giáo án chuẩn sư phạm bám sát Chương trình Giáo dục Phổ thông mới của Việt Nam.
- Nếu phụ huynh có ghi chú riêng (ví dụ: chỗ con hay nhầm), hãy ưu tiên giải quyết triệt để điểm đó!

2. PHÂN TẦNG SƯ PHẠM BẮT BUỘC CHO ${profile.label.toUpperCase()}:
- ${profile.pedagogyRule}
- Độ dài lời giảng (script): ${profile.wordRange}.
- Số lượng trang bài giảng: CHÍNH XÁC ${slideCount} slide (đánh số page từ 1 đến ${slideCount}), sắp xếp theo mạch học tập 4D: Khơi gợi tò mò -> Bản chất cốt lõi -> Ví dụ trực quan -> Thực hành/Phản biện -> Tổng kết ứng dụng.

3. QUY ĐỊNH CẤU TRÚC JSON NGHIÊM NGẶT (chỉ trả về duy nhất 1 JSON object hợp lệ, không kèm giải thích ngoài JSON):
{
  "title": "Tên bài giảng hấp dẫn, súc tích",
  "subject": "Tên môn học hoặc lĩnh vực (VD: Toán học, Khoa học tự nhiên, Kỹ năng sống...)",
  "grade": ${profile.grade},
  "source_type": "textbook | book_cover | document | topic",
  "summary": "Tóm tắt mục tiêu bài học trong 1-2 câu ngắn gọn",
  "slides": [
    {
      "page": 1,
      "heading": "Tiêu đề ngắn gọn, bắt mắt của slide",
      "heart_message": "Thông điệp trái tim cốt lõi DƯỚI 20 TỪ, dễ nhớ ngay",
      "flip_card": {
        "before": "Quan niệm sai / thói quen cũ (${profile.flipBeforeTitle})",
        "after": "Hiểu đúng bản chất / góc nhìn mới (${profile.flipAfterTitle})"
      },
      "script": "Lời giảng mạch lạc, tự nhiên, giàu cảm xúc để đọc giọng nói tiếng Việt (${profile.wordRange}). Không dùng ký hiệu markdown như ** hoặc #.",
      "quick_check": {
        "question": "Câu hỏi trắc nghiệm kiểm tra hiểu bản chất ngay sau slide",
        "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
        "correct_index": 0,
        "explanation": "Giải thích ngắn gọn, khích lệ tại sao đáp án đó đúng"
      },
      "image_search_query": "2-4 precise English or scientific keywords for high-quality landscape photo/diagram",
      "youtube_search_query": "Từ khóa tiếng Việt ngắn gọn tìm video giáo dục chuẩn trên YouTube",
      "visual_prompt": "Detailed 16:9 visual prompt in English for Google Flow image/video generation",
      "fallback_svg": "<svg viewBox=\\"0 0 800 450\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"
    }
  ]
}

4. YÊU CẦU CHẤT LƯỢNG CAO CHO "fallback_svg":
- Mỗi slide BẮT BUỘC có 1 đoạn mã <svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">...</svg> sạch sẽ, thẩm mỹ, màu sắc hài hòa (nền sáng dịu, khối hình học, mũi tên, biểu đồ phân số, sơ đồ lực, sơ đồ tư duy hoặc hình minh họa đúng nội dung slide đó).
- Chữ trong SVG dùng font-family="sans-serif", ngắn gọn, căn chỉnh gọn gàng không bị tràn khung 800x450.
- TUYỆT ĐỐI KHÔNG chứa thẻ <script>, <foreignObject>, sự kiện onload/onclick hay đường dẫn ngoài trong SVG.`;
  }

  /**
   * Trích xuất JSON an toàn từ văn bản phản hồi của Gemini.
   */
  function safeParseLessonJson(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('AI không trả về dữ liệu bài giảng. Vui lòng thử lại.');
    }
    let cleaned = rawText.trim();
    // Gỡ bỏ markdown fence nếu model lỡ bọc ```json ... ```
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      cleaned = fenceMatch[1].trim();
    }
    try {
      return JSON.parse(cleaned);
    } catch (_firstErr) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch (_secondErr) {
          // rơi xuống lỗi rõ ràng bên dưới
        }
      }
      throw new Error(
        'Dữ liệu JSON từ AI bị gián đoạn hoặc chưa hoàn chỉnh. Vui lòng giảm nhẹ số trang hoặc bấm Khởi Tạo lại.'
      );
    }
  }

  /**
   * Chuẩn hóa cấu trúc bài giảng 4D và làm sạch toàn bộ fallback_svg.
   */
  function normalizeLesson(rawLesson, grade) {
    const profile = GRADE_PROFILES[grade] || GRADE_PROFILES[4];
    const sanitize =
      global.MediaFinder && typeof global.MediaFinder.sanitizeSVG === 'function'
        ? global.MediaFinder.sanitizeSVG
        : (s) => String(s || '');

    const rawSlides = Array.isArray(rawLesson.slides) ? rawLesson.slides : [];
    if (!rawSlides.length) {
      throw new Error('AI chưa sinh được danh sách slide bài học. Vui lòng thử lại.');
    }

    const slides = rawSlides.map((s, idx) => {
      const heading = String(s.heading || `Trang ${idx + 1}`).trim();
      const heartMessage = String(s.heart_message || 'Ghi nhớ bản chất cốt lõi của bài học!').trim();
      const flip = s.flip_card && typeof s.flip_card === 'object' ? s.flip_card : {};
      const qc = s.quick_check && typeof s.quick_check === 'object' ? s.quick_check : {};

      let options = Array.isArray(qc.options)
        ? qc.options.map((opt) => String(opt || '').trim()).filter(Boolean)
        : [];
      while (options.length < 4) {
        options.push(`Lựa chọn ${String.fromCharCode(65 + options.length)}`);
      }
      options = options.slice(0, 4);

      let correctIndex = Number.isInteger(qc.correct_index) ? qc.correct_index : parseInt(qc.correct_index, 10);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        correctIndex = 0;
      }

      const safeSvg = sanitize(s.fallback_svg, heading, heartMessage);

      return {
        page: idx + 1,
        heading,
        heart_message: heartMessage,
        flip_card: {
          before: String(flip.before || 'Cách hiểu chưa trọn vẹn trước đây.').trim(),
          after: String(flip.after || 'Hiểu sâu bản chất và vận dụng linh hoạt!').trim()
        },
        script: String(s.script || heartMessage).trim(),
        quick_check: {
          question: String(qc.question || `Câu hỏi ôn tập cho phần "${heading}"?`).trim(),
          options,
          correct_index: correctIndex,
          explanation: String(qc.explanation || 'Tuyệt vời! Con đã nắm rất chắc ý chính của trang này.').trim()
        },
        image_search_query: String(s.image_search_query || heading).trim(),
        youtube_search_query: String(s.youtube_search_query || heading).trim(),
        visual_prompt: String(
          s.visual_prompt || `Clean 16:9 educational illustration about ${heading}, bright modern style`
        ).trim(),
        fallback_svg: safeSvg,
        media_type: 'svg',
        media_url: '',
        media_source: 'Sơ đồ minh họa AI (SVG)',
        media_title: heading,
        media_candidates: { videos: [], images: [] }
      };
    });

    return {
      id: generateId('lesson'),
      title: String(rawLesson.title || 'Bài giảng 4D mới').trim(),
      subject: String(rawLesson.subject || 'Kiến thức tổng hợp').trim(),
      grade: profile.grade,
      source_type: String(rawLesson.source_type || 'topic'),
      summary: String(rawLesson.summary || `Bài giảng 4D tương tác dành cho ${profile.label}`).trim(),
      createdAt: new Date().toISOString(),
      slides
    };
  }

  /**
   * Dịch lỗi HTTP/API sang thông báo tiếng Việt thân thiện, dễ hiểu cho phụ huynh.
   */
  function translateGeminiError(status, errorBody) {
    const rawMsg =
      (errorBody && errorBody.error && errorBody.error.message) ||
      (typeof errorBody === 'string' ? errorBody : '');

    if (status === 400) {
      if (/API_KEY_INVALID|API key not valid/i.test(rawMsg)) {
        return 'Gemini API Key không hợp lệ. Vui lòng kiểm tra lại khóa API trong "Chế Độ Phụ Huynh".';
      }
      return `Yêu cầu gửi lên Gemini chưa hợp lệ (Mã 400). Chi tiết: ${rawMsg || 'Vui lòng thử lại với tệp nhỏ hơn.'}`;
    }
    if (status === 401 || status === 403) {
      return 'Gemini API Key bị từ chối hoặc chưa được kích hoạt (Mã 403). Vui lòng kiểm tra lại khóa API trong "Chế Độ Phụ Huynh".';
    }
    if (status === 404) {
      return `Không tìm thấy model AI đã chọn (Mã 404). Vui lòng chọn lại model "gemini-3.5-flash-lite" trong "Chế Độ Phụ Huynh".`;
    }
    if (status === 429) {
      return 'Tài khoản Gemini API đang tạm hết hạn mức miễn phí trong phút này (Mã 429). Vui lòng đợi khoảng 30-60 giây rồi bấm thử lại.';
    }
    if (status >= 500) {
      return 'Máy chủ Gemini Google đang bận tạm thời. Vui lòng thử lại sau vài giây.';
    }
    return `Lỗi kết nối Gemini API (Mã ${status}): ${rawMsg || 'Không rõ nguyên nhân'}`;
  }

  /**
   * HÀM CHÍNH: Chạy trọn quy trình 4 bước tạo Bài Giảng 4D + Tự động tìm Media.
   */
  async function generateLesson(options) {
    const {
      grade = 4,
      slideCount,
      topicText = '',
      attachments = [],
      apiKey = '',
      model = DEFAULT_MODEL,
      autoMedia = true,
      mediaSettings = {},
      onStage = () => {}
    } = options || {};

    const cleanApiKey = String(apiKey || '').trim();
    if (!cleanApiKey) {
      throw new Error(
        'Chưa nhập Gemini API Key! Vui lòng bấm nút "👨‍👩‍👧 Chế Độ Phụ Huynh" để dán Gemini API Key trước khi tạo bài giảng.'
      );
    }

    const cleanTopic = String(topicText || '').trim();
    const safeAttachments = Array.isArray(attachments) ? attachments : [];
    if (!cleanTopic && safeAttachments.length === 0) {
      throw new Error(
        'Vui lòng dán ảnh trang sách (Ctrl+V), tải tệp PDF/Ảnh/TXT hoặc nhập tên chủ đề cần học trước khi khởi tạo!'
      );
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error(
        'Thiết bị đang ngoại tuyến (mất kết nối mạng). Cần có Internet để gọi Gemini AI tạo bài giảng mới.'
      );
    }

    const profile = GRADE_PROFILES[grade] || GRADE_PROFILES[4];
    const targetSlideCount = Math.max(3, Math.min(15, Number(slideCount) || profile.defaultSlides));
    const activeModel = String(model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

    // BƯỚC 1: Chuẩn bị & phân tích dữ liệu đa phương thức
    onStage(1, 'Đang đọc nội dung & phân tích hình ảnh/tài liệu...', { percent: 15 });

    const userParts = [];
    const promptLines = [
      `Hãy biên soạn một bài giảng 4D Song Não gồm ĐÚNG ${targetSlideCount} trang cho học sinh ${profile.label}.`
    ];

    if (cleanTopic) {
      promptLines.push(`Chủ đề / Ghi chú từ phụ huynh hoặc học sinh: "${cleanTopic}".`);
    }

    const textDocs = safeAttachments.filter((a) => a.kind === 'text' && a.textContent);
    if (textDocs.length > 0) {
      promptLines.push('\nNội dung tài liệu văn bản đính kèm:');
      textDocs.forEach((doc, i) => {
        promptLines.push(`--- Tài liệu ${i + 1}: ${doc.name} ---\n${doc.textContent}\n--- Hết tài liệu ${i + 1} ---`);
      });
    }

    const mediaDocs = safeAttachments.filter((a) => (a.kind === 'image' || a.kind === 'pdf') && a.base64);
    if (mediaDocs.length > 0) {
      promptLines.push(
        `\nĐính kèm ${mediaDocs.length} tệp hình ảnh/PDF. Hãy đọc thật kỹ toàn bộ chữ viết, công thức, hình vẽ hoặc bìa sách trong các tệp này để chuyển hóa thành bài giảng 4D hấp dẫn, chính xác.`
      );
    }

    userParts.push({ text: promptLines.join('\n') });

    for (const att of mediaDocs) {
      userParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.base64
        }
      });
    }

    // BƯỚC 2: Gọi Gemini Cloud API với cơ chế tự chuyển model dự phòng thông minh
    const modelQueue = [activeModel];
    for (const fb of FALLBACK_MODELS) {
      if (!modelQueue.includes(fb)) modelQueue.push(fb);
    }

    const requestBody = {
      systemInstruction: {
        parts: [{ text: buildSystemInstruction(profile.grade, targetSlideCount) }]
      },
      contents: [
        {
          role: 'user',
          parts: userParts
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 16384
      }
    };

    let apiJson = null;
    let usedModel = activeModel;
    let lastErrorMessage = '';

    for (let mIdx = 0; mIdx < modelQueue.length; mIdx++) {
      const candidateModel = modelQueue[mIdx];
      usedModel = candidateModel;

      if (mIdx === 0) {
        onStage(2, `AI (${candidateModel}) đang biên soạn bài giảng 4D Song Não & Trắc nghiệm...`, {
          percent: 42
        });
      } else {
        onStage(
          2,
          `Model trước đang bận/hạn chế — đang tự động chuyển sang ${candidateModel}...`,
          { percent: 46 }
        );
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        candidateModel
      )}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr && fetchErr.name === 'AbortError') {
          lastErrorMessage = `Model ${candidateModel} phản hồi quá lâu (hết 95 giây).`;
          continue;
        }
        throw new Error(
          'Không thể kết nối đến máy chủ Gemini API. Vui lòng kiểm tra kết nối Internet (hoặc thử mở trực tiếp file index.html bằng Chrome/Edge) rồi thử lại.'
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        apiJson = await response.json();
        break;
      }

      let errData = null;
      try {
        errData = await response.json();
      } catch (_e) {
        try {
          errData = await response.text();
        } catch (_e2) {}
      }

      const rawErrMsg =
        (errData && errData.error && errData.error.message) ||
        (typeof errData === 'string' ? errData : '');

      // Nếu sai API Key thì dừng ngay không cần thử model khác
      if (/API_KEY_INVALID|API key not valid|API key expired/i.test(rawErrMsg)) {
        throw new Error(translateGeminiError(response.status, errData));
      }

      lastErrorMessage = translateGeminiError(response.status, errData);

      // Các lỗi do model không hỗ trợ / hạn mức Pro / quá tải tạm -> tự động thử model tiếp theo
      const canFallback =
        response.status === 404 ||
        response.status === 429 ||
        response.status === 503 ||
        response.status === 500 ||
        (response.status === 403 && !/API_KEY/i.test(rawErrMsg));

      if (!canFallback || mIdx === modelQueue.length - 1) {
        throw new Error(lastErrorMessage);
      }
    }

    if (!apiJson) {
      throw new Error(lastErrorMessage || 'Không nhận được phản hồi từ Gemini AI. Vui lòng thử lại.');
    }

    const candidate = apiJson && Array.isArray(apiJson.candidates) ? apiJson.candidates[0] : null;
    if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) {
      const blockReason =
        (apiJson && apiJson.promptFeedback && apiJson.promptFeedback.blockReason) || '';
      throw new Error(
        blockReason
          ? `Nội dung bị bộ lọc an toàn Gemini chặn (${blockReason}). Vui lòng thử tài liệu khác.`
          : 'Gemini không trả về nội dung bài giảng. Vui lòng thử lại.'
      );
    }

    const rawText = candidate.content.parts
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .join('');

    const parsedJson = safeParseLessonJson(rawText);
    const lesson = normalizeLesson(parsedJson, profile.grade);
    lesson.modelUsed = usedModel;

    // BƯỚC 3: Tự động tìm hình ảnh & video minh họa cho từng slide
    if (autoMedia && global.MediaFinder && typeof global.MediaFinder.enrichLessonMedia === 'function') {
      const total = lesson.slides.length;
      onStage(3, `Đang tự động tìm hình ảnh & video minh họa (slide 1 / ${total})...`, {
        percent: 62,
        currentSlide: 1,
        totalSlides: total
      });

      await global.MediaFinder.enrichLessonMedia(lesson, mediaSettings, (current, count) => {
        const pct = 62 + Math.round((current / count) * 33);
        onStage(3, `Đang tự động tìm hình ảnh & video minh họa (slide ${current} / ${count})...`, {
          percent: Math.min(95, pct),
          currentSlide: current,
          totalSlides: count
        });
      });
    } else {
      onStage(3, 'Đang lắp ráp sơ đồ minh họa SVG ngoại tuyến cho từng trang...', { percent: 88 });
    }

    // BƯỚC 4: Hoàn tất
    onStage(4, 'Hoàn tất! Bài giảng 4D đã sẵn sàng để xem nhanh và bắt đầu học.', { percent: 100 });

    return lesson;
  }

  /**
   * Kiểm tra nhanh kết nối Gemini API Key & model từ Chế độ Phụ huynh.
   */
  async function testApiConnection(apiKey, model) {
    const cleanKey = String(apiKey || '').trim();
    if (!cleanKey) {
      return { ok: false, message: 'Vui lòng dán Gemini API Key trước khi kiểm tra.' };
    }
    const tryModels = [String(model || DEFAULT_MODEL).trim() || DEFAULT_MODEL, ...FALLBACK_MODELS];
    const uniqueModels = Array.from(new Set(tryModels));

    for (const m of uniqueModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            m
          )}:generateContent?key=${encodeURIComponent(cleanKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Chào bạn, trả lời ngắn: OK' }] }],
              generationConfig: { maxOutputTokens: 10 }
            })
          }
        );
        if (res.ok) {
          return {
            ok: true,
            model: m,
            message:
              m === uniqueModels[0]
                ? `Kết nối thành công với model ${m}!`
                : `API Key hợp lệ! (Model ${uniqueModels[0]} đang hạn chế — hệ thống sẽ tự động dùng ${m}).`
          };
        }
        const errBody = await res.json().catch(() => null);
        const raw = (errBody && errBody.error && errBody.error.message) || '';
        if (/API_KEY_INVALID|API key not valid/i.test(raw)) {
          return { ok: false, message: translateGeminiError(res.status, errBody) };
        }
      } catch (_netErr) {
        return { ok: false, message: 'Không thể kết nối mạng tới máy chủ Google Gemini.' };
      }
    }
    return {
      ok: false,
      message: 'API Key hiện chưa truy cập được các model Gemini hoặc đã tạm hết hạn mức.'
    };
  }

  global.AILessonFactory = {
    GRADE_PROFILES,
    DEFAULT_MODEL,
    FALLBACK_MODELS,
    MAX_IMAGE_WIDTH,
    JPEG_QUALITY,
    MAX_PDF_BYTES,
    formatBytes,
    compressImageFile,
    processInputFile,
    buildSystemInstruction,
    normalizeLesson,
    generateLesson,
    testApiConnection
  };
})(window);
