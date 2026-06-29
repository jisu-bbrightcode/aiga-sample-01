package io.flotter.kcbidentity;

public record KcbRuntimeConfig(
  String mode,
  String cpCd,
  String moduleJarPath,
  String licensePath,
  String nativeLibPath,
  boolean nativeLibRequired,
  String popupUrl,
  String siteName,
  String siteUrl,
  String returnUrl,
  String officialSourceMap,
  int connectTimeoutMs,
  int readTimeoutMs
) {
  public static KcbRuntimeConfig fromEnv() {
    String mode = env("KCB_MODE", "unset").toUpperCase();
    return new KcbRuntimeConfig(
      mode,
      env("KCB_SITE_CODE", env("KCB_SERVICE_CODE", "")),
      env("KCB_MODULE_JAR_PATH", ""),
      env("KCB_LICENSE_PATH", ""),
      env("KCB_NATIVE_LIB_PATH", ""),
      "true".equalsIgnoreCase(env("KCB_NATIVE_LIB_REQUIRED", "false")),
      env("KCB_POPUP_URL", "https://safe.ok-name.co.kr/CommonSvl"),
      env("KCB_SITE_NAME", ""),
      env("KCB_SITE_URL", ""),
      env("KCB_STANDARD_RETURN_URL", ""),
      env("KCB_OFFICIAL_SOURCE_MAP", ""),
      intEnv("KCB_CONNECT_TIMEOUT_MS", 10000),
      intEnv("KCB_READ_TIMEOUT_MS", 10000)
    );
  }

  public boolean hasOfficialSourceMap() {
    return present(officialSourceMap);
  }

  public boolean hasCpCd() {
    return cpCd != null && cpCd.matches("[A-Za-z0-9]{12}");
  }

  public boolean hasReturnUrl() {
    return present(returnUrl);
  }

  public boolean hasPopupUrl() {
    return present(popupUrl);
  }

  public boolean hasSiteName() {
    return present(siteName);
  }

  public boolean hasSiteUrl() {
    return present(siteUrl);
  }

  public boolean hasValidTarget() {
    return "TEST".equals(mode) || "PROD".equals(mode);
  }

  private static String env(String name, String fallback) {
    String value = System.getenv(name);
    return present(value) ? value : fallback;
  }

  private static int intEnv(String name, int fallback) {
    try {
      return Integer.parseInt(env(name, Integer.toString(fallback)));
    } catch (NumberFormatException error) {
      return fallback;
    }
  }

  private static boolean present(String value) {
    return value != null && !value.isBlank();
  }
}
