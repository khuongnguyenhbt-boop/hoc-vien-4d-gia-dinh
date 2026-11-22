/**
 * Bài giảng 4D mẫu sẵn cho 3 hồ sơ: Lớp 4, Lớp 7, Lớp 10
 * Giúp phụ huynh & các con trải nghiệm ngay mô hình 4D Song Não, Thẻ lật 3D, Trắc nghiệm & Sơ đồ SVG.
 */
(function (global) {
  'use strict';

  global.SAMPLE_LESSONS = [
    {
      id: 'sample_g4_quydong',
      title: 'Bí Kíp Quy Đồng Mẫu Số Phân Số',
      subject: 'Toán học',
      grade: 4,
      source_type: 'topic',
      summary: 'Hiểu bản chất quy đồng mẫu số qua câu chuyện chia bánh pizza, không còn nhầm lẫn khi so sánh hay cộng phân số.',
      createdAt: '2026-01-01T08:00:00.000Z',
      slides: [
        {
          page: 1,
          heading: 'Vì sao phải "cắt bánh đều nhau"?',
          heart_message: 'Muốn so sánh hay cộng bánh, các miếng bánh phải bằng kích thước nhau!',
          flip_card: {
            before: 'Thấy 1/2 và 1/3 liền cộng luôn tử với tử, mẫu với mẫu thành 2/5.',
            after: 'Miếng 1/2 to hơn miếng 1/3! Phải chia lại cho các miếng bằng nhau rồi mới đếm được.'
          },
          script: 'Chào con! Hôm nay chúng mình cùng mở tiệc pizza nhé. Bạn An có nửa chiếc bánh tức là 1/2, còn bạn Bình có 1/3 chiếc bánh. Vì hai miếng bánh to nhỏ khác nhau nên ta không thể đếm gộp ngay được. Quy đồng mẫu số chính là phép màu cắt lại hai chiếc bánh thành những miếng nhỏ bằng hệt nhau để so sánh và cộng thật dễ dàng!',
          quick_check: {
            question: 'Tại sao ta cần quy đồng mẫu số trước khi cộng 1/2 và 1/3?',
            options: [
              'Để các phần bánh có kích thước bằng nhau (cùng mẫu số)',
              'Để làm cho số to hơn cho đẹp mắt',
              'Vì không được phép cộng hai số nhỏ',
              'Để bỏ bớt mẫu số đi'
            ],
            correct_index: 0,
            explanation: 'Chính xác! Khi cùng mẫu số, mỗi phần có kích thước bằng nhau nên ta chỉ cần đếm tổng số phần ở tử số.'
          },
          image_search_query: 'pizza fractions math illustration',
          youtube_search_query: 'quy đồng mẫu số phân số lớp 4 dễ hiểu',
          visual_prompt: 'Bright playful 16:9 educational illustration showing two pizzas cut into halves and thirds transforming into sixths for 4th grade kids',
          fallback_svg: `<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g4bg1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="100%" stop-color="#E0F2FE"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" rx="20" fill="url(#g4bg1)"/>
  <text x="400" y="52" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#1E293B">CẮT BÁNH CÙNG CỠ = QUY ĐỒNG MẪU SỐ</text>
  <circle cx="170" cy="220" r="88" fill="#FEF3C7" stroke="#F59E0B" stroke-width="5"/>
  <path d="M170,220 L170,132 A88,88 0 0,1 170,308 Z" fill="#F97316" fill-opacity="0.85"/>
  <line x1="170" y1="132" x2="170" y2="308" stroke="#FFFFFF" stroke-width="4"/>
  <text x="170" y="348" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#EA580C">1 / 2</text>
  <text x="295" y="232" text-anchor="middle" font-family="sans-serif" font-size="36" font-weight="700" fill="#64748B">+</text>
  <circle cx="400" cy="220" r="88" fill="#FEF3C7" stroke="#F59E0B" stroke-width="5"/>
  <path d="M400,220 L400,132 A88,88 0 0,1 476,264 Z" fill="#0EA5E9" fill-opacity="0.85"/>
  <line x1="400" y1="220" x2="400" y2="132" stroke="#FFFFFF" stroke-width="4"/>
  <line x1="400" y1="220" x2="476" y2="264" stroke="#FFFFFF" stroke-width="4"/>
  <line x1="400" y1="220" x2="324" y2="264" stroke="#FFFFFF" stroke-width="4"/>
  <text x="400" y="348" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#0284C7">1 / 3</text>
  <text x="520" y="232" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#10B981">⇒</text>
  <circle cx="640" cy="220" r="88" fill="#DCFCE7" stroke="#10B981" stroke-width="5"/>
  <path d="M640,220 L640,132 A88,88 0 0,1 640,308 Z" fill="#F97316" fill-opacity="0.85"/>
  <path d="M640,220 L640,308 A88,88 0 0,1 564,176 Z" fill="#0EA5E9" fill-opacity="0.85"/>
  <line x1="640" y1="132" x2="640" y2="308" stroke="#FFFFFF" stroke-width="3"/>
  <line x1="564" y1="176" x2="716" y2="264" stroke="#FFFFFF" stroke-width="3"/>
  <line x1="716" y1="176" x2="564" y2="264" stroke="#FFFFFF" stroke-width="3"/>
  <text x="640" y="348" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#059669">3/6 + 2/6 = 5/6</text>
</svg>`,
          media_type: 'svg',
          media_url: '',
          media_source: 'Sơ đồ minh họa AI (SVG)',
          media_title: 'Minh họa chia bánh quy đồng mẫu số',
          media_candidates: { videos: [], images: [] }
        },
        {
          page: 2,
          heading: 'Quy tắc vàng: Công bằng cho cả Tử và Mẫu',
          heart_message: 'Nhân mẫu số với số nào, nhớ nhân tử số với ĐÚNG số đó!',
          flip_card: {
            before: 'Chỉ nhân mỗi mẫu số cho giống nhau mà quên không nhân tử số.',
            after: 'Tử số và mẫu số như anh em sinh đôi: cùng nhân với 1 số thì giá trị bánh không đổi!'
          },
          script: 'Đây là bí kíp chống nhầm số một! Để biến mẫu số 2 thành 6, ta nhân mẫu số 2 với 3. Để chiếc bánh vẫn giữ nguyên lượng cũ không bị thiệt, ta cũng phải nhân tử số 1 với 3. Vậy 1/2 biến hóa thành 3/6. Tương tự, 1/3 cùng nhân cả tử và mẫu với 2 sẽ thành 2/6. Siêu công bằng phải không con!',
          quick_check: {
            question: 'Khi quy đồng 2/3 với mẫu số chung là 12, phân số mới là bao nhiêu?',
            options: ['2/12', '6/12', '8/12', '10/12'],
            correct_index: 2,
            explanation: 'Xuất sắc! Mẫu số 3 nhân 4 bằng 12, nên tử số 2 cũng nhân 4 bằng 8. Kết quả là 8/12!'
          },
          image_search_query: 'equivalent fractions colorful math diagram',
          youtube_search_query: 'cách quy đồng mẫu số hai phân số lớp 4',
          visual_prompt: 'Cheerful 16:9 infographic showing 2/3 multiplying numerator and denominator both by 4 to become 8/12',
          fallback_svg: `<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="450" rx="20" fill="#F0FDF4"/>
  <text x="400" y="54" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#166534">QUY TẮC CÔNG BẰNG: CÙNG NHÂN TỬ VÀ MẪU</text>
  <rect x="120" y="120" width="160" height="210" rx="20" fill="#FFFFFF" stroke="#86EFAC" stroke-width="4"/>
  <text x="200" y="200" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="700" fill="#0F172A">2</text>
  <line x1="150" y1="225" x2="250" y2="225" stroke="#0F172A" stroke-width="5"/>
  <text x="200" y="292" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="700" fill="#0F172A">3</text>
  <rect x="330" y="145" width="140" height="54" rx="27" fill="#F97316"/>
  <text x="400" y="181" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">× 4  →</text>
  <rect x="330" y="248" width="140" height="54" rx="27" fill="#0EA5E9"/>
  <text x="400" y="284" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">× 4  →</text>
  <rect x="520" y="120" width="160" height="210" rx="20" fill="#FFFFFF" stroke="#22C55E" stroke-width="4"/>
  <text x="600" y="200" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="700" fill="#EA580C">8</text>
  <line x1="550" y1="225" x2="650" y2="225" stroke="#0F172A" stroke-width="5"/>
  <text x="600" y="292" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="700" fill="#0284C7">12</text>
  <text x="400" y="395" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="600" fill="#15803D">Giá trị phân số KHÔNG ĐỔI: 2/3 = 8/12</text>
</svg>`,
          media_type: 'svg',
          media_url: '',
          media_source: 'Sơ đồ minh họa AI (SVG)',
          media_title: 'Quy tắc cùng nhân tử và mẫu',
          media_candidates: { videos: [], images: [] }
        }
      ]
    },
    {
      id: 'sample_g7_anhsang',
      title: 'Định Luật Phản Xạ Ánh Sáng & Gương Phẳng',
      subject: 'Khoa học tự nhiên',
      grade: 7,
      source_type: 'topic',
      summary: 'Khám phá lý do ta thấy mình trong gương, phân biệt góc tới – góc phản xạ và ứng dụng kính tiềm vọng.',
      createdAt: '2026-01-02T08:00:00.000Z',
      slides: [
        {
          page: 1,
          heading: 'Ánh sáng bật lại như quả bóng bi-a',
          heart_message: 'Góc phản xạ luôn bằng góc tới (i\' = i) tính từ đường pháp tuyến!',
          flip_card: {
            before: 'Học thuộc công thức i = i\' nhưng hay đo nhầm góc giữa tia sáng và mặt gương.',
            after: 'Luôn dựng đường pháp tuyến vuông góc mặt gương ở điểm tới rồi mới đo góc tới i và góc phản xạ i\'.'
          },
          script: 'Khi con chiếu đèn pin vào một chiếc gương phẳng, tia sáng không biến mất mà bật ngược trở lại giống hệt quả bóng nảy trên tường phẳng. Các nhà vật lý đặt một đường tưởng tượng vuông góc với mặt gương gọi là đường pháp tuyến. Góc hợp bởi tia tới và pháp tuyến gọi là góc tới i, và tia phản xạ luôn đi ra với góc phản xạ i phẩy bằng chính xác góc tới i. Đây là quy luật giúp ta thiết kế gương chiếu hậu và kính tiềm vọng tàu ngầm!',
          quick_check: {
            question: 'Một tia sáng chiếu tới gương phẳng tạo với MẶT GƯƠNG một góc 30°. Góc phản xạ bằng bao nhiêu?',
            options: ['30°', '60°', '90°', '120°'],
            correct_index: 1,
            explanation: 'Chuẩn xác! Pháp tuyến vuông góc mặt gương (90°), nên góc tới i = 90° - 30° = 60°. Do đó góc phản xạ i\' = 60°.'
          },
          image_search_query: 'law of reflection physics diagram mirror',
          youtube_search_query: 'định luật phản xạ ánh sáng khtn 7',
          visual_prompt: 'Clean 16:9 physics diagram showing light ray reflecting off a flat mirror with normal line, angle of incidence i and reflection i prime',
          fallback_svg: `<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="450" rx="20" fill="#EFF6FF"/>
  <text x="400" y="48" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#1E3A8A">ĐỊNH LUẬT PHẢN XẠ ÁNH SÁNG (i = i')</text>
  <rect x="120" y="340" width="560" height="16" fill="#3B82F6"/>
  <line x1="120" y1="356" x2="680" y2="356" stroke="#1E40AF" stroke-width="3" stroke-dasharray="10,8"/>
  <line x1="400" y1="90" x2="400" y2="340" stroke="#64748B" stroke-width="3" stroke-dasharray="8,6"/>
  <text x="414" y="108" font-family="sans-serif" font-size="16" font-weight="700" fill="#475569">Pháp tuyến (N)</text>
  <line x1="190" y1="130" x2="400" y2="340" stroke="#F59E0B" stroke-width="6"/>
  <text x="215" y="132" font-family="sans-serif" font-size="18" font-weight="700" fill="#D97706">Tia tới (SI)</text>
  <line x1="400" y1="340" x2="610" y2="130" stroke="#10B981" stroke-width="6"/>
  <text x="520" y="132" font-family="sans-serif" font-size="18" font-weight="700" fill="#059669">Tia phản xạ (IR)</text>
  <path d="M 352,292 A 68,68 0 0,1 400,272" fill="none" stroke="#F59E0B" stroke-width="4"/>
  <path d="M 400,272 A 68,68 0 0,1 448,292" fill="none" stroke="#10B981" stroke-width="4"/>
  <text x="366" y="262" font-family="sans-serif" font-size="22" font-weight="700" fill="#D97706">i</text>
  <text x="424" y="262" font-family="sans-serif" font-size="22" font-weight="700" fill="#059669">i'</text>
  <circle cx="400" cy="340" r="7" fill="#1E293B"/>
  <text x="400" y="405" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="600" fill="#1E3A8A">Gương phẳng • Góc tới i luôn đo từ Pháp tuyến N</text>
</svg>`,
          media_type: 'svg',
          media_url: '',
          media_source: 'Sơ đồ minh họa AI (SVG)',
          media_title: 'Sơ đồ phản xạ ánh sáng gương phẳng',
          media_candidates: { videos: [], images: [] }
        }
      ]
    },
    {
      id: 'sample_g10_newton2',
      title: 'Định Luật II Newton & Tư Duy Mô Hình Hóa Lực',
      subject: 'Vật lý',
      grade: 10,
      source_type: 'topic',
      summary: 'Làm chủ bản chất vector của F = m·a bằng phương pháp Feynman và sơ đồ phân tích lực tự do (Free-Body Diagram).',
      createdAt: '2026-01-03T08:00:00.000Z',
      slides: [
        {
          page: 1,
          heading: 'Hợp lực gây ra gia tốc, không phải vận tốc!',
          heart_message: 'Lực không duy trì vận tốc; hợp lực làm THAY ĐỔI vận tốc (tạo gia tốc).',
          flip_card: {
            before: 'Tư duy bị động: Ngừng đẩy thì vật phải dừng ngay, cứ chuyển động là phải có lực đẩy.',
            after: 'Tư duy hệ thống: Vật chậm lại là do lực ma sát ngược chiều! Hợp lực F_hl = m·a quyết định sự biến đổi vận tốc.'
          },
          script: 'Trong đời sống, khi ngừng đạp xe ta thấy xe chậm dần rồi dừng lại nên trực giác dễ đánh lừa rằng cần có lực mới giữ được chuyển động. Nhưng hãy áp dụng tư duy Feynman để bóc tách bản chất: xe dừng lại vì mặt đường và không khí đang tác dụng lực cản ngược chiều chuyển động! Định luật II Newton khẳng định một mối liên hệ nhân quả sắc bén: vector gia tốc a cùng hướng với vector hợp lực F tác dụng lên vật, tỷ lệ thuận với độ lớn hợp lực và tỷ lệ nghịch với khối lượng quán tính m. Nắm chắc công thức vector F hợp lực bằng m nhân a chính là chìa khóa giải mọi bài toán cơ học.',
          quick_check: {
            question: 'Một vật khối lượng 2 kg chịu hợp lực không đổi 6 N theo phương ngang. Gia tốc của vật là:',
            options: ['12 m/s²', '3 m/s²', '0,33 m/s²', '4 m/s²'],
            correct_index: 1,
            explanation: 'Chính xác! Áp dụng a = F_hl / m = 6 / 2 = 3 m/s², cùng hướng với vector hợp lực.'
          },
          image_search_query: 'newton second law free body diagram physics',
          youtube_search_query: 'định luật 2 newton vật lý 10 bản chất',
          visual_prompt: 'Modern 16:9 academic physics infographic showing Free-Body Diagram of a block with normal force, gravity, applied force, friction, and resulting acceleration vector',
          fallback_svg: `<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="450" rx="20" fill="#F5F3FF"/>
  <text x="400" y="50" text-anchor="middle" font-family="sans-serif" font-size="23" font-weight="700" fill="#4C1D95">SƠ ĐỒ PHÂN TÍCH LỰC (FREE-BODY DIAGRAM)</text>
  <line x1="80" y1="315" x2="720" y2="315" stroke="#6D28D9" stroke-width="4"/>
  <rect x="325" y="215" width="150" height="100" rx="14" fill="#7C3AED" stroke="#4C1D95" stroke-width="3"/>
  <text x="400" y="274" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">m = 2 kg</text>
  <line x1="400" y1="215" x2="400" y2="115" stroke="#0EA5E9" stroke-width="5"/>
  <polygon points="400,100 390,122 410,122" fill="#0EA5E9"/>
  <text x="422" y="130" font-family="sans-serif" font-size="18" font-weight="700" fill="#0284C7">N (Phản lực)</text>
  <line x1="400" y1="315" x2="400" y2="395" stroke="#EF4444" stroke-width="5"/>
  <polygon points="400,410 390,388 410,388" fill="#EF4444"/>
  <text x="422" y="395" font-family="sans-serif" font-size="18" font-weight="700" fill="#DC2626">P (Trọng lực)</text>
  <line x1="475" y1="265" x2="640" y2="265" stroke="#10B981" stroke-width="6"/>
  <polygon points="658,265 634,254 634,276" fill="#10B981"/>
  <text x="565" y="248" text-anchor="middle" font-family="sans-serif" font-size="19" font-weight="700" fill="#059669">F kéo</text>
  <line x1="325" y1="265" x2="215" y2="265" stroke="#F59E0B" stroke-width="5"/>
  <polygon points="198,265 220,255 220,275" fill="#F59E0B"/>
  <text x="260" y="248" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#D97706">F ma sát</text>
  <rect x="545" y="95" width="205" height="62" rx="12" fill="#FFFFFF" stroke="#C4B5FD" stroke-width="2"/>
  <text x="647" y="133" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#5B21B6">a = F_hl / m</text>
</svg>`,
          media_type: 'svg',
          media_url: '',
          media_source: 'Sơ đồ minh họa AI (SVG)',
          media_title: 'Sơ đồ lực Định luật II Newton',
          media_candidates: { videos: [], images: [] }
        }
      ]
    }
  ];
})(window);
