# Phiếu rà soát kho tri thức Tiếng Việt — dành cho giáo viên

> **Dùng cho:** giáo viên chủ nhiệm lớp 1A2 (và tổ chuyên môn nếu nhà trường muốn).
> **Phiên bản dữ liệu:** 0.1.0 (2026-10-14) · **Trạng thái:** toàn bộ nội dung **đang chờ cô duyệt** — chưa nội dung nào được dùng cho học sinh.
> **Tài liệu kỹ thuật kèm theo:** [VIETNAMESE_ENGINE.md](VIETNAMESE_ENGINE.md)

ReadMate AI dùng một “kho tri thức” để biết chữ, âm, vần nào lớp đã học và chọn tiếng, từ, câu phù hợp cho từng nhóm. Kho tri thức này do nhóm dự án soạn với sự hỗ trợ của trợ lý AI, nên **mọi cách gọi, quy ước và ngữ liệu dưới đây chỉ là đề xuất**. Hệ thống sẽ không dùng nội dung nào để giao bài cho học sinh khi cô chưa duyệt.

**Cách dùng phiếu:** đánh dấu `[x]` vào mục cô đồng ý; với mục cần sửa, ghi cách đúng của lớp vào cột “Ý kiến của cô”. Không cần ghi tên học sinh hay bất kỳ thông tin cá nhân nào vào phiếu.

---

## A. Bộ sách và tiến độ của lớp (quan trọng nhất)

Hiện hệ thống **chưa biết** lớp dùng bộ sách nào và đang học đến bài nào, nên mọi kiểm tra theo lớp 1A2 đều trả lời “chưa xác định”.

| # | Câu hỏi | Ý kiến của cô |
|---|---|---|
| A1 | Lớp 1A2 dùng bộ sách Tiếng Việt 1 nào (tên bộ sách, nhà xuất bản)? | |
| A2 | Tuần này lớp đang học đến bài nào (số bài / tên bài)? | |
| A3 | Có âm, vần nào lớp đã học thêm ngoài sách, hoặc trong sách nhưng lớp chưa học? | |
| A4 | Nhóm 3 (cần hỗ trợ nền tảng) nên dùng kiến thức đến **bài trước** như hệ thống đang đặt mặc định — đúng không? | `[ ]` Đúng · `[ ]` Khác: |
| A5 | Nhóm 1 (đọc tốt) có được dùng âm/vần của bài sắp học không? Những âm/vần nào? | |
| A6 | Những âm/vần nào cô muốn các em ôn thêm trong tuần? | |

> Lưu ý: chuỗi 17 bài hiện có trong hệ thống là **chuỗi minh họa** do nhóm dự án tự đặt để thử nghiệm, **không phải** thứ tự của bộ sách nào. Hệ thống chỉ lưu thứ tự bài và tên âm/vần của bộ sách, không sao chép bài đọc hay hình ảnh.

## B. Quy ước dạy đọc của lớp

| # | Vấn đề | Đề xuất tạm của hệ thống | Cô chọn |
|---|---|---|---|
| B1 | “qu” là **một âm** khi đánh vần? (quả = qu – a – qua – hỏi – quả) | Có | `[ ]` Có · `[ ]` Không, cách của lớp: |
| B2 | “gi” là **một âm**? (giỏ = gi – o – gio – hỏi – giỏ) | Có | `[ ]` Có · `[ ]` Không, cách của lớp: |
| B3 | Với **gì, gìn, giếng, giết**: chữ i vừa thuộc “gi” vừa thuộc vần (gì = gi – i; giếng = gi – iêng)? | Có (chờ xác nhận) | `[ ]` Có · `[ ]` Cách khác: |
| B4 | Đánh vần **quý, quýt, quyển, quỳnh** thế nào? (qu – y / qu – uy; qu – yên / qu – uyên …) | Chưa quyết định — hệ thống đang để “chưa xác định” | Cách của lớp: |
| B5 | Vị trí dấu thanh với oa, oe, uy: **hoà, khoẻ, thuỷ** (dấu trên âm chính) hay **hòa, khỏe, thủy** (dấu trên âm đệm)? | Ngữ liệu đang viết kiểu hoà, khoẻ, thuỷ | `[ ]` hoà/khoẻ/thuỷ · `[ ]` hòa/khỏe/thủy |
| B6 | Viết **i** hay **y** sau phụ âm: lí/lý, kĩ/kỹ, mĩ/mỹ? | Chấp nhận cả hai | `[ ]` Dùng i · `[ ]` Dùng y · `[ ]` Cả hai |
| B7 | Gọi thanh không dấu là “thanh ngang” hay “không dấu”? | Thanh ngang | |
| B8 | Lời đọc xưng hô “cô – con” hay “cô – em”? | cô – con | |

