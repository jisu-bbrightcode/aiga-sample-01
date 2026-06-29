import type { KcbBlockerCode } from "./contracts";

export class KcbIdentityVerificationError extends Error {
  constructor(
    public readonly code: KcbBlockerCode,
    message: string,
  ) {
    super(message);
    this.name = "KcbIdentityVerificationError";
  }
}

export function toPublicKcbError(error: unknown): { code: KcbBlockerCode; message: string } {
  if (error instanceof KcbIdentityVerificationError) {
    return { code: error.code, message: publicMessageForCode(error.code) };
  }
  return {
    code: "provider_rejected",
    message: publicMessageForCode("provider_rejected"),
  };
}

export function publicMessageForCode(code: KcbBlockerCode): string {
  switch (code) {
    case "configuration_required":
      return "본인확인 서비스 설정이 아직 완료되지 않았습니다.";
    case "official_documents_required":
      return "공식 KCB 연동자료 확인이 필요합니다.";
    case "jar_required":
      return "KCB 모듈 파일이 서버에 연결되어야 합니다.";
    case "license_required":
      return "KCB 라이선스 파일이 서버에 연결되어야 합니다.";
    case "native_library_required":
      return "KCB 네이티브 라이브러리 설정이 필요합니다.";
    case "site_code_required":
      return "KCB 회원사 코드 설정이 필요합니다.";
    case "return_url_required":
      return "KCB 결과 return URL 설정이 필요합니다.";
    case "popup_url_required":
      return "KCB 인증창 URL 설정이 필요합니다.";
    case "custom_mode_not_enabled":
      return "커스텀형 본인확인은 공식 허용 확인 전까지 사용할 수 없습니다.";
    case "replay_detected":
      return "이미 처리된 본인확인 요청입니다. 다시 시작해 주세요.";
    case "canceled":
      return "본인확인이 취소되었습니다. 다시 시도해 주세요.";
    case "session_not_found":
      return "본인확인 요청을 찾을 수 없습니다. 다시 시작해 주세요.";
    case "session_expired":
      return "본인확인 요청 시간이 만료되었습니다. 다시 시작해 주세요.";
    case "provider_rejected":
      return "본인확인을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
