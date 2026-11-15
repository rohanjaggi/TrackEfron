import { describe, expect, test } from "vitest";
import { PG_UNIQUE_VIOLATION, escapeIlike } from "./postgrest";

describe("escapeIlike", () => {
  test("strips commas so a value cannot add a filter clause", () => {
    expect(escapeIlike("a,b")).not.toContain(",");
    expect(escapeIlike("a,b")).toBe("ab");
  });

  test("strips parentheses", () => {
    expect(escapeIlike("x)")).not.toContain(")");
    expect(escapeIlike("(x")).not.toContain("(");
    expect(escapeIlike("a.eq.1),id.neq.(2")).toBe("a.eq.1id.neq.2");
  });

  test("escapes LIKE wildcards and backslashes", () => {
    expect(escapeIlike("50%")).toBe("50\\%");
    expect(escapeIlike("a_b")).toBe("a\\_b");
    expect(escapeIlike("a\\b")).toBe("a\\\\b");
  });

  test("strips asterisks, which PostgREST treats as a % wildcard", () => {
    expect(escapeIlike("a*b")).toBe("ab");
    expect(escapeIlike("*")).toBe("");
  });

  test("leaves plain text unchanged", () => {
    expect(escapeIlike("Zac Efron")).toBe("Zac Efron");
  });
});

describe("PG_UNIQUE_VIOLATION", () => {
  test("is the Postgres unique-violation SQLSTATE", () => {
    expect(PG_UNIQUE_VIOLATION).toBe("23505");
  });
});
