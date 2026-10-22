// Lời thuyết trình cho từng slide — dùng chung cho ghi chú diễn giả trong PPTX và tệp ReadMateAI_LoiThuyetTrinh.md.
// Mục tiêu khoảng 10–12 phút (≈ 1.500 từ). Mỗi mục: tiêu đề slide và lời dẫn (thời lượng tính theo số từ).
export const SPEECH = [
  {
    title: "Trang bìa",
    text: "Kính chào quý thầy cô và hội đồng. Em xin giới thiệu ReadMate AI: một nền tảng giúp học sinh lớp 1 tự luyện Tiếng Việt tại nhà, theo cách giống một hành trình khám phá hơn là một bài tập. Toàn bộ hình ảnh trong bài là ảnh chụp từ bản chơi thử của dự án, với dữ liệu minh họa hư cấu.",
  },
  {
    title: "Vì sao có ReadMate AI?",
    text: "Ở lớp 1, các em cần luyện chữ, vần và đọc trơn thật đều đặn. Nhưng luyện ở nhà thường gặp ba vấn đề: bài tập đơn điệu khiến trẻ mau chán, phụ huynh không phải lúc nào cũng biết cách đồng hành, và giáo viên khó nắm các em đang luyện ra sao. Chúng em không nhìn đây là lỗi của học sinh, mà là nhu cầu cần được hỗ trợ tốt hơn.",
  },
  {
    title: "ReadMate AI mang lại điều gì?",
    text: "Từ đó, chúng em đặt ra ba giá trị. Thứ nhất, học dễ hiểu: mỗi màn hình chỉ một nhiệm vụ, nút bấm lớn. Thứ hai, luyện tập thú vị: có điểm thưởng và trò chơi phiêu lưu. Thứ ba, tiến bộ từng ngày: các em nhìn thấy hành trình của mình trên bản đồ, chứ không chỉ thấy con số.",
  },
  {
    title: "Ai sử dụng ReadMate AI?",
    text: "Có ba nhóm cùng tham gia. Học sinh lớp 1 luyện tập tại nhà. Giáo viên quản lý lớp, chuẩn bị và duyệt học liệu. Phụ huynh đồng hành cùng con. Xin lưu ý: phần góc dành riêng cho phụ huynh vẫn nằm trong kế hoạch phát triển, chưa có trong bản hiện tại.",
  },
  {
    title: "Hành trình một ngày luyện tập",
    text: "Đây là slide quan trọng nhất. Một lần luyện tập đi theo bảy bước: mở thẻ học, vào đúng trang của con, làm bài, nhận phản hồi, tích điểm, khám phá bản đồ, và cuối cùng là chơi Mê cung kho báu. Sáu bước đầu đã có bản chạy thử. Bước bảy, Mê cung, hiện là bản chơi thử: các em đi được trong mê cung, còn phần câu hỏi trong game đang được hoàn thiện. Các slide sau sẽ đi vào từng bước.",
  },
  {
    title: "Bước 1: Bắt đầu",
    text: "Học sinh không phải tự tạo tài khoản. Giáo viên cấp cho mỗi em một thẻ học có mã QR, phụ huynh quét thẻ trên điện thoại hoặc máy tính bảng của gia đình, và thiết bị đó được liên kết với đúng hồ sơ của con. Từ đó, con thấy tên, ảnh đại diện và điểm của riêng mình, rồi chạm vào Luyện bài hoặc Khám phá thế giới. Ảnh chụp ở đây là trang minh họa với tên hư cấu.",
  },
  {
    title: "Bước 2: Chọn bài luyện",
    text: "Có sáu dạng bài: nhận biết chữ, ghép âm và vần, nhận biết tiếng, điền chữ còn thiếu, kết hợp từ với tranh, và luyện đọc từ, câu. Mỗi dạng luôn có cùng biểu tượng và cách trình bày, nên các em quen dần. Các ví dụ trên slide chỉ là minh họa. Học liệu thật phải được giáo viên duyệt trước khi đến tay học sinh, và hiện chưa có mục nào được duyệt.",
  },
  {
    title: "Hỗ trợ giảm dần, từng bước tự lập",
    text: "Đây là điểm sư phạm chúng em muốn nhấn mạnh. Mỗi dạng bài có bốn mức hỗ trợ. Ở mức đầu, em được hướng dẫn đầy đủ và gợi ý ngay sau khi sai. Dần dần, gợi ý chỉ hiện khi em cần, rồi cuối cùng là Tự làm, không còn gợi ý. Hệ thống chỉ dùng chữ, âm, vần mà lớp đã học, và không để hình ảnh hay lời đọc làm lộ đáp án. Hiện mức hỗ trợ do người lớn chọn; việc tự động tăng giảm mức vẫn là hướng phát triển.",
  },
  {
    title: "Bước 3: Làm bài",
    text: "Đây là màn hình thật trên điện thoại. Con đọc câu hỏi, chạm vào đáp án, bấm Kiểm tra, rồi xem kết quả và sang câu tiếp theo. Các thẻ rất lớn, chỉ cần chạm, không cần kéo thả. Lưu ý các nút loa đang ghi Chưa có âm thanh: âm thanh đọc Tiếng Việt là phần đang chờ triển khai.",
  },
  {
    title: "Khi học sinh trả lời chưa đúng",
    text: "Khi con chọn chưa đúng, màn hình nhẹ nhàng nói: chưa đúng rồi, con xem lại rồi chọn lại nhé. Con có thể bấm Gợi ý, hoặc thử lại. Không có âm thanh chê trách, không đếm ngược thời gian. Chúng em tin rằng sai cũng là một cơ hội để học.",
  },
  {
    title: "Điểm thưởng tạo hứng thú",
    text: "Trả lời đúng được cộng mười điểm; trả lời sai trừ năm điểm, và điểm không bao giờ xuống dưới không. Con số được hiển thị trung tính, không kèm âm thanh hay màu cảnh báo. Xin nhấn mạnh: đây là điểm khuyến khích, không phải điểm kiểm tra, và không dùng để đánh giá năng lực học sinh. Cứ ba mươi điểm tích lũy thì mở thêm một mốc trên bản đồ.",
  },
  {
    title: "Bản đồ thế giới kỳ diệu",
    text: "Điểm thưởng mở dần bản đồ. Có bốn khu vực: Mê cung kho báu, Rừng chữ kỳ diệu, Đảo dấu thanh và Lâu đài ghép vần. Mỗi khu cần đủ điểm mới mở lối vào. Hiện chỉ Mê cung đang được xây dựng; ba khu còn lại ghi Sắp ra mắt và sẽ phát triển sau khi nộp dự án.",
  },
  {
    title: "Mê cung kho báu",
    text: "Đây là ảnh chụp bản chơi thử Mê cung kho báu. Bạn nhỏ thám hiểm đi từng ô, tìm đường, gặp các điểm thử thách và hướng tới rương kho báu. Có ba màn với độ khó tăng dần. Ở bản thử nghiệm này chưa có câu hỏi và chưa tính điểm; mục đích là để các em làm quen cách đi.",
  },
  {
    title: "Điều khiển Mê cung",
    text: "Điều khiển rất đơn giản. Trên điện thoại, con chạm bốn nút mũi tên; giữ nút để đi tiếp. Trên máy tính, dùng phím mũi tên hoặc W A S D. Có nút Tạm dừng và Chơi tiếp. Khi con học bằng thẻ học của mình, vị trí trong mê cung được tự động lưu để lần sau tiếp tục hành trình.",
  },
  {
    title: "Quái vật và thử thách Tiếng Việt",
    text: "Phần này em xin nói rõ là ý tưởng đang hoàn thiện. Mỗi màn dự kiến có bảy bạn quái vật thân thiện, mỗi bạn gắn với ba câu hỏi Tiếng Việt, tức hai mươi mốt câu một màn. Trả lời để vượt qua thử thách rồi mở kho báu. Hiện hệ thống đã chuẩn bị được bảy cuộc gặp và hai mươi mốt câu cho mỗi lượt chơi; còn phần tương tác, chấm điểm trong game thì chưa xong.",
  },
  {
    title: "Giáo viên đồng hành ra sao?",
    text: "Đây là ảnh chụp khu vực giáo viên, chạy trên máy phát triển với tên giả. Giáo viên quản lý lớp, thêm học sinh bằng biệt danh, cấp thẻ học và ghi nhận sự đồng ý của phụ huynh. Bảng điểm lớp đã có nhưng mặc định tắt, chỉ bật khi nhà trường chấp thuận. Duyệt học liệu, vinh danh và mùa thi đua còn đang hoàn thiện hoặc dự kiến, và chúng em nói rõ như vậy trên slide.",
  },
  {
    title: "Phụ huynh đồng hành ra sao?",
    text: "Phụ huynh là người giúp con vào đúng trang học bằng thẻ học, khuyến khích con luyện vừa sức mỗi ngày và quan tâm đến sự tiến bộ thay vì chỉ nhìn điểm. Góc phụ huynh với thông tin chi tiết là phần dự kiến, chưa có trong bản hiện tại.",
  },
  {
    title: "An toàn và phù hợp với học sinh nhỏ tuổi",
    text: "Vì người dùng là trẻ sáu, bảy tuổi nên an toàn được đặt lên trước. Giao diện thân thiện, phản hồi tích cực. Chỉ dùng biệt danh, không thu thập họ tên, ảnh thật hay giọng nói. Không quảng cáo, không đường dẫn ra ngoài, không ô gõ tự do, và học sinh không trò chuyện trực tiếp với trí tuệ nhân tạo. Dữ liệu học tập chỉ được ghi khi có sự đồng ý của phụ huynh.",
  },
  {
    title: "Những gì dự án đã thực hiện",
    text: "Tóm lại, dự án đã có: hệ thống bài luyện sáu dạng, giao diện cho học sinh và giáo viên, điểm thưởng chấm trên máy chủ, bản đồ khám phá, bản chơi thử Mê cung có điều khiển, tạm dừng và lưu tiến độ, cùng nền tảng bảy cuộc gặp và hai mươi mốt câu hỏi mỗi màn. Tất cả được kiểm thử tự động. Cũng xin nói thẳng những gì chưa có: chạm trán học tập hoàn chỉnh, âm thanh, học liệu đã được duyệt, và việc bật bảng xếp hạng cho học sinh. Hiện sản phẩm mới chạy thử trên máy phát triển, chưa triển khai chính thức và chưa thí điểm với học sinh.",
  },
  {
    title: "Hướng phát triển tiếp theo",
    text: "Bước tiếp theo là hoàn thiện Mê cung: kích hoạt các cuộc gặp, chấm điểm và mở kho báu. Sau đó bổ sung âm thanh, giao diện duyệt học liệu và góc phụ huynh. Rồi kiểm thử tổng thể về an toàn, giao diện, thiết bị, và đưa vào sử dụng từng bước theo kế hoạch. Ba trò chơi còn lại sẽ phát triển sau khi nộp dự án.",
  },
  {
    title: "Kết luận",
    text: "ReadMate AI mong muốn để mỗi ngày luyện đọc là một hành trình thú vị với các em lớp 1, và là công cụ đồng hành đáng tin cậy với thầy cô và phụ huynh. Em xin trân trọng cảm ơn quý thầy cô và hội đồng đã lắng nghe. Em rất mong nhận được góp ý.",
  },
];
