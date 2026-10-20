/**
 * Toàn bộ câu chữ giao diện tiếng Việt của ReadMate AI.
 *
 * Quy tắc:
 * - Mọi chuỗi ở dạng Unicode NFC (kiểm thử tests/unit/strings.test.ts).
 * - Không quảng cáo chức năng chưa xây dựng như thể đã hoạt động: dùng "dự kiến", "sắp có", "bản xem trước".
 * - Lời nói với học sinh: ngắn, ấm áp, xưng "con" (sẽ cấu hình theo lớp — PRD §12.3).
 * - Định hướng từ R01: học sinh tự luyện TẠI NHÀ; không còn thông điệp "làm phiếu ở lớp" (tests/unit/redesign-copy.test.tsx).
 * - Dữ liệu miền (tên dạng bài, lộ trình, game) nằm ở src/features/*, không nằm ở đây.
 * - Chuỗi có "{x}" là mẫu, thay bằng .replace() khi hiển thị.
 */
export const vi = {
  brand: {
    name: "ReadMate AI",
    slogan: "Học Tiếng Việt, khám phá thế giới kỳ diệu",
    tagline: "Tự luyện mỗi ngày – Tích điểm, mở khóa và phiêu lưu cùng tri thức",
    description:
      "ReadMate AI — nền tảng tự luyện Tiếng Việt lớp 1 tại nhà, kết hợp phiêu lưu, điểm thưởng và mở khóa thế giới kỳ diệu.",
    previewBadge: "Bản xem trước",
  },

  a11y: {
    skipToContent: "Bỏ qua, đến nội dung chính",
    mainNav: "Điều hướng chính",
    openMenu: "Mở menu điều hướng",
    closeMenu: "Đóng menu điều hướng",
    homeLink: "ReadMate AI — về trang chủ",
    loading: "Đang tải…",
    teacherNav: "Điều hướng khu vực giáo viên",
    studentNav: "Điều hướng khu vực học sinh",
    footerNav: "Liên kết cuối trang",
  },

  nav: {
    home: "Trang chủ",
    demo: "Chơi thử",
    teacher: "Giáo viên",
    learn: "Học sinh",
    join: "Liên kết thiết bị",
    ctaDemo: "Chơi thử",
  },

  status: {
    inDevelopment: "Chức năng đang phát triển",
    comingSoon: "Sắp có",
    comingSoonDev: "Sắp có – Đang phát triển",
    planned: "Dự kiến",
    demoData: "Dữ liệu minh họa",
    illustrative: "Minh họa",
    noData: "Chưa có dữ liệu",
    sketch: "Bản phác thảo – chờ giáo viên duyệt",
    preview: "Bản xem trước",
  },

  /** Chuỗi dùng chung của các thành phần giao diện phiêu lưu (src/components/adventure). */
  adventure: {
    previewRibbon: "Bản chơi thử – Dữ liệu minh họa",
    previewRibbonNote: "Tên, điểm và thành tích trên trang này là hư cấu: không lưu, không gửi đi đâu.",
    score: {
      label: "Điểm thưởng",
      unit: "điểm",
      total: "{n} điểm thưởng",
      nextMilestone: "Còn {n} điểm tới mốc khám phá tiếp theo",
      progressLabel: "Tiến độ tới mốc khám phá tiếp theo",
    },
    motion: {
      label: "Giảm chuyển động",
      on: "Đang bật",
      off: "Đang tắt",
      hint: "Tắt hoạt cảnh trên trang này (chỉ trong lần mở trang hiện tại).",
    },
    dialog: { close: "Đóng" },
    hearts: { label: "Quái vật còn {n}/{total} trái tim" },
    achievement: { earned: "Đã đạt", notYet: "Chưa đạt" },
    comingSoonTitle: "Sắp có – Đang phát triển",
  },

  /** Game World — bản đồ, mốc khám phá, thẻ trò chơi (R02: bản xem trước với dữ liệu minh họa). */
  gameWorld: {
    eyebrow: "Game World",
    title: "Bản đồ thế giới phiêu lưu",
    description:
      "Trả lời đúng để tích điểm. Mỗi {step} điểm tích lũy mở một mốc khám phá; đủ điểm thì mở lối vào trò chơi. Các trò chơi đang được xây dựng — đây là bản xem trước.",
    mapLabel: "Bản đồ thế giới: trạm luyện tập ở giữa, bốn vùng trò chơi xung quanh, vùng chưa đủ điểm còn phủ mây",
    station: "Trạm luyện tập",
    eligible: "Đủ điểm",
    locked: "Chưa đủ điểm",
    needMore: "Cần thêm {n} điểm",
    threshold: "Mở khi có {n} điểm",
    preview: "Bản xem trước",
    details: "Xem chi tiết",
    detailsFor: "Xem chi tiết: {name}",
    skillsTitle: "Con sẽ luyện",
    howTitle: "Cách chơi (dự kiến)",
    rulesTitle: "Luật chung",
    rules: [
      "Mỗi màn có tối đa 7 thử thách, mỗi thử thách 3 câu Tiếng Việt.",
      "Không đếm giờ; có thể tạm dừng bất cứ lúc nào.",
      "Vào chơi không tốn điểm.",
    ],
    monsterLine: "Các bạn quái vật thân thiện sẽ hỏi con những câu thật vui!",
    playSoon: "Vào chơi – Sắp có",
    playNote: "Trò chơi đang được xây dựng (dự kiến {phase}). Nút sẽ mở khi trò chơi sẵn sàng.",
    statusEligibleNote: "Con đã đủ điểm. Trò chơi sẽ mở khi xây dựng xong.",
    statusLockedNote: "Luyện thêm để có đủ điểm nhé.",
    milestones: {
      title: "Mốc khám phá bản đồ",
      description: "Mỗi {step} điểm tích lũy mở một mốc khám phá mới trên bản đồ.",
      reached: "Đã khám phá",
      next: "Mốc tiếp theo",
      locked: "Chưa khám phá",
      at: "{n} điểm",
      itemReached: "{name}, mốc {n} điểm, đã khám phá",
      itemLocked: "Mốc {n} điểm, chưa khám phá",
    },
  },

  home: {
    meta: {
      title: "Học Tiếng Việt, khám phá thế giới kỳ diệu",
      description:
        "ReadMate AI giúp học sinh lớp 1 tự luyện Tiếng Việt tại nhà mỗi ngày — chữ, âm, vần, đánh vần, đọc trơn — rồi tích điểm, mở khóa và phiêu lưu trong thế giới kỳ diệu.",
    },
    hero: {
      eyebrow: "Dành cho học sinh lớp 1 · Tự luyện Tiếng Việt tại nhà",
      description:
        "Mỗi ngày con luyện chữ, âm, vần, đánh vần và đọc trơn ngay tại nhà — có hình ảnh, gợi ý và lời khen. Trả lời đúng thì tích điểm, đủ điểm thì mở khóa bản đồ và những trò chơi phiêu lưu.",
      primaryCta: "Khám phá ReadMate",
      secondaryCta: "Chơi thử",
      statusNote:
        "Bản xem trước: sáu dạng bài luyện tập đã chơi thử được; điểm thưởng, bản đồ và trò chơi hiện dùng dữ liệu minh họa và sẽ hoàn thiện ở các giai đoạn sau.",
      artLabel:
        "Minh họa: bạn nhỏ thám hiểm vẫy tay chào cùng Cú Bông cầm đèn lồng, phía sau là đồi xanh và lâu đài trên đảo bay.",
      bubble: "Cùng đi phiêu lưu nào!",
    },
    steps: {
      eyebrow: "Cách hoạt động",
      title: "Ba bước của một ngày phiêu lưu",
      items: [
        {
          title: "Luyện Tiếng Việt tại nhà",
          text: "Buổi luyện ngắn 10–15 phút với sáu dạng bài, hình ảnh và gợi ý giảm dần khi con tiến bộ.",
        },
        {
          title: "Tích điểm khi trả lời",
          text: "Mỗi câu trả lời đúng được cộng điểm thưởng. Điểm thưởng là động lực, không phải điểm kiểm tra.",
        },
        {
          title: "Mở khóa thế giới phiêu lưu",
          text: "Đủ điểm thì khám phá thêm bản đồ và mở lối vào trò chơi — nơi câu hỏi vẫn là bài luyện Tiếng Việt.",
        },
      ],
      note: "Điểm thưởng và mở khóa thật: dự kiến ở giai đoạn R04. Bản xem trước dùng số liệu minh họa.",
    },
    paths: {
      eyebrow: "Ba lộ trình",
      title: "Mỗi con một lộ trình phù hợp",
      description:
        "Lộ trình linh hoạt, giáo viên điều chỉnh theo tiến bộ. Chỉ giáo viên và phụ huynh thấy tên lộ trình — học sinh chỉ thấy bản đồ phiêu lưu của mình.",
      focusLabel: "Trọng tâm",
    },
    games: {
      eyebrow: "Game World",
      title: "Bốn vùng đất đang chờ con",
      description:
        "Mỗi trò chơi là một chuyến phiêu lưu với câu hỏi Tiếng Việt. Các trò chơi đang được xây dựng; hình dưới đây là bản phác thảo.",
      threshold: "Mở khi có {n} điểm",
      status: "Đang phát triển",
      cta: "Xem bản đồ Game World",
    },
    teachers: {
      eyebrow: "Dành cho giáo viên",
      title: "Công cụ dự kiến cho giáo viên",
      description:
        "Các chức năng dưới đây đang được xây dựng theo từng giai đoạn và chưa hoạt động trong bản xem trước.",
      features: [
        {
          title: "Giao bài và duyệt nội dung",
          text: "Kiểm tra tự động chính tả, chữ đã học, âm thanh — giáo viên duyệt lần cuối trước khi đến tay học sinh.",
        },
        {
          title: "Theo dõi tiến bộ",
          text: "Kết quả theo âm – vần, lỗi thường gặp và mức hỗ trợ của từng em.",
        },
        {
          title: "Bảng xếp hạng trong lớp",
          text: "Chỉ trong lớp, mặc định tắt; chỉ hiện tên hiển thị đã duyệt khi phụ huynh đồng ý.",
        },
        {
          title: "Vinh danh TOP 3",
          text: "Màn vinh danh nhẹ nhàng để cô khen ngợi các bạn chăm luyện.",
        },
        {
          title: "Tổ chức mùa thi đua mới",
          text: "Kết thúc mùa, lưu vinh danh và bắt đầu mùa mới — dữ liệu học tập vẫn giữ nguyên.",
        },
      ],
      cta: "Xem khu vực giáo viên",
    },
    safety: {
      eyebrow: "An toàn dữ liệu",
      title: "Cam kết bảo vệ dữ liệu trẻ em",
      description: "ReadMate AI được thiết kế theo nguyên tắc bảo vệ dữ liệu ngay từ đầu:",
      items: [
        "Chỉ dùng biệt danh và avatar hoạt hình có sẵn — không cần họ tên đầy đủ, ngày sinh hay số điện thoại.",
        "Không ghi âm giọng nói, không dùng camera, không quảng cáo, không mua bán trong ứng dụng.",
        "Học sinh không trò chuyện trực tiếp với AI; mọi bài luyện do giáo viên duyệt.",
        "Bảng xếp hạng chỉ trong lớp, mặc định tắt và chỉ bật khi phụ huynh đồng ý.",
      ],
    },
    finalCta: {
      title: "Bắt đầu chuyến phiêu lưu đầu tiên",
      text: "Bản chơi thử có sáu dạng bài tương tác và bản xem trước Game World — không tài khoản, không lưu dữ liệu.",
      button: "Chơi thử ngay",
    },
  },

  demo: {
    meta: {
      title: "Bản chơi thử",
      description:
        "Chơi thử sáu dạng bài luyện Tiếng Việt lớp 1 và xem trước Game World của ReadMate AI với dữ liệu minh họa — không tài khoản, không lưu kết quả, không gửi dữ liệu.",
    },
    eyebrow: "Bản chơi thử",
    title: "Chơi thử bài luyện đọc lớp 1",
    intro:
      "Người lớn chọn lộ trình và dạng bài, rồi cùng con làm thử. Mỗi câu được bộ máy bài tập tạo từ kho tri thức Tiếng Việt và đã qua bộ kiểm tra: chỉ dùng chữ đã học, đáp án duy nhất, không lộ đáp án.",
    notice: {
      title: "Đây là bản chơi thử với dữ liệu minh họa",
      items: [
        "Lớp hư cấu, giả định đang học bài MH16 của chuỗi bài minh họa — không phải sách giáo khoa.",
        "Từ, câu, tranh và câu hỏi chưa được giáo viên duyệt; tranh là biểu tượng minh họa tạm thời.",
        "Không tài khoản, không lưu kết quả, không gọi AI, không gửi dữ liệu nào ra khỏi trình duyệt.",
        "Chưa có âm thanh: các nút loa đều ghi “Chưa có âm thanh”.",
      ],
    },
    practice: {
      sectionTitle: "Luyện thử",
      pathStep: "Bước 1 · Chọn lộ trình",
      pathDescription: "Người lớn chọn lộ trình phù hợp với con. Học sinh không thấy tên lộ trình hay tên nhóm.",
      chooseActivity: "Bước 2 · Chọn buổi luyện hoặc dạng bài",
      lessonNote: "Kiến thức đã học: đến bài MH{lesson} của chuỗi minh họa.",
      lessonNoteFoundation: "Kiến thức đã học: đến bài MH{lesson} (Khởi động dùng kiến thức đến bài trước đó).",
      changePath: "Đổi lộ trình",
      supportTitle: "Mức hỗ trợ khi làm thử",
      supportHint: "Mặc định theo lộ trình. Đổi mức để xem H3 → H0 khác nhau thế nào.",
      sessionTitle: "Buổi luyện mẫu",
      sessionDescription: "Ôn bài cũ → luyện tập → thử thách Tự làm (H0, không gợi ý).",
      startSession: "Bắt đầu buổi luyện",
      typesTitle: "Sáu dạng bài",
      recommended: "Phù hợp lộ trình",
      itemCount: "{n} câu",
      tryActivity: "Làm thử",
      status: {
        ready: "Chơi thử được",
        preview_only: "Chỉ xem giao diện — chưa có âm thanh",
        unavailable: "Chưa đủ ngữ liệu",
      },
      runnerHeading: "Bản chơi thử",
      reward: {
        title: "Điểm thưởng ở bản chính thức",
        text: "Ở bản chính thức (dự kiến R04), mỗi câu đúng được +{points} điểm thưởng. Bản chơi thử không tính và không lưu điểm — con số chỉ để minh họa.",
        backToWorld: "Về Game World",
      },
    },
    worldPreview: {
      eyebrow: "Xem trước",
      title: "Xem trước Game World",
      description:
        "Avatar, ô điểm, bốn vùng đất và bảng xếp hạng nhỏ dưới đây đều là dữ liệu hư cấu, chỉ để xem giao diện — không lưu, không gửi đi đâu.",
      playerTitle: "Nhà thám hiểm minh họa",
      mapsTitle: "Bốn vùng đất",
      openWorld: "Mở bản đồ Game World",
      leaderboardTitle: "Bảng xếp hạng minh họa",
      leaderboardNote:
        "Tên hư cấu, không phải học sinh thật. Bảng xếp hạng thật chỉ trong lớp, mặc định tắt và cần phụ huynh đồng ý (dự kiến R05).",
      leaderboardRow: "Hạng {rank}: {name}, {points} điểm",
      me: "Con",
    },
    about: {
      supportTitle: "Hỗ trợ giảm dần H3 → H0",
      supportDescription:
        "Mức hỗ trợ theo dõi riêng cho từng dạng bài và giảm dần khi em làm tốt — đến khi em tự làm được.",
      exercisesTitle: "Sáu dạng bài",
      exercisesDescription:
        "Mỗi dạng bài có một khuôn cố định: cùng biểu tượng, câu lệnh và bố cục ở buổi luyện và trong trò chơi (dự kiến).",
      playable: "Chơi thử được",
    },
    links: {
      learn: "Về Game World",
      home: "Về trang chủ",
    },
  },

  teacher: {
    meta: {
      title: "Khu vực giáo viên",
      description: "Khung giao diện bảng điều khiển dành cho giáo viên — chức năng đang phát triển.",
    },
    areaLabel: "Khu vực giáo viên",
    title: "Bảng điều khiển giáo viên",
    subtitle: "Khung giao diện — chưa có đăng nhập và chưa có dữ liệu thật.",
    notice: {
      title: "Chức năng đang phát triển",
      text: "Khu vực này sẽ chỉ dành cho giáo viên đã đăng nhập (dự kiến R03). Hiện trang chưa được bảo vệ bằng tài khoản, mọi số liệu đều trống và các nút thao tác chưa hoạt động.",
    },
    sidebar: {
      overview: "Tổng quan",
      classes: "Lớp học",
      students: "Học sinh",
      bank: "Ngân hàng bài tập",
      review: "Duyệt học liệu",
      scoreboard: "Bảng điểm",
      honors: "Vinh danh",
      seasons: "Mùa thi đua",
      settings: "Cài đặt",
      backHome: "Về trang chủ",
    },
    stats: [
      { label: "Học sinh đã liên kết" },
      { label: "Buổi luyện tuần này" },
      { label: "Câu đúng tuần này" },
      { label: "Cần hỗ trợ thêm" },
    ],
    classes: {
      title: "Quản lý lớp",
      description: "Tạo lớp, thêm học sinh bằng biệt danh, in thẻ học và ghi nhận đồng ý của phụ huynh.",
      emptyTitle: "Chưa có lớp học nào",
      emptyText: "Chức năng tạo lớp và quản lý học sinh sẽ có khi hoàn thiện đăng nhập giáo viên (dự kiến R03).",
      action: "Tạo lớp mới",
    },
    students: {
      title: "Học sinh và tiến bộ",
      description:
        "Biệt danh, số thứ tự, avatar có sẵn, thẻ học, đồng ý của phụ huynh — và theo dõi tiến bộ khi có dữ liệu.",
      chartLabel: "Vùng biểu đồ tiến bộ — chưa có dữ liệu",
      metrics: [
        "Tỉ lệ hoàn thành buổi luyện ở nhà theo tuần",
        "Bản đồ nhiệt học sinh × âm/vần",
        "Cặp lỗi hay nhầm (b–d, an–ang, hỏi–ngã…)",
        "Mức hỗ trợ H3 → H0 theo từng dạng bài",
      ],
    },
    bank: {
      title: "Ngân hàng bài tập",
      description:
        "Sáu dạng bài cơ bản sẽ được soạn, kiểm tra tự động và giáo viên duyệt tại đây trước khi giao cho học sinh.",
    },
    review: {
      title: "Duyệt học liệu",
      description:
        "Mọi câu hỏi, âm thanh và hình minh họa phải được giáo viên duyệt trước khi đến tay học sinh. Chức năng duyệt dự kiến ở R10.",
      galleryTitle: "Bản phác thảo nhân vật R02 — chờ cô góp ý",
      galleryText:
        "Nhân vật, quái vật và avatar dưới đây là bản thiết kế thử nghiệm, tự vẽ bằng mã SVG. Cô xem giúp mức độ phù hợp với trẻ 6–7 tuổi (không gây sợ, gần gũi). Chưa có hình nào được duyệt.",
      roles: {
        hero: "Nhân vật học sinh phiêu lưu",
        guide: "Nhân vật hướng dẫn",
        monster: "Quái vật thân thiện",
        avatar: "Avatar",
        treasure: "Biểu tượng kho báu",
      },
      names: {
        hero: "Bạn nhỏ thám hiểm",
        guide: "Cú Bông",
        monster: "Bé Mây Bông",
        treasure: "Rương kho báu",
      },
    },
    scoreboard: {
      title: "Bảng điểm",
      description:
        "Điểm thưởng của từng học sinh trong mùa — chỉ giáo viên xem đầy đủ. Điểm thưởng là động lực, không dùng để đánh giá học tập.",
      points: [
        "Đúng +10, sai −5 (không xuống dưới 0); mỗi câu chỉ tính điểm một lần mỗi mùa.",
        "Bảng xếp hạng cho học sinh: chỉ trong lớp, mặc định tắt, chỉ học sinh có đồng ý của phụ huynh.",
        "Không hiện nhóm năng lực, không dùng từ ngữ gây xấu hổ.",
      ],
    },
    honors: {
      title: "Vinh danh TOP 3",
      description:
        "Màn vinh danh TOP 3 → 2 → 1 để cô trình chiếu khen ngợi các bạn chăm luyện; có nút bỏ qua và giảm chuyển động.",
      art: "Minh họa bục vinh danh ba bậc",
    },
    seasons: {
      title: "Mùa thi đua",
      description:
        "Kết thúc một mùa: lưu ảnh chụp vinh danh rồi bắt đầu mùa mới với điểm thưởng về 0 — dữ liệu học tập giữ nguyên. Chỉ giáo viên chủ nhiệm, xác nhận hai bước.",
      resetNote:
        "Chưa có nút đặt lại điểm: thao tác này chỉ mở khi có đăng nhập và phân quyền kiểm tra ở máy chủ (dự kiến R06).",
    },
    settings: {
      title: "Cài đặt lớp",
      description:
        "Bật/tắt bảng xếp hạng (mặc định tắt) và vinh danh, cài đặt giảm chuyển động mặc định, cập nhật bài đã học của lớp.",
    },
  },

  learn: {
    meta: {
      title: "Thế giới của con",
      description:
        "Bản chơi thử trang học sinh: avatar, điểm thưởng, bản đồ Game World và mốc khám phá — dữ liệu minh họa, không lưu.",
    },
    greeting: "Chào {name}!",
    greetingSub: "Hôm nay mình cùng luyện Tiếng Việt và khám phá bản đồ nhé.",
    practiceCta: "Luyện bài",
    worldCta: "Khám phá Game World",
    avatarLabel: "Avatar của {name}",
    stats: {
      milestones: "Mốc đã khám phá",
      badges: "Huy hiệu",
      sessions: "Buổi luyện",
    },
    achievements: {
      title: "Thành tích của con",
      text: "Huy hiệu xuất hiện khi con hoàn thành những chặng phiêu lưu.",
    },
    characters: {
      title: "Bạn đồng hành",
      guideLine: "Cú Bông sẽ chỉ đường cho con trên bản đồ!",
    },
    parents: {
      title: "Góc phụ huynh",
      text: "Điểm thưởng là trò chơi khích lệ, không phải điểm đánh giá học tập. Bố mẹ ngồi cạnh khi cần, khuyến khích con tự làm, không làm thay.",
    },
    bottomNav: {
      map: "Bản đồ",
      practice: "Luyện bài",
      achievements: "Thành tích",
    },
    exit: "Trang chủ",
  },

  join: {
    meta: {
      title: "Liên kết thiết bị",
      description: "Chuẩn bị chức năng liên kết thiết bị học tập bằng thẻ học — sẽ hoàn thiện ở giai đoạn sau.",
    },
    eyebrow: "Dành cho phụ huynh",
    title: "Liên kết thiết bị học tập",
    intro:
      "Phụ huynh sẽ dùng thẻ học do giáo viên phát để liên kết điện thoại hoặc máy tính bảng với hồ sơ học tập của con — không cần email hay mật khẩu.",
    notice: {
      title: "Chức năng sẽ hoàn thiện ở giai đoạn sau",
      text: "Liên kết thiết bị đang được phát triển. Hiện trang này chưa nhận, chưa kiểm tra và chưa lưu bất kỳ mã nào.",
    },
    stepsTitle: "Cách liên kết (dự kiến)",
    steps: [
      { title: "Nhận thẻ học", text: "Giáo viên phát thẻ học có mã QR cho từng em." },
      { title: "Quét mã QR", text: "Dùng camera điện thoại quét mã trên thẻ để mở ReadMate AI." },
      {
        title: "Bắt đầu luyện tập",
        text: "Thiết bị được liên kết với hồ sơ của con, chỉ gồm biệt danh và ảnh đại diện.",
      },
    ],
    form: {
      legend: "Nhập mã dự phòng",
      label: "Mã dự phòng trên thẻ học",
      hint: "Mã gồm 8 ký tự, in bên dưới mã QR trên thẻ học.",
      submit: "Liên kết thiết bị",
      disabledNote: "Chưa hoạt động trong bản xem trước — ô nhập đang bị khóa.",
    },
    privacy: {
      title: "Dữ liệu của con được bảo vệ thế nào?",
      items: [
        "Chỉ dùng biệt danh và ảnh đại diện có sẵn; không hỏi họ tên đầy đủ, ngày sinh hay số điện thoại.",
        "Không ghi âm giọng nói và không dùng camera trong khu vực học tập.",
        "Chỉ lưu kết quả học tập sau khi phụ huynh đã đồng ý.",
        "Phụ huynh có thể đề nghị giáo viên xóa dữ liệu của con.",
      ],
    },
  },

  /**
   * Bộ chạy bài luyện (khu vực trẻ thao tác). Câu gợi ý và phản hồi được bộ kiểm tra chống lộ đáp án
   * soát cùng với từng câu bài tập — không được chứa đáp án.
   */
  practice: {
    badge: "Bản chơi thử",
    hints: {
      sayPictureSlowly: "Con nói thật chậm tên hình, nghe âm đầu tiên nhé.",
      lookAtShape: "Con nhìn kĩ nét cong, nét thẳng của chữ mẫu.",
      listenAgain: "Con nghe lại âm thật kĩ nhé.",
      lookAtParts: "Con xem lại từng phần: âm đầu, vần, dấu thanh.",
      spellStepByStep: "Con đánh vần từng bước: {steps}…",
      lookAtColors: "Phần tô màu giúp con thấy âm đầu và vần.",
      lookAtToneMark: "Con nhìn dấu ở trên hoặc ở dưới chữ.",
      spellingRule: "Nhớ nhé: {rule}.",
      sayPictureName: "Con nói tên hình, nghe từng phần của tiếng.",
      tryEachTone: "Con thử đọc tiếng với từng dấu thanh.",
      readSyllableBySyllable: "Con đọc từng tiếng một.",
      readSentenceSlowly: "Con đọc chậm từng tiếng trong câu.",
      findWordInSentence: "Con tìm trong câu từ trả lời cho câu hỏi.",
      startWithCapital: "Câu bắt đầu bằng chữ viết hoa.",
      endWithPeriod: "Dấu chấm đứng ở cuối câu.",
      removedOne: "Cô đã bớt đi một lựa chọn chưa đúng.",
    },
    feedback: {
      correctTitles: ["Đúng rồi!", "Con làm tốt lắm!", "Chính xác!"],
      correctMessage: "Con đã làm đúng câu này.",
      retryTitle: "Chưa đúng rồi",
      retry: {
        generic: "Con thử lại nhé!",
        shape: "Con nhìn kĩ hình dạng chữ rồi chọn lại nhé.",
        sound: "Con nói thật chậm rồi chọn lại nhé.",
        spelling: "Con xem lại cách viết rồi chọn lại nhé.",
        rime: "Con xem lại vần rồi chọn lại nhé.",
        tone: "Con xem lại dấu thanh rồi chọn lại nhé.",
        build: "Có phần ghép chưa đúng. Con xem lại nhé.",
        missed: "Con xem lại, còn tiếng đúng con chưa chọn đấy.",
        match: "Có cặp nối chưa đúng. Con xem lại nhé.",
        order: "Con đọc lại xem các từ đã đúng thứ tự chưa nhé.",
        reading: "Con đọc lại thật chậm rồi chọn nhé.",
      },
      revealTitle: "Mình cùng xem đáp án nhé",
      revealMessage: "Đáp án đúng là",
      classroomDone: "Con đã làm xong câu này.",
    },
    controls: {
      check: "Kiểm tra",
      retry: "Thử lại",
      next: "Câu tiếp",
      prev: "Câu trước",
      finish: "Xem kết quả",
      hint: "Gợi ý",
      help: "Trợ giúp",
      start: "Bắt đầu",
      restart: "Làm lại",
      clear: "Xóa hết",
      removeLast: "Bỏ từ cuối",
      progressLabel: "Tiến độ bài luyện",
      progress: "Câu {current} / {total}",
      goToItem: "Câu {n}",
      itemDone: "đã xong",
      itemCurrent: "đang làm",
      checking: "Đang chấm…",
    },
    audio: {
      unavailable: "Chưa có âm thanh",
      instruction: "Nghe câu lệnh",
      stimulus: "Nghe",
      model: "Nghe đọc mẫu",
      helpCounts: "Bấm Trợ giúp được tính là một lần dùng gợi ý.",
      note: "Âm thanh sẽ do giáo viên ghi âm hoặc được tạo và duyệt ở giai đoạn sau. Bản chơi thử không phát âm thanh.",
      requiredMissing:
        "Dạng bài này cần âm thanh mẫu của giáo viên — hiện chưa có nên chỉ xem được giao diện, chưa làm bài được.",
    },
    picture: {
      label: "Hình {n}",
      stimulus: "Hình minh họa",
      named: "Hình: {name}",
      sample: "Chữ mẫu",
      listen: "Âm cần nghe",
    },
    build: {
      onsets: "Âm đầu",
      rimes: "Vần",
      tones: "Dấu thanh",
      result: "Tiếng con ghép",
      empty: "Chạm thẻ để ghép",
    },
    match: {
      words: "Từ",
      pictures: "Hình",
      pickWord: "Chạm một từ, rồi chạm hình đúng.",
      pair: "Cặp {n}",
    },
    arrange: {
      answer: "Câu của con",
      empty: "Chạm các từ theo thứ tự",
      bank: "Các từ",
    },
    findUnit: { target: "Vần cần tìm" },
    groups: {
      letters: "Các chữ để chọn",
      units: "Các phương án để chọn",
      syllables: "Các tiếng để chọn",
      pictures: "Các hình để chọn",
      answers: "Các câu trả lời để chọn",
      parts: "Các phần của tiếng",
    },
    tone: { none: "không dấu" },
    example: {
      title: "Cô làm mẫu",
      note: "Câu ví dụ đã có đáp án — con xem cô làm trước nhé.",
    },
    runner: {
      supportLabel: "Mức hỗ trợ",
      exit: "Thoát bài",
      blockOf: "Phần {current}/{total}",
      previewOnlyTitle: "Chỉ xem giao diện",
      independentChallenge: "Thử thách tự làm",
      hintsLeft: "còn {n}",
      helpTitle: "Trợ giúp",
      helpText: "Câu lệnh: {text}",
      autoPlayNote: "Ở mức này sẽ tự phát khi có âm thanh.",
      countsAsHintNote: "Bấm nghe được tính là một lần dùng gợi ý.",
      levelNotes: {
        3: "Có câu ví dụ “Cô làm mẫu”; sau mỗi lần sai, gợi ý tự hiện; tối đa 3 lần trả lời mỗi câu.",
        2: "Bấm “Gợi ý” khi cần; tối đa 3 lần trả lời mỗi câu.",
        1: "Bấm “Gợi ý” hoặc “Trợ giúp” khi cần (đều được tính là dùng gợi ý); tối đa 2 lần trả lời mỗi câu.",
        0: "Tự làm: con tự đọc, tự suy nghĩ và hoàn thành bài — không có gợi ý, mỗi câu trả lời 1 lần.",
      },
      stimulusLabels: {
        none: "Nghe",
        phoneme: "Nghe âm",
        picture_name: "Nghe tên hình",
        syllable: "Nghe tiếng",
        word: "Nghe từ",
        sentence: "Nghe câu",
      },
    },
    results: {
      title: "Con đã hoàn thành buổi luyện!",
      subtitle: "Mỗi câu làm xong là một ngôi sao.",
      starsLabel: "{n} ngôi sao",
      adultTitle: "Kết quả buổi luyện (dành cho người lớn)",
      privacy: "Kết quả chỉ nằm trong trang đang mở: không lưu, không gửi đi đâu, tải lại trang là mất.",
      rows: {
        completed: "Số câu đã làm xong",
        correct: "Số câu làm đúng",
        independent: "Đúng ngay lần đầu, không cần gợi ý",
        revealed: "Số câu phải xem đáp án",
        retries: "Số lượt thử lại",
        hints: "Số lần dùng gợi ý",
        help: "Số lần bấm Trợ giúp",
        support: "Mức hỗ trợ đã dùng",
        completion: "Tỉ lệ hoàn thành",
        duration: "Thời gian làm bài (ước lượng)",
      },
      researchTitle: "Chỉ số phục vụ nghiên cứu",
      sourceApp: "Đo trong ứng dụng",
      notMeasured: "Chưa có — ứng dụng không tự suy ra",
      restart: "Làm lại",
      back: "Chọn bài khác",
      minutes: "{m} phút {s} giây",
      seconds: "{s} giây",
      unknownDuration: "Không ghi nhận được",
    },
    /**
     * NGỪNG DÙNG (AD-51): chỉ dùng bởi src/features/exercises/ui/worksheet-preview.tsx — không còn hiển thị trong
     * luồng chính từ R02; xóa cùng mã phiếu ở R11. tests/unit/redesign-copy.test.tsx bỏ qua nhánh này.
     */
    worksheet: {
      title: "Phiếu ở lớp tương đương (xem trước)",
      note: "Bản xem trước dạng trang web, chưa phải tệp PDF (dự kiến GĐ8). Cùng dạng bài, cùng biểu tượng và câu lệnh, khác nội dung — để GV xem học sinh có tự làm được không.",
      name: "Tên:",
      answerKey: "Đáp án cho giáo viên",
      equivalence: "Đối chiếu với bài ở nhà",
      sameObjective: "Cùng mục tiêu học tập",
      focus: "Đơn vị trọng tâm",
      skillLevel: "mục tiêu kỹ năng chung",
      difficulty: "Độ khó ước lượng (ở nhà / ở lớp)",
      twins: "Số cặp bài sinh đôi",
      noShared: "Không trùng câu nào với bài ở nhà",
      unavailable: "Chưa tạo được phiếu ở lớp",
      yes: "Có",
      no: "Không",
    },
  },

  footer: {
    tagline: "Tự luyện Tiếng Việt lớp 1 tại nhà – phiêu lưu cùng tri thức.",
    previewNote: "Bản xem trước · Chưa thu thập dữ liệu học sinh",
    linksTitle: "Khám phá",
  },

  notFound: {
    title: "Không tìm thấy trang",
    text: "Trang này không có ở đây. Mình cùng quay về trang chủ nhé.",
    action: "Về trang chủ",
  },

  error: {
    title: "Đã có lỗi xảy ra",
    text: "Xin lỗi, trang đang gặp sự cố. Hãy thử tải lại.",
    action: "Thử lại",
  },
} as const;