## C. Tên chữ cái (29 chữ)

Tên chữ cái là cách đọc khi học **bảng chữ cái**; khác với cách gọi âm khi **đánh vần** (mục D). Ví dụ chữ b có tên “bê” nhưng khi đánh vần gọi là “bờ”.

| Chữ | Tên đề xuất | Đồng ý | Chữ | Tên đề xuất | Đồng ý | Chữ | Tên đề xuất | Đồng ý |
|---|---|---|---|---|---|---|---|---|
| A a | a | `[ ]` | H h | hát | `[ ]` | Ơ ơ | ơ | `[ ]` |
| Ă ă | á | `[ ]` | I i | i (i ngắn) | `[ ]` | P p | pê | `[ ]` |
| Â â | ớ | `[ ]` | K k | ca | `[ ]` | Q q | quy (hoặc cu) | `[ ]` |
| B b | bê | `[ ]` | L l | e-lờ | `[ ]` | R r | e-rờ | `[ ]` |
| C c | xê | `[ ]` | M m | em-mờ | `[ ]` | S s | ét-xì | `[ ]` |
| D d | dê | `[ ]` | N n | en-nờ | `[ ]` | T t | tê | `[ ]` |
| Đ đ | đê | `[ ]` | O o | o | `[ ]` | U u | u | `[ ]` |
| E e | e | `[ ]` | Ô ô | ô | `[ ]` | Ư ư | ư | `[ ]` |
| Ê ê | ê | `[ ]` | | | | V v | vê | `[ ]` |
| G g | giê | `[ ]` | | | | X x | ích-xì | `[ ]` |
| | | | | | | Y y | i dài (hoặc i-grếc) | `[ ]` |

Ý kiến của cô (nếu lớp gọi khác): ……………………………………………

## D. Cách gọi âm khi đánh vần (39 âm)

| Âm | Gọi là | Đồng ý | Âm | Gọi là | Đồng ý | Âm | Gọi là | Đồng ý |
|---|---|---|---|---|---|---|---|---|
| b | bờ | `[ ]` | x | xờ | `[ ]` | ă | á | `[ ]` |
| c | cờ | `[ ]` | ch | chờ | `[ ]` | â | ớ | `[ ]` |
| d | dờ | `[ ]` | gh | gờ kép | `[ ]` | e | e | `[ ]` |
| đ | đờ | `[ ]` | gi | di | `[ ]` | ê | ê | `[ ]` |
| g | gờ | `[ ]` | kh | khờ | `[ ]` | i | i (i ngắn) | `[ ]` |
| h | hờ | `[ ]` | ng | ngờ (ngờ đơn) | `[ ]` | y | i (i dài) | `[ ]` |
| k | ca | `[ ]` | ngh | ngờ kép | `[ ]` | o | o | `[ ]` |
| l | lờ | `[ ]` | nh | nhờ | `[ ]` | ô | ô | `[ ]` |
| m | mờ | `[ ]` | ph | phờ | `[ ]` | ơ | ơ | `[ ]` |
| n | nờ | `[ ]` | qu | quờ | `[ ]` | u | u | `[ ]` |
| p | pờ | `[ ]` | th | thờ | `[ ]` | ư | ư | `[ ]` |
| r | rờ | `[ ]` | tr | trờ | `[ ]` | a | a | `[ ]` |
| s | sờ | `[ ]` | | | | | | |
| t | tờ | `[ ]` | | | | | | |
| v | vờ | `[ ]` | | | | | | |

Cần cô xác nhận đặc biệt: k gọi “ca” hay “cờ”? gh gọi “gờ kép” hay “gờ ghép”? gi gọi “di” hay “gi”?

## E. Quy tắc chính tả hệ thống dùng để kiểm tra

Các quy tắc sau được coi là **chắc chắn**; ngữ liệu vi phạm sẽ bị chặn. Cô xem ví dụ có đúng không.

