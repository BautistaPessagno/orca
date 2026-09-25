import { z } from 'zod'

// ACP children are third-party CLIs: a mistyped field is dropped rather than failing the frame.
const lenientString = z.string().optional().catch(undefined)
const lenientBoolean = z.boolean().optional().catch(undefined)
const lenientNumber = z.number().optional().catch(undefined)
const lenientArray = <T extends z.ZodType>(item: T) => z.array(item).optional().catch(undefined)

export const AcpRecordSchema = z.record(z.string(), z.unknown())

export const AcpRequestErrorSchema = z.looseObject({
  message: lenientString,
  code: lenientNumber
})

export const AcpInitializeResultSchema = z.looseObject({
  protocolVersion: lenientNumber,
  authMethods: lenientArray(z.looseObject({ id: lenientString })),
  agentCapabilities: z
    .looseObject({
      loadSession: lenientBoolean,
      promptCapabilities: z.looseObject({ image: lenientBoolean }).optional().catch(undefined)
    })
    .optional()
    .catch(undefined)
})

export const AcpConfigOptionSchema = z.looseObject({
  id: lenientString,
  name: lenientString,
  category: z.string().nullable().optional().catch(undefined),
  currentValue: z.unknown().optional(),
  options: lenientArray(
    z.looseObject({ value: lenientString, name: lenientString, description: lenientString })
  )
})

export const AcpConfigOptionsResultSchema = z.looseObject({
  configOptions: lenientArray(AcpConfigOptionSchema)
})

export const AcpSessionStartResultSchema = AcpConfigOptionsResultSchema.extend({
  sessionId: lenientString
})

export const AcpSessionUpdateParamsSchema = z.looseObject({
  update: z
    .looseObject({
      sessionUpdate: lenientString,
      content: z
        .looseObject({ type: lenientString, text: lenientString })
        .optional()
        .catch(undefined),
      toolCallId: lenientString,
      title: lenientString,
      status: lenientString,
      rawInput: z.unknown().optional()
    })
    .optional()
    .catch(undefined)
})

const AcpChoiceSchema = z.looseObject({ id: lenientString, label: lenientString })

export const AcpPermissionParamsSchema = z.looseObject({
  toolCall: z
    .looseObject({ title: lenientString, toolCallId: lenientString })
    .optional()
    .catch(undefined),
  options: lenientArray(z.looseObject({ optionId: lenientString, name: lenientString }))
})

export const AcpQuestionParamsSchema = z.looseObject({
  questions: lenientArray(
    z.looseObject({
      id: lenientString,
      prompt: lenientString,
      options: lenientArray(AcpChoiceSchema)
    })
  ),
  question: lenientString,
  options: lenientArray(AcpChoiceSchema)
})

export const AcpPlanParamsSchema = z.looseObject({
  plan: lenientString,
  title: lenientString,
  name: lenientString
})

/** Parses a frame the child sent; an unparseable one reads as empty rather than throwing. */
export function parseAcpFrame<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> | null {
  const parsed = schema.safeParse(value ?? {})
  return parsed.success ? parsed.data : null
}
