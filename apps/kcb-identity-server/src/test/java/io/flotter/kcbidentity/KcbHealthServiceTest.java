package io.flotter.kcbidentity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class KcbHealthServiceTest {
  @Test
  void reportsBlockersWhenKcbArtifactsAreMissing() {
    KcbHealthService.KcbHealth health = new KcbHealthService().health();

    assertThat(health.ok()).isFalse();
    assertThat(health.blockers()).contains("official_documents_required");
    assertThat(health.jar().configured()).isFalse();
  }
}
