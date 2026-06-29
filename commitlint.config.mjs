/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // scope는 feature 이름 (선택, warning만)
    "scope-enum": [
      1,
      "always",
      [
        "auth",
        "profile",
        "role-permission",
        "board",
        "community",
        "content-studio",
        "marketing",
        "payment",
        "ai",
        "comment",
        "reaction",
        "review",
        "notification",
        "file",
        "email",
        "analytics",
        "audit",
        "schedule",
        "landing",
        "hello-world",
        "course",
        "booking",
        "deps",
        "release",
      ],
    ],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
  },
};
