# syntax=docker/dockerfile:1

# --- build stage -----------------------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

# --- runtime stage ---------------------------------------------------------
FROM eclipse-temurin:17-jre AS runtime
WORKDIR /app
COPY --from=build /app/target/kcb-identity-server-*.jar app.jar

# The official KCB module JAR and license are NOT baked into the image.
# Mount them at runtime and point the env vars at the mounted paths:
#   KCB_MODULE_JAR_PATH=/artifacts/jar/OkCert3-java1.5-2.3.5.jar
#   KCB_LICENSE_PATH=/artifacts/license/V72010000000_IDS_01_PROD_AES_license.dat
ENV SERVER_PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
