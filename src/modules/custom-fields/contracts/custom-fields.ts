import { z } from "zod";

export const customFieldEntityTypeSchema = z.enum(["PARTY", "CATALOG_ITEM"]);
export const customFieldValueTypeSchema = z.enum(["TEXT", "LONG_TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]);

const optionSchema = z.string().trim().min(1).max(100);
const optionsSchema = z.array(optionSchema).min(1).max(50).superRefine((options, context) => {
  const normalized = options.map((option) => option.toLocaleLowerCase("en-US"));
  if (new Set(normalized).size !== normalized.length) context.addIssue({ code: "custom", message: "Select options must be unique." });
});

export const createCustomFieldDefinitionSchema = z.object({
  entityType: customFieldEntityTypeSchema,
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/),
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional().transform((value) => value || null),
  valueType: customFieldValueTypeSchema,
  required: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  options: optionsSchema.nullable().optional(),
}).superRefine((input, context) => {
  if (input.valueType === "SELECT" && !input.options) context.addIssue({ code: "custom", path: ["options"], message: "Select fields require options." });
  if (input.valueType !== "SELECT" && input.options) context.addIssue({ code: "custom", path: ["options"], message: "Only select fields may define options." });
});

export const updateCustomFieldDefinitionSchema = z.object({
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional().transform((value) => value || null),
  required: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
  options: optionsSchema.nullable().optional(),
});

const submittedValueSchema = z.union([z.string().max(5000), z.boolean(), z.null()]);

export const saveCustomFieldValuesSchema = z.object({
  values: z.array(z.object({ definitionId: z.string().min(1), value: submittedValueSchema })).max(100),
});

export type CreateCustomFieldDefinitionInput = z.input<typeof createCustomFieldDefinitionSchema>;
export type UpdateCustomFieldDefinitionInput = z.input<typeof updateCustomFieldDefinitionSchema>;
export type SaveCustomFieldValuesInput = z.input<typeof saveCustomFieldValuesSchema>;
export type CustomFieldEntityTypeInput = z.infer<typeof customFieldEntityTypeSchema>;
