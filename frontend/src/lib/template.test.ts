import { describe, expect, it } from "vitest";
import { applyValues, render, resolveVars, tokens } from "./template";

const fns = { $uuid: () => "UUID", $timestamp: () => "1700000000" };

describe("render", () => {
  it("fills variables, tolerating spaces inside the braces", () => {
    expect(render("{{base}}/users/{{ id }}", { base: "https://a.test", id: "7" }, fns).text).toBe(
      "https://a.test/users/7",
    );
  });

  it("leaves unknown names in place and reports them once", () => {
    const r = render("{{a}} {{nope}} {{nope}}", { a: "1" }, fns);
    expect(r.text).toBe("1 {{nope}} {{nope}}");
    expect(r.missing).toEqual(["nope"]);
  });

  it("reports defined-but-empty variables", () => {
    const r = render("Bearer {{token}}", { token: "" }, fns);
    expect(r.text).toBe("Bearer ");
    expect(r.empty).toEqual(["token"]);
    expect(r.missing).toEqual([]);
  });

  it("runs built-ins each time and reports unknown ones", () => {
    const r = render("{{$uuid}}-{{$timestamp}}-{{$nope}}", {}, fns);
    expect(r.text).toBe("UUID-1700000000-{{$nope}}");
    expect(r.missing).toEqual(["$nope"]);
  });

  it("ignores things that only look like variables", () => {
    expect(render("{{}} {{1abc}} { {a} }", { a: "x" }, fns).text).toBe("{{}} {{1abc}} { {a} }");
  });

  it("doesn't treat inherited object keys as variables", () => {
    expect(render("{{constructor}}", {}, fns).missing).toEqual(["constructor"]);
  });
});

describe("resolveVars", () => {
  it("lets variables refer to other variables", () => {
    const vars = resolveVars(
      [
        { key: "api", value: "{{host}}/v{{version}}" },
        { key: "host", value: "https://{{domain}}" },
        { key: "domain", value: "a.test" },
        { key: "version", value: "2" },
      ],
      fns,
    );
    expect(vars.api).toBe("https://a.test/v2");
  });

  it("stops on cycles instead of looping", () => {
    const vars = resolveVars([{ key: "a", value: "x{{a}}" }], fns);
    expect(vars.a.startsWith("xxxxx")).toBe(true);
  });
});

describe("tokens / applyValues", () => {
  it("lists referenced names", () => {
    expect(tokens("{{a}} {{ b }} {{a}} {{$uuid}}")).toEqual(["a", "b", "$uuid"]);
  });

  it("updates in place and appends new keys", () => {
    const list = [
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ];
    expect(applyValues(list, { b: "20", c: "3" })).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "20" },
      { key: "c", value: "3" },
    ]);
  });
});