| # | Quy tắc | Viết đúng | Viết sai | Đồng ý |
|---|---|---|---|---|
| E1 | Viết **k** trước i, y, e, ê; viết **c** trước âm khác | kẻ, kê, kìa, cá, cô | cẻ, kà | `[ ]` |
| E2 | Viết **gh** trước i, e, ê; viết **g** trước âm khác | ghế, ghi, gà, gỗ | gế, ghà | `[ ]` |
| E3 | Viết **ngh** trước i, e, ê; viết **ng** trước âm khác | nghé, nghỉ, ngõ | ngé, nghà | `[ ]` |
| E4 | **q** luôn đi với **u** (qu); không viết co-, cu- cho âm “quờ” | quả, quê, quạt | coa, kuê | `[ ]` |
| E5 | Có âm đầu viết **iê** (tiên), không có âm đầu viết **yê** (yên, yêu) | tiên, yên, thuyền | iên, tyên | `[ ]` |
| E6 | Có âm cuối viết iê, uô, ươ; không có âm cuối viết ia, ua, ưa | tiếng, muốn, người, mía, cua, mưa | mian, muô | `[ ]` |
| E7 | Âm cuối **p, t, c, ch** chỉ đi với thanh **sắc** hoặc **nặng** | học, sách, đẹp, mắt | bàt, cảc | `[ ]` |
| E8 | Mỗi tiếng chỉ có một dấu thanh, dấu đặt trên âm chính | mùa, quả, già, tiếng | muà, qủa, gìa | `[ ]` |

## F. Danh mục vần (153 vần)

Cô đánh dấu những vần **bộ sách của lớp có dạy ở lớp 1**, gạch những vần không dạy hoặc ghi chú vần cần bổ sung.

- Vần một nguyên âm (khi dạy tính là âm): a, e, ê, i, y, o, ô, ơ, u, ư
- ia, ua, ưa
- a: ac, ach, ai, am, an, ang, anh, ao, ap, at, au, ay
- ă: ăc, ăm, ăn, ăng, ăp, ăt — â: âc, âm, ân, âng, âp, ât, âu, ây
- e: ec, em, en, eng, eo, ep, et — ê: êch, êm, ên, ênh, êp, êt, êu
- i: ich, im, in, inh, ip, it, iu
- o: oc, oi, om, on, ong, op, ot, ooc, oong — ô: ôc, ôi, ôm, ôn, ông, ôp, ôt — ơ: ơi, ơm, ơn, ơp, ơt
- u: uc, ui, um, un, ung, up, ut — ư: ưc, ưi, ưng, ưt, ưu
- iê/yê: iêc, iêm, iên, iêng, iêp, iêt, iêu; yêm, yên, yêt, yêu
- uô: uôc, uôi, uôm, uôn, uông, uôt — ươ: ươc, ươi, ươm, ươn, ương, ươp, ươt, ươu
- oa: oa, oac, oach, oai, oam, oan, oang, oanh, oap, oat, oay — oă: oăc, oăm, oăn, oăng, oăt — oe: oe, oen, oeo, oet
- uy: uy, uych, uynh, uyt, uyu, uya, uyên, uyêt — uê: uê, uênh — uâ: uân, uâng, uât, uây — uơ

Vần hệ thống ghi là ít gặp ở lớp 1: ooc, yêt, ươp, ươu, oach, oam, oap, oăc, oăm, oăn, oăng, oăt, oen, uych, uyu, uênh, uâng, uơ.

- `[ ]` Danh mục đủ cho lớp 1 · Vần cần thêm: …………… · Vần lớp không học: ……………
- `[ ]` Đồng ý thứ tự học: vần không có âm đệm trước (an, ang…), vần có âm đệm sau (oan, oang…); iên trước iêng; uôn trước uông; ươn trước ương.

## G. Cặp dễ nhầm (phụ thuộc giọng địa phương)

Hệ thống dùng các cặp này để chọn phương án nhiễu và gợi ý ôn tập. Cô đánh dấu cặp **thực sự hay gặp ở lớp**.

| Cặp | Loại | Hay gặp ở lớp | Cặp | Loại | Hay gặp ở lớp |
|---|---|---|---|---|---|
| b – d | hình chữ | `[ ]` | c – k | chính tả | `[ ]` |
| p – q | hình chữ | `[ ]` | g – gh | chính tả | `[ ]` |
| m – n | hình chữ | `[ ]` | ng – ngh | chính tả | `[ ]` |
| n – u | hình chữ | `[ ]` | i – y | chính tả | `[ ]` |
| l – n | âm (vùng miền) | `[ ]` | an – ang | âm (vùng miền) | `[ ]` |
| s – x | âm (vùng miền) | `[ ]` | at – ac | âm (vùng miền) | `[ ]` |
| ch – tr | âm (vùng miền) | `[ ]` | en – eng | âm | `[ ]` |
| d – gi | âm (vùng miền) | `[ ]` | hỏi – ngã | thanh (vùng miền) | `[ ]` |
| d – r | âm (vùng miền) | `[ ]` | | | |

Giọng địa phương chủ yếu của lớp: ……………

## H. Ngữ liệu tiếng, từ, câu (58 tiếng · 60 từ · 31 câu)

Toàn bộ do nhóm dự án viết mới (không chép sách giáo khoa). Khi duyệt từng mục, cô kiểm tra:

