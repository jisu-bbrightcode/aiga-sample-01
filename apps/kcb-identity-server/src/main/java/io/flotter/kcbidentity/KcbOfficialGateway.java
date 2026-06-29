package io.flotter.kcbidentity;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class KcbOfficialGateway {
  private static final String START_SERVICE = "IDS_HS_POPUP_START";
  private static final String RESULT_SERVICE = "IDS_HS_POPUP_RESULT";
  private static final String POPUP_TC = "kcb.oknm.online.safehscert.popup.cmd.P931_CertChoiceCmd";

  private final ObjectMapper objectMapper;
  private volatile URLClassLoader classLoader;
  private volatile String classLoaderJarPath;

  public KcbOfficialGateway(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public StandardStartResponse createStandardRequest(StandardStartRequest request) {
    KcbRuntimeConfig config = KcbRuntimeConfig.fromEnv();
    assertReady(config);

    Map<String, String> params = new LinkedHashMap<>();
    params.put("RETURN_URL", resolveReturnUrl(config, request));
    params.put("SITE_NAME", config.siteName());
    params.put("SITE_URL", config.siteUrl());
    params.put("RQST_CAUS_CD", causeCode(request.targetAction()));

    Map<String, String> result = callOkCert(config, START_SERVICE, params);
    String resultCode = result.getOrDefault("RSLT_CD", "");
    String moduleToken = result.get("MDL_TKN");
    if (!"B000".equals(resultCode) || moduleToken == null || moduleToken.isBlank()) {
      throw new KcbGatewayException("provider_rejected", "KCB did not issue a module token");
    }

    Map<String, String> redirectForm = new LinkedHashMap<>();
    redirectForm.put("tc", POPUP_TC);
    redirectForm.put("cp_cd", config.cpCd());
    redirectForm.put("mdl_tkn", moduleToken);
    redirectForm.put("target_id", "");

    return new StandardStartResponse(
      result.get("TX_SEQ_NO"),
      config.popupUrl(),
      "POST",
      redirectForm
    );
  }

  public VerifyResponse verifyStandard(Map<String, Object> providerPayload) {
    KcbRuntimeConfig config = KcbRuntimeConfig.fromEnv();
    assertReady(config);

    String moduleToken = stringValue(providerPayload, "MDL_TKN");
    if (moduleToken == null) moduleToken = stringValue(providerPayload, "mdl_tkn");
    if (moduleToken == null || moduleToken.isBlank()) {
      throw new KcbGatewayException("provider_rejected", "KCB module token is required");
    }

    Map<String, String> params = new LinkedHashMap<>();
    params.put("MDL_TKN", moduleToken);

    Map<String, String> result = callOkCert(config, RESULT_SERVICE, params);
    String resultCode = result.getOrDefault("RSLT_CD", "");
    boolean verified = "B000".equals(resultCode);

    return new VerifyResponse(
      result.get("TX_SEQ_NO"),
      resultCode,
      result.getOrDefault("RSLT_MSG", resultCode),
      verified,
      hashIfPresent(result.get("CI")),
      hashIfPresent(result.get("DI")),
      maskName(result.get("RSLT_NAME")),
      birthYear(result.get("RSLT_BIRTHDAY")),
      maskBirthDate(result.get("RSLT_BIRTHDAY")),
      maskPhone(result.get("TEL_NO"))
    );
  }

  private Map<String, String> callOkCert(
    KcbRuntimeConfig config,
    String serviceName,
    Map<String, String> params
  ) {
    try {
      Class<?> okCertClass = Class.forName("kcb.module.v3.OkCert", true, classLoader(config));
      Object okCert = okCertClass.getConstructor().newInstance();
      invokeOptional(okCertClass, okCert, "setConnectTimeout", int.class, config.connectTimeoutMs());
      invokeOptional(okCertClass, okCert, "setReadTimeout", int.class, config.readTimeoutMs());

      Method call = okCertClass.getMethod(
        "callOkCert",
        String.class,
        String.class,
        String.class,
        String.class,
        String.class,
        InputStream.class
      );

      String requestJson = objectMapper.writeValueAsString(params);
      String responseJson;
      try (InputStream license = Files.newInputStream(Path.of(config.licensePath()))) {
        responseJson = (String) call.invoke(
          okCert,
          config.mode(),
          config.cpCd(),
          serviceName,
          config.licensePath(),
          requestJson,
          license
        );
      }

      Map<String, Object> raw = objectMapper.readValue(
        responseJson,
        new TypeReference<Map<String, Object>>() {}
      );
      Map<String, String> normalized = new HashMap<>();
      for (Map.Entry<String, Object> entry : raw.entrySet()) {
        normalized.put(entry.getKey(), entry.getValue() == null ? "" : entry.getValue().toString());
      }
      return normalized;
    } catch (InvocationTargetException error) {
      Throwable cause = error.getTargetException();
      throw new KcbGatewayException("provider_rejected", "KCB module call failed", cause);
    } catch (Exception error) {
      throw new KcbGatewayException("provider_rejected", "KCB module call failed", error);
    }
  }

  private URLClassLoader classLoader(KcbRuntimeConfig config) throws Exception {
    String jarPath = config.moduleJarPath();
    URLClassLoader current = classLoader;
    if (current != null && jarPath.equals(classLoaderJarPath)) return current;

    synchronized (this) {
      if (classLoader != null && jarPath.equals(classLoaderJarPath)) return classLoader;
      URLClassLoader next = new URLClassLoader(
        new URL[] { Path.of(jarPath).toUri().toURL() },
        KcbOfficialGateway.class.getClassLoader()
      );
      classLoader = next;
      classLoaderJarPath = jarPath;
      return next;
    }
  }

  private static void assertReady(KcbRuntimeConfig config) {
    if (!config.hasValidTarget()) throw new KcbGatewayException("configuration_required", "KCB mode is required");
    if (!config.hasCpCd()) throw new KcbGatewayException("site_code_required", "KCB site code is required");
    if (!config.hasReturnUrl()) throw new KcbGatewayException("return_url_required", "KCB return URL is required");
    if (!config.hasPopupUrl()) throw new KcbGatewayException("popup_url_required", "KCB popup URL is required");
    if (!Files.isRegularFile(Path.of(config.moduleJarPath()))) {
      throw new KcbGatewayException("jar_required", "KCB module JAR is required");
    }
    if (!Files.isRegularFile(Path.of(config.licensePath()))) {
      throw new KcbGatewayException("license_required", "KCB license is required");
    }
  }

  private static void invokeOptional(
    Class<?> clazz,
    Object target,
    String methodName,
    Class<?> paramType,
    Object value
  ) {
    try {
      Method method = clazz.getMethod(methodName, paramType);
      method.invoke(target, value);
    } catch (ReflectiveOperationException ignored) {
      // Older KCB modules can omit optional tuning methods.
    }
  }

  private static String resolveReturnUrl(KcbRuntimeConfig config, StandardStartRequest request) {
    return request.returnUrl() == null || request.returnUrl().isBlank()
      ? config.returnUrl()
      : request.returnUrl();
  }

  private static String causeCode(String targetAction) {
    if (targetAction == null) return "99";
    return switch (targetAction) {
      case "signup", "sign_up", "register" -> "00";
      case "adult", "adult_verification" -> "01";
      case "profile_update", "settings_update" -> "02";
      case "password_reset", "account_recovery" -> "03";
      case "purchase", "payment", "refund" -> "04";
      default -> "99";
    };
  }

  private static String stringValue(Map<String, Object> payload, String key) {
    Object value = payload.get(key);
    return value == null ? null : value.toString();
  }

  private static String hashIfPresent(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return "sha256:" + HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception error) {
      return null;
    }
  }

  private static String birthYear(String birthday) {
    return birthday != null && birthday.length() >= 4 ? birthday.substring(0, 4) : null;
  }

  private static String maskBirthDate(String birthday) {
    return birthday != null && birthday.length() >= 4 ? birthday.substring(0, 4) + "****" : null;
  }

  private static String maskPhone(String phone) {
    if (phone == null || phone.length() < 7) return null;
    return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
  }

  private static String maskName(String name) {
    if (name == null || name.isBlank()) return null;
    if (name.length() == 1) return "*";
    if (name.length() == 2) return name.charAt(0) + "*";
    return name.charAt(0) + "*".repeat(name.length() - 2) + name.charAt(name.length() - 1);
  }

  public record StandardStartRequest(
    String requestId,
    String sessionId,
    String state,
    String nonce,
    String returnUrl,
    String callbackUrl,
    String targetAction
  ) {}

  public record StandardStartResponse(
    String providerTransactionId,
    String redirectUrl,
    String redirectMethod,
    Map<String, String> redirectForm
  ) {}

  public record VerifyResponse(
    String providerTransactionId,
    String resultCode,
    String resultMessage,
    boolean verified,
    String ciHash,
    String diHash,
    String nameMasked,
    String birthYear,
    String birthDateMasked,
    String phoneMasked
  ) {}
}
