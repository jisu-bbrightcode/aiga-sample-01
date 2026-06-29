package io.flotter.kcbidentity;

public class KcbGatewayException extends RuntimeException {
  private final String code;

  public KcbGatewayException(String code, String message) {
    super(message);
    this.code = code;
  }

  public KcbGatewayException(String code, String message, Throwable cause) {
    super(message, cause);
    this.code = code;
  }

  public String code() {
    return code;
  }
}
