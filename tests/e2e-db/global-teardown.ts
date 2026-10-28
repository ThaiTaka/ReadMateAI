import {
  setLocalGameRunFixtures,
  setLocalHonorsApproval,
  setLocalLeaderboardApproval,
  setLocalStudentAudioPlayback,
  setLocalStudentTtsPlayback,
  setLocalTeacherAudioApproval,
  setLocalTtsLibrary,
} from "../../scripts/lib/test-fixtures";

/** Sau E2E có CSDL: trả cờ hệ thống bảng xếp hạng về TẮT (mặc định của migration; pgTAP kiểm tra điều này). */
export default function globalTeardown() {
  setLocalLeaderboardApproval(false);
  setLocalHonorsApproval(false);
  setLocalGameRunFixtures(false);
  setLocalTeacherAudioApproval(false);
  setLocalStudentAudioPlayback(false);
  setLocalTtsLibrary(false);
  setLocalStudentTtsPlayback(false);
}
