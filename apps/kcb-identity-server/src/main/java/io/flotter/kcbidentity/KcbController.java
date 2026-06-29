package io.flotter.kcbidentity;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class KcbController {
  private final KcbHealthService healthService;
  private final KcbOfficialGateway gateway;

  public KcbController(KcbHealthService healthService, KcbOfficialGateway gateway) {
    this.healthService = healthService;
    this.gateway = gateway;
  }

  @GetMapping("/health")
  public KcbHealthService.KcbHealth health() {
    return healthService.health();
  }

  @PostMapping("/internal/kcb/standard/request")
  public ResponseEntity<?> standardRequest(
    @RequestBody KcbOfficialGateway.StandardStartRequest body
  ) {
    try {
      return ResponseEntity.ok(gateway.createStandardRequest(body));
    } catch (KcbGatewayException error) {
      return gatewayError(error);
    }
  }

  @PostMapping("/internal/kcb/standard/verify")
  public ResponseEntity<?> standardVerify(@RequestBody Map<String, Object> body) {
    try {
      return ResponseEntity.ok(gateway.verifyStandard(body));
    } catch (KcbGatewayException error) {
      return gatewayError(error);
    }
  }

  @PostMapping("/internal/kcb/custom/request")
  public ResponseEntity<Map<String, String>> customRequest(@RequestBody Map<String, Object> body) {
    return blockedUntilOfficialCustomContract();
  }

  @PostMapping("/internal/kcb/custom/verify")
  public ResponseEntity<Map<String, String>> customVerify(@RequestBody Map<String, Object> body) {
    return blockedUntilOfficialCustomContract();
  }

  @PostMapping("/internal/kcb/decrypt-result")
  public ResponseEntity<?> decryptResult(@RequestBody Map<String, Object> body) {
    try {
      return ResponseEntity.ok(gateway.verifyStandard(body));
    } catch (KcbGatewayException error) {
      return gatewayError(error);
    }
  }

  private ResponseEntity<Map<String, String>> blockedUntilOfficialCustomContract() {
    return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
      .body(Map.of("code", "official_documents_required"));
  }

  private ResponseEntity<Map<String, String>> gatewayError(KcbGatewayException error) {
    HttpStatus status = switch (error.code()) {
      case "configuration_required",
        "official_documents_required",
        "site_code_required",
        "return_url_required",
        "popup_url_required",
        "jar_required",
        "license_required",
        "native_library_required" -> HttpStatus.PRECONDITION_FAILED;
      default -> HttpStatus.BAD_GATEWAY;
    };
    return ResponseEntity.status(status).body(Map.of("code", error.code()));
  }
}
