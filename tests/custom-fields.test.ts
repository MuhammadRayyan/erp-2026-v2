import { describe, expect, it } from "vitest";
import { createCustomFieldDefinitionSchema, saveCustomFieldValuesSchema } from "../src/modules/custom-fields/contracts/custom-fields";

describe("custom field contracts", () => {
  it("requires unique options for select definitions", () => {
    expect(() => createCustomFieldDefinitionSchema.parse({ entityType: "PARTY", key: "service_zone", label: "Service zone", valueType: "SELECT", options: ["Dubai", "dubai"] })).toThrow();
    expect(createCustomFieldDefinitionSchema.parse({ entityType: "PARTY", key: "service_zone", label: "Service zone", valueType: "SELECT", options: ["Dubai", "Abu Dhabi"] }).options).toEqual(["Dubai", "Abu Dhabi"]);
  });

  it("rejects invalid keys and non-select options", () => {
    expect(() => createCustomFieldDefinitionSchema.parse({ entityType: "PARTY", key: "Invalid Key", label: "Invalid", valueType: "TEXT" })).toThrow();
    expect(() => createCustomFieldDefinitionSchema.parse({ entityType: "PARTY", key: "priority", label: "Priority", valueType: "TEXT", options: ["High"] })).toThrow();
  });

  it("caps submitted value collections", () => {
    expect(() => saveCustomFieldValuesSchema.parse({ values: Array.from({ length: 101 }, (_, index) => ({ definitionId: String(index), value: "x" })) })).toThrow();
  });
});
