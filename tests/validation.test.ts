import { describe, expect, it } from "vitest";

import {
  candidateSchema,
  createUserSchema,
  jobSchema,
  linkedinUrlSchema,
  loginSchema,
  passwordSchema,
  stageSchema,
} from "@/lib/validation/schemas";

describe("candidateSchema", () => {
  const base = {
    fullName: "Anna Andersson",
    email: "",
    phone: "",
    linkedinUrl: "",
    location: "",
    cvText: "",
  };

  it("requires a full name", () => {
    const result = candidateSchema.safeParse({ ...base, fullName: "A" });
    expect(result.success).toBe(false);
  });

  it("turns empty optional fields into null rather than empty strings", () => {
    const result = candidateSchema.parse(base);
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.linkedinUrl).toBeNull();
    expect(result.location).toBeNull();
    expect(result.cvText).toBeNull();
  });

  it("lowercases and keeps a valid email", () => {
    const result = candidateSchema.parse({
      ...base,
      email: "  Anna.Andersson@Example.COM ",
    });
    expect(result.email).toBe("anna.andersson@example.com");
  });

  it("rejects a malformed email when one is supplied", () => {
    const result = candidateSchema.safeParse({ ...base, email: "anna@" });
    expect(result.success).toBe(false);
  });

  it("trims the full name", () => {
    expect(candidateSchema.parse({ ...base, fullName: "  Erik Lind  " }).fullName).toBe(
      "Erik Lind",
    );
  });
});

describe("linkedinUrlSchema", () => {
  it("accepts an https URL", () => {
    expect(
      linkedinUrlSchema.parse("https://www.linkedin.com/in/anna-andersson"),
    ).toBe("https://www.linkedin.com/in/anna-andersson");
  });

  it("accepts country subdomains and vanity domains", () => {
    expect(linkedinUrlSchema.parse("https://se.linkedin.com/in/erik")).toBeTruthy();
    expect(linkedinUrlSchema.parse("http://erik.dev/cv")).toBeTruthy();
  });

  it("treats blank input as not provided", () => {
    expect(linkedinUrlSchema.parse("")).toBeNull();
    expect(linkedinUrlSchema.parse("   ")).toBeNull();
    expect(linkedinUrlSchema.parse(undefined)).toBeNull();
  });

  it("rejects a bare domain with no scheme", () => {
    expect(linkedinUrlSchema.safeParse("linkedin.com/in/anna").success).toBe(false);
  });

  it("rejects a javascript: URL so it can never reach an href", () => {
    expect(
      linkedinUrlSchema.safeParse("javascript:alert(document.cookie)").success,
    ).toBe(false);
  });
});

describe("jobSchema", () => {
  const base = {
    title: "Backend Developer",
    description: "",
    location: "",
    employmentType: "",
    status: "open",
  };

  it("accepts a minimal valid job", () => {
    const result = jobSchema.parse(base);
    expect(result.title).toBe("Backend Developer");
    expect(result.status).toBe("open");
    expect(result.employmentType).toBeNull();
  });

  it("requires a title", () => {
    expect(jobSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });

  it("rejects a status outside the allowed set", () => {
    expect(jobSchema.safeParse({ ...base, status: "archived" }).success).toBe(false);
  });

  it("rejects an unknown employment type", () => {
    expect(
      jobSchema.safeParse({ ...base, employmentType: "freelance-ish" }).success,
    ).toBe(false);
  });

  it("accepts a known employment type", () => {
    expect(jobSchema.parse({ ...base, employmentType: "full_time" }).employmentType).toBe(
      "full_time",
    );
  });
});

describe("stageSchema", () => {
  it("accepts every pipeline stage", () => {
    for (const stage of [
      "new",
      "screening",
      "interview",
      "offer",
      "hired",
      "rejected",
    ]) {
      expect(stageSchema.safeParse(stage).success).toBe(true);
    }
  });

  it("rejects anything else, which is what keeps the DB check constraint unreachable", () => {
    expect(stageSchema.safeParse("onboarding").success).toBe(false);
    expect(stageSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires at least 10 characters", () => {
    expect(passwordSchema.safeParse("Short1").success).toBe(false);
  });

  it("requires a letter and a digit", () => {
    expect(passwordSchema.safeParse("1234567890").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefghijk").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefghi1").success).toBe(true);
  });

  it("rejects passwords longer than bcrypt's 72-byte limit", () => {
    expect(passwordSchema.safeParse("a1".repeat(40)).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalises the email", () => {
    expect(loginSchema.parse({ email: " ME@Example.com ", password: "x" }).email).toBe(
      "me@example.com",
    );
  });

  it("rejects a missing password", () => {
    expect(
      loginSchema.safeParse({ email: "me@example.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("createUserSchema", () => {
  const base = {
    email: "anna@example.com",
    password: "CorrectHorse1",
    fullName: "Anna Andersson",
  };

  it("accepts a customer with a new organization name", () => {
    const result = createUserSchema.safeParse({
      ...base,
      role: "customer",
      organizationName: "Northstar Consulting AB",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a customer attached to an existing organization", () => {
    const result = createUserSchema.safeParse({
      ...base,
      role: "customer",
      organizationId: "6f8f57a2-2c6d-4f0f-9a3e-2b1c0d9e4a11",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a customer with no organization at all", () => {
    const result = createUserSchema.safeParse({ ...base, role: "customer" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/must belong to an organization/i);
    }
  });

  it("accepts a platform admin with no organization", () => {
    expect(createUserSchema.safeParse({ ...base, role: "admin" }).success).toBe(true);
  });

  it("rejects a platform admin that is given an organization", () => {
    const result = createUserSchema.safeParse({
      ...base,
      role: "admin",
      organizationName: "Northstar Consulting AB",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown role", () => {
    expect(
      createUserSchema.safeParse({ ...base, role: "superuser" }).success,
    ).toBe(false);
  });

  it("rejects a weak password", () => {
    expect(
      createUserSchema.safeParse({ ...base, password: "abc", role: "admin" }).success,
    ).toBe(false);
  });
});