- `[ ]` **Chính tả** đúng (đặc biệt dấu thanh và các chữ c/k, g/gh, ng/ngh).
- `[ ]` **Nghĩa** rõ, quen thuộc với trẻ 6–7 tuổi ở địa phương.
- `[ ]` **Phù hợp trẻ em**: không có từ ngữ gây sợ hãi, phân biệt, bạo lực.
- `[ ]` **Từ địa phương**: bố/ba, mẹ/má, quả na/mãng cầu… — chọn cách gọi của lớp.
- `[ ]` **Có thể vẽ hình rõ nghĩa** (với từ dùng cho bài “đọc từ – chọn hình”).
- `[ ]` **Độ khó dự kiến** (1–5) hợp lý.
- `[ ]` **Tên nhân vật hư cấu** không trùng biệt danh học sinh của lớp (hiện có tên “Na” trong câu “Bé Na vẽ hoa.”).
- `[ ]` Câu hỏi đọc hiểu gợi ý (ví dụ “Bé làm gì?”) phù hợp.

Mục hệ thống đề nghị cô chú ý:

| Mục | Lý do |
|---|---|
| nghé, đò, khế, su su, cò | Có thể ít quen với trẻ ở thành phố |
| quả quýt, quýt | Chưa có cách đánh vần thống nhất (mục B4) — đang để bản nháp |
| gì, giếng, giỏ, quả, quê | Phụ thuộc quy ước qu/gi (mục B1–B3) |
| khoẻ, thuỷ, tàu thuỷ | Phụ thuộc kiểu đặt dấu (mục B5) |
| thuyền, nghiêng, khuya, yêu, giếng, đôi dép, cây bàng, Bố tưới cây., Thuyền đi trên sông., Bà kể chuyện. | Dùng vần ngoài chuỗi bài minh họa — dùng để thử chức năng “chưa học” |

## I. Danh sách “đọc được” ở ba mốc bài (cần cô nhận xét)

Theo **chuỗi bài minh họa** (không phải bộ sách thật), hệ thống cho rằng học sinh Nhóm 2 đọc được:

- **Sau bài 5** (đã học a, b, c, o, ô, ơ, d, đ, e, ê, h, l và 6 thanh): 14 từ — bà, bé, bò, bố, cá, cò, cỏ, cô, cờ, đò, lá, lê, ba lô, lá cờ; 4 câu — Bà có cá. · Bố có bơ. · Cô có cờ đỏ. · Bé có lá cờ.
- **Sau bài 10** (thêm i, k, m, n, g, gh, t, th, ng, ngh, nh, kh, u, ư, ch, tr, v, qu, gi, s, x, r, ph, p): 34 từ, 16 câu (ví dụ: Bé nghỉ hè ở nhà bà. · Bố đi xe ra phố. · Bé vẽ gì?).
- **Sau bài 16** (thêm y, các vần ia, ua, ưa, an…, ang…, on…, oi…, oa, oe, uy): 56 từ, 28 câu.

| # | Câu hỏi | Ý kiến của cô |
|---|---|---|
| I1 | Cách hệ thống “chỉ coi là đọc được khi mọi âm, vần, thanh đã học” có hợp lý không? | |
| I2 | Có từ/câu nào trong danh sách mà học sinh thực tế vẫn khó đọc dù đã học đủ âm vần? | |
| I3 | Chữ viết hoa đầu câu (B, M, Ô…) — các em đã nhận biết chữ hoa chưa, từ khi nào? | |

## J. Những nội dung phải điều chỉnh trước khi dùng với học sinh

- [ ] Trả lời mục A (bộ sách, vị trí bài) → nhóm dự án nhập thứ tự bài của bộ sách thật.
- [ ] Chọn quy ước ở mục B → hồ sơ lớp 1A2 được cập nhật và xác nhận.
- [ ] Sửa tên chữ cái, cách gọi âm (mục C, D) nếu lớp gọi khác.
- [ ] Xác nhận quy tắc chính tả (mục E) và danh mục vần (mục F).
- [ ] Chọn các cặp dễ nhầm của lớp (mục G).
- [ ] Duyệt, sửa hoặc loại từng tiếng, từ, câu (mục H). Sau khi duyệt, hệ thống ghi tên người duyệt và ngày; nếu nội dung bị sửa sau đó, mục sẽ tự quay về trạng thái phải duyệt lại.
- [ ] Nhận xét danh sách đọc được (mục I).

---

**Người rà soát:** …………………………… (giáo viên)   **Ngày:** ……/……/20……

> Chỉ giáo viên được duyệt nội dung. Trợ lý AI và hệ thống không bao giờ tự duyệt.
