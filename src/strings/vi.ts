/**
 * Toàn bộ câu chữ giao diện tiếng Việt của ReadMate AI.
 *
 * Quy tắc:
 * - Mọi chuỗi ở dạng Unicode NFC (kiểm thử tests/unit/strings.test.ts).
 * - Không quảng cáo chức năng chưa xây dựng như thể đã hoạt động: dùng "dự kiến", "sắp có".
 * - Lời nói với học sinh: ngắn, ấm áp, xưng "con" (sẽ cấu hình theo lớp — PRD §12.3).
 * - Dữ liệu miền (tên dạng bài, lộ trình) nằm ở src/features/*, không nằm ở đây.
 */
export const vi = {
  brand: {
    name: "ReadMate AI",
    slogan: "Mỗi em một nhịp đọc – Mỗi ngày một tiến bộ",
    description: "Nền tảng hỗ trợ học sinh lớp 1 luyện đọc Tiếng Việt: học có hướng dẫn ở nhà, tự thực hiện ở lớp.",
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
    demo: "Bản demo",
    teacher: "Giáo viên",
    learn: "Học sinh",
    join: "Liên kết thiết bị",
    ctaDemo: "Xem bản demo",
  },

  status: {
    inDevelopment: "Chức năng đang phát triển",
    comingSoon: "Sắp có",
    planned: "Dự kiến",
    demoData: "Dữ liệu minh họa",
    noData: "Chưa có dữ liệu",
  },

  home: {
    meta: {
      title: "Mỗi em một nhịp đọc",
      description:
        "ReadMate AI giúp học sinh lớp 1 luyện chữ, âm, vần, đánh vần và đọc trơn tại nhà để tự tin tự làm bài ở lớp.",
    },
    hero: {
      eyebrow: "Dành cho học sinh lớp 1 · Tiếng Việt",
      description:
        "ReadMate AI giúp các em lớp 1 luyện chữ, âm, vần, đánh vần và đọc trơn ngay tại nhà — có lời hướng dẫn, hình ảnh và gợi ý từng bước — để vào lớp tự tin tự làm bài.",
      primaryCta: "Xem bản demo giao diện",
      secondaryCta: "Khu vực giáo viên",
      statusNote:
        "Bản xem trước đang phát triển: bài tập tương tác, tài khoản và lưu kết quả sẽ có ở các giai đoạn sau.",
      artLabel: "Minh họa ghép tiếng: âm b, vần a và dấu huyền ghép thành tiếng bà.",
      artToneLabel: "dấu huyền",
      artSpelling: "bờ – a – ba – huyền – bà",
    },
    mission: {
      eyebrow: "Mục tiêu",
      title: "Học có hướng dẫn ở nhà, tự thực hiện ở lớp",
      description:
        "Ở nhà, các em làm quen từng dạng bài với lời đọc yêu cầu, hình ảnh và gợi ý. Mức hỗ trợ giảm dần khi em tiến bộ. Ở lớp, các em tự làm những bài tương tự trên phiếu học tập — giáo viên bớt phải hướng dẫn riêng từng em.",
      points: [
        {
          title: "Phù hợp nhịp độ từng em",
          text: "Ba lộ trình linh hoạt; giáo viên điều chỉnh theo tiến bộ, không gắn nhãn học sinh.",
        },
        {
          title: "Âm thanh không làm lộ đáp án",
          text: "Lời đọc chỉ hướng dẫn việc cần làm; bài kiểm tra kỹ năng đọc không đọc sẵn đáp án.",
        },
        {
          title: "Giáo viên duyệt mọi nội dung",
          text: "Bài tập chỉ đến tay học sinh sau khi giáo viên kiểm tra và duyệt.",
        },
        {
          title: "An toàn cho trẻ",
          text: "Không quảng cáo, không trò chuyện với AI, chỉ dùng biệt danh, không ghi âm giọng nói của trẻ.",
        },
      ],
    },
    paths: {
      eyebrow: "Ba hướng hỗ trợ học tập",
      title: "Mỗi em một lộ trình phù hợp",
      description:
        "Nhóm học tập linh hoạt: em có thể chuyển lộ trình khi tiến bộ. Học sinh không nhìn thấy tên nhóm hay tên lộ trình.",
      focusLabel: "Trọng tâm",
    },
    process: {
      eyebrow: "Quy trình",
      title: "Luyện ở nhà → Vận dụng ở lớp",
      atHome: "Ở nhà",
      atSchool: "Ở lớp",
      steps: [
        {
          title: "Nghe hướng dẫn",
          text: "Lời đọc yêu cầu và phần làm mẫu giúp em hiểu cách làm từng dạng bài.",
        },
        {
          title: "Luyện tập có gợi ý",
          text: "Gợi ý bằng hình ảnh theo từng bậc; hỗ trợ giảm dần khi em làm đúng.",
        },
        {
          title: "Thử như ở lớp",
          text: "Làm bài với giao diện giống phiếu, không gợi ý, để biết em đã sẵn sàng.",
        },
        {
          title: "Tự làm ở lớp",
          text: "Em tự làm phiếu tương đương — cùng dạng bài, khác nội dung.",
        },
      ],
    },
    teachers: {
      eyebrow: "Dành cho giáo viên",
      title: "Công cụ dự kiến cho giáo viên",
      description:
        "Các chức năng dưới đây đang được xây dựng theo từng giai đoạn và chưa hoạt động trong bản xem trước.",
      features: [
        { title: "Giao bài theo nhóm", text: "Ba biến thể cho ba lộ trình trong một lần giao bài." },
        {
          title: "Kiểm duyệt nội dung",
          text: "Kiểm tra tự động chính tả, chữ đã học, âm thanh — giáo viên duyệt lần cuối.",
        },
        {
          title: "Phiếu học tập tương đương",
          text: "In phiếu A4 cùng dạng bài, khác nội dung để học sinh tự làm ở lớp.",
        },
        {
          title: "Theo dõi tiến bộ",
          text: "Kết quả, dạng lỗi thường gặp và mức độ tự làm bài của từng em.",
        },
      ],
      cta: "Xem khung giao diện giáo viên",
    },
    safety: {
      eyebrow: "An toàn dữ liệu",
      title: "Cam kết bảo vệ dữ liệu trẻ em",
      description: "ReadMate AI được thiết kế theo nguyên tắc bảo vệ dữ liệu ngay từ đầu:",
      items: [
        "Chỉ dùng biệt danh và ảnh đại diện có sẵn — không cần họ tên đầy đủ, ngày sinh hay số điện thoại.",
        "Không ghi âm giọng nói, không dùng camera, không quảng cáo.",
        "Học sinh không trò chuyện trực tiếp với AI; mọi bài tập do giáo viên duyệt.",
        "Chỉ lưu kết quả học tập khi phụ huynh đã đồng ý; kết quả không công khai.",
      ],
    },
    finalCta: {
      title: "Xem thử giao diện luyện tập",
      text: "Bản demo dùng dữ liệu minh họa để giới thiệu ba lộ trình và sáu dạng bài dự kiến.",
      button: "Mở bản demo",
    },
  },

  demo: {
    meta: {
      title: "Bản chơi thử",
      description:
        "Chơi thử sáu dạng bài luyện đọc lớp 1 của ReadMate AI với dữ liệu minh họa — không tài khoản, không lưu kết quả, không gửi dữ liệu.",
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
      sessionDescription: "Ôn bài cũ → luyện tập → thử như ở lớp (H0, không gợi ý).",
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
    },
    about: {
      supportTitle: "Hỗ trợ giảm dần H3 → H0",
      supportDescription:
        "Mức hỗ trợ theo dõi riêng cho từng dạng bài và giảm dần khi em làm tốt — đến khi em tự làm được như ở lớp.",
      exercisesTitle: "Sáu dạng bài",
      exercisesDescription:
        "Mỗi dạng bài có bản luyện trên ứng dụng và bản phiếu giấy tương đương, dùng cùng biểu tượng và câu lệnh.",
      paperLabel: "Phiếu tương đương",
      playable: "Chơi thử được",
    },
    links: {
      learn: "Xem khung góc học tập",
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
      text: "Khu vực này sẽ chỉ dành cho giáo viên đã đăng nhập (dự kiến Giai đoạn 5). Hiện trang chưa được bảo vệ bằng tài khoản, mọi số liệu đều trống và các nút thao tác chưa hoạt động.",
    },
    sidebar: {
      overview: "Tổng quan",
      classes: "Lớp học",
      bank: "Ngân hàng bài tập",
      progress: "Tiến bộ học sinh",
      worksheets: "Phiếu học tập",
      observations: "Ghi nhận tại lớp",
      backHome: "Về trang chủ",
    },
    stats: [
      { label: "Học sinh đã liên kết" },
      { label: "Bài đã giao tuần này" },
      { label: "Hoàn thành tuần này" },
      { label: "Cần hỗ trợ thêm" },
    ],
    classes: {
      title: "Quản lý lớp",
      description: "Tạo lớp, thêm học sinh bằng biệt danh, in thẻ học và ghi nhận đồng ý của phụ huynh.",
      emptyTitle: "Chưa có lớp học nào",
      emptyText: "Chức năng tạo lớp và quản lý học sinh sẽ có khi hoàn thiện đăng nhập giáo viên.",
      action: "Tạo lớp mới",
    },
    bank: {
      title: "Ngân hàng bài tập",
      description:
        "Sáu dạng bài cơ bản sẽ được soạn, kiểm tra tự động và giáo viên duyệt tại đây trước khi giao cho học sinh.",
    },
    progress: {
      title: "Theo dõi tiến bộ",
      description:
        "Kết quả theo âm – vần, dạng lỗi thường gặp và mức độ tự làm bài tại lớp sẽ hiển thị khi có dữ liệu.",
      chartLabel: "Vùng biểu đồ tiến bộ — chưa có dữ liệu",
      metrics: [
        "Tỉ lệ hoàn thành bài ở nhà theo tuần",
        "Bản đồ nhiệt học sinh × âm/vần",
        "Cặp lỗi hay nhầm (b–d, an–ang, hỏi–ngã…)",
        "Mức hỗ trợ và mức tự lực tại lớp",
      ],
    },
  },

  learn: {
    meta: {
      title: "Góc học tập",
      description: "Khung giao diện góc học tập của học sinh — bản xem trước, chưa lưu thông tin học tập.",
    },
    greeting: "Chào con!",
    greetingSub: "Hôm nay mình cùng luyện đọc nhé.",
    previewNote: "Bản xem trước: chưa có bài tập thật và chưa lưu thông tin học tập.",
    tasks: {
      title: "Nhiệm vụ hôm nay",
      items: [
        { title: "Ôn chữ và âm", hint: "Nhìn hình, chọn chữ" },
        { title: "Ghép tiếng", hint: "Ghép âm với vần" },
        { title: "Đọc từ", hint: "Đọc rồi chọn hình" },
      ],
      start: "Bắt đầu",
      startNote: "Bài luyện sẽ sớm có ở đây.",
    },
    exercise: {
      title: "Khu vực bài tập",
      emptyTitle: "Chưa có bài tập",
      emptyText: "Khi cô giao bài, bài tập sẽ xuất hiện ở đây.",
    },
    achievements: {
      title: "Thành tích của con",
      text: "Hình dán sẽ xuất hiện khi con hoàn thành bài luyện.",
      stickerSlot: "Ô hình dán còn trống",
      starsLabel: "Số sao hôm nay",
    },
    parents: {
      title: "Góc phụ huynh",
      text: "ReadMate AI sẽ gợi ý cách đồng hành cùng con: ngồi cạnh khi cần, khuyến khích con tự làm, không làm thay.",
    },
    bottomNav: {
      tasks: "Nhiệm vụ",
      exercise: "Bài tập",
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
      paperLike: "Giống phiếu ở lớp",
      classroomLike: "Thử như ở lớp",
      hintsLeft: "còn {n}",
      helpTitle: "Trợ giúp",
      helpText: "Câu lệnh: {text}",
      autoPlayNote: "Ở mức này sẽ tự phát khi có âm thanh.",
      countsAsHintNote: "Bấm nghe được tính là một lần dùng gợi ý.",
      levelNotes: {
        3: "Có câu ví dụ “Cô làm mẫu”; sau mỗi lần sai, gợi ý tự hiện; tối đa 3 lần trả lời mỗi câu.",
        2: "Bấm “Gợi ý” khi cần; tối đa 3 lần trả lời mỗi câu.",
        1: "Bố cục gần giống phiếu; bấm “Gợi ý” hoặc “Trợ giúp” khi cần (đều được tính là dùng gợi ý); tối đa 2 lần trả lời.",
        0: "Thử như ở lớp: không có gợi ý, mỗi câu trả lời 1 lần.",
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
      sourceClass: "Cần GV ghi nhận ở lớp",
      notMeasured: "Chưa có — ứng dụng không tự suy ra",
      restart: "Làm lại",
      back: "Chọn bài khác",
      minutes: "{m} phút {s} giây",
      seconds: "{s} giây",
      unknownDuration: "Không ghi nhận được",
    },
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
    tagline: "Dự án hỗ trợ học sinh lớp 1 luyện đọc Tiếng Việt.",
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
