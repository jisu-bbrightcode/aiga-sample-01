package io.flotter.kcbidentity;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class KcbHealthService {
  public KcbHealth health() {
    KcbRuntimeConfig config = KcbRuntimeConfig.fromEnv();
    FileState jar = fileState(config.moduleJarPath(), true);
    FileState license = fileState(config.licensePath(), false);
    FileState nativeLibrary = fileState(config.nativeLibPath(), false);
    boolean adapterConfigured = present(System.getenv("KCB_INTERNAL_AUTH_TOKEN"));
    boolean officialSourceMapped = config.hasOfficialSourceMap();
    boolean customModeEnabled = "true".equals(System.getenv("KCB_CUSTOM_MODE_ENABLED"));

    List<String> blockers = new ArrayList<>();
    if (!adapterConfigured) blockers.add("configuration_required");
    if (!officialSourceMapped) blockers.add("official_documents_required");
    if (!config.hasValidTarget()) blockers.add("configuration_required");
    if (!config.hasCpCd()) blockers.add("site_code_required");
    if (!config.hasSiteName() || !config.hasSiteUrl()) blockers.add("configuration_required");
    if (!config.hasReturnUrl()) blockers.add("return_url_required");
    if (!config.hasPopupUrl()) blockers.add("popup_url_required");
    if (!jar.configured() || !jar.readable()) blockers.add("jar_required");
    if (!license.configured() || !license.readable()) blockers.add("license_required");
    if (config.nativeLibRequired() && (!nativeLibrary.configured() || !nativeLibrary.readable())) {
      blockers.add("native_library_required");
    }

    return new KcbHealth(
      blockers.isEmpty(),
      healthMode(config.mode()),
      adapterConfigured,
      officialSourceMapped,
      jar,
      license,
      nativeLibrary,
      config.nativeLibRequired(),
      jar.configured() && jar.readable() && license.configured() && license.readable(),
      customModeEnabled,
      blockers
    );
  }

  private static boolean present(String value) {
    return value != null && !value.isBlank();
  }

  private static String healthMode(String target) {
    if ("TEST".equals(target)) return "test";
    if ("PROD".equals(target)) return "production";
    return "unset";
  }

  private static FileState fileState(String rawPath, boolean checksum) {
    if (!present(rawPath)) return new FileState(false, false, null);
    Path path = Path.of(rawPath);
    boolean readable = Files.isRegularFile(path) && Files.isReadable(path);
    return new FileState(true, readable, checksum && readable ? sha256(path) : null);
  }

  private static String sha256(Path path) {
    try (InputStream input = Files.newInputStream(path)) {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] buffer = new byte[8192];
      int read;
      while ((read = input.read(buffer)) != -1) {
        digest.update(buffer, 0, read);
      }
      return "sha256:" + HexFormat.of().formatHex(digest.digest());
    } catch (Exception error) {
      return null;
    }
  }

  public record FileState(boolean configured, boolean readable, String checksum) {}

  public record KcbHealth(
    boolean ok,
    String mode,
    boolean adapterConfigured,
    boolean officialSourceMapped,
    FileState jar,
    FileState license,
    FileState nativeLibrary,
    boolean nativeLibraryRequired,
    boolean officialModuleWired,
    boolean customModeEnabled,
    List<String> blockers
  ) {}
}
