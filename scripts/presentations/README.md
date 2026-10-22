# Bài trình chiếu báo cáo dự án ReadMate AI

Tạo `docs/presentations/ReadMateAI_BaoCaoDuAn.pptx` và lời thuyết trình `ReadMateAI_LoiThuyetTrinh.md` (21 slide, 16:9). Công cụ tách riêng khỏi phụ thuộc chính của ứng dụng (`package.json` riêng ở đây).

Tái tạo:

1. Chạy ứng dụng local: `npm run dev -- -p 3200` (ở thư mục gốc).
2. `node capture.mjs 3200`, `node capture-practice.mjs 3200`, `node capture-maze.mjs 3200`, `node capture-board.mjs 3200` — chụp bản chơi thử (dữ liệu minh họa hư cấu, không đăng nhập, không dữ liệu thật).
3. `capture-art.mjs` xuất nhân vật SVG (`src/components/art/characters.tsx`) thành PNG; cần một trang tạm `src/app/tmp-art/page.tsx` hiển thị `HeroKid`, `GuideOwl`, `FriendlyMonster` trong các `div` id `kid`, `owl`, `monster` (xóa trang này sau khi chụp, không commit).
4. `node capture-teacher.mjs 3200` chụp khu giáo viên bằng tài khoản GIẢ (cần Supabase local + `npm run db:seed`; mật khẩu đọc từ `.env.local`, không in ra).
5. `python prep-crops.py`, rồi `npm install`, `node build-deck.mjs` (PPTX, ghi chú diễn giả lấy từ `speech.mjs`) và `node build-speech.mjs` (tệp lời thuyết trình).

Nội dung bám tiến độ **hoàn thành R08.2**; mọi tính năng chưa xong (chạm trán trong Mê cung, âm thanh, học liệu đã duyệt, bảng xếp hạng cho học sinh) được gắn nhãn "Đang hoàn thiện" / "Dự kiến". Không có số liệu thành tích học tập.
