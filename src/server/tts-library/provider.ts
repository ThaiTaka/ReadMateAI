import "server-only";
import { noneProvider } from "@/server/tts/providers";
import { createTtsProvider, type ProviderEnv } from "@/server/tts/service";
import type { TtsProvider } from "@/server/tts/types";
import { LIBRARY_PROVIDER_ID } from "./voice";

/**
 * Nhà cung cấp dùng để TẠO tệp của thư viện giọng máy (chỉ giáo viên bấm "Tạo âm thanh" mới tới đây; đường phát cho học sinh
 * KHÔNG import tệp này). Chỉ Viettel và chỉ khi đặt rõ `TTS_PROVIDER=viettel` kèm `TTS_VIETTEL_TOKEN` — có token cho công cụ nghe
 * thử `tts:poc` chưa đủ để thư viện tự gọi dịch vụ (hai cổng). Thiếu → `none`: không gọi mạng, không lỗi khởi động.
 */
export function libraryProvider(env: ProviderEnv = process.env): TtsProvider {
  const provider = createTtsProvider(env);
  return provider.id === LIBRARY_PROVIDER_ID ? provider : noneProvider;
}
